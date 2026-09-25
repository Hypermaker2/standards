import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type { CheckIssue, Profile } from './paths.ts';

const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', 'coverage', 'output']);
const DOT_DIR_ALLOWLIST = new Set(['.github', '.agents']);

const BUN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.sh']);
const PYTHON_EXTENSIONS = new Set(['.py', '.ts', '.tsx', '.js', '.mjs', '.css', '.sh']);

export type CommentScanOptions = {
  projectRoot: string;
  profile: Profile;
  commentExempt?: string[];
};

function isExempt(relativePath: string, exempt: string[]): boolean {
  return exempt.some(
    (prefix) => relativePath === prefix || relativePath.startsWith(prefix.replace(/\/?$/, '/'))
  );
}

function shouldSkipDirName(name: string): boolean {
  if (SKIP_DIR_NAMES.has(name)) return true;
  if (name.startsWith('.') && !DOT_DIR_ALLOWLIST.has(name)) return true;
  return false;
}

function pathHasSkippedSegment(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]/).filter(Boolean);
  for (let index = 0; index < segments.length - 1; index += 1) {
    if (shouldSkipDirName(segments[index])) return true;
  }
  return false;
}

function isUnderNestedStandards(projectRoot: string, relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]/).filter(Boolean);
  for (let index = 1; index < segments.length; index += 1) {
    const dirRel = segments.slice(0, index).join(path.sep);
    if (fs.existsSync(path.join(projectRoot, dirRel, 'standards.json'))) {
      return true;
    }
  }
  return false;
}

function collectFilesWalk(
  dir: string,
  projectRoot: string,
  extensions: Set<string>,
  exempt: string[],
  skipNestedStandards: boolean,
  out: string[]
): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.' || entry.name === '..') continue;
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(projectRoot, fullPath);
    if (entry.isDirectory()) {
      if (shouldSkipDirName(entry.name)) continue;
      if (isExempt(relativePath + '/', exempt) || isExempt(relativePath, exempt)) continue;
      if (skipNestedStandards && fs.existsSync(path.join(fullPath, 'standards.json'))) {
        continue;
      }
      collectFilesWalk(fullPath, projectRoot, extensions, exempt, skipNestedStandards, out);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;
    if (isExempt(relativePath, exempt)) continue;
    out.push(fullPath);
  }
}

function listGitFiles(projectRoot: string): string[] | null {
  const result = spawnSync(
    'git',
    ['-C', projectRoot, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.status !== 0 || result.stdout === null) return null;
  const raw = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout);
  if (raw.length === 0) return [];
  const parts = raw.toString('utf8').split('\0');
  if (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
  }
  return parts;
}

function collectFiles(
  projectRoot: string,
  extensions: Set<string>,
  exempt: string[],
  skipNestedStandards: boolean
): string[] {
  const out: string[] = [];
  const gitFiles = listGitFiles(projectRoot);
  if (gitFiles !== null) {
    for (const relativePath of gitFiles) {
      if (!extensions.has(path.extname(relativePath))) continue;
      if (pathHasSkippedSegment(relativePath)) continue;
      if (isExempt(relativePath, exempt)) continue;
      if (skipNestedStandards && isUnderNestedStandards(projectRoot, relativePath)) continue;
      out.push(path.join(projectRoot, relativePath));
    }
    return out;
  }

  for (const entry of fs.readdirSync(projectRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      const ext = path.extname(entry.name);
      if (!extensions.has(ext)) continue;
      const relativePath = entry.name;
      if (isExempt(relativePath, exempt)) continue;
      out.push(path.join(projectRoot, entry.name));
      continue;
    }
    if (shouldSkipDirName(entry.name)) continue;
    const fullPath = path.join(projectRoot, entry.name);
    if (skipNestedStandards && fs.existsSync(path.join(fullPath, 'standards.json'))) {
      continue;
    }
    collectFilesWalk(fullPath, projectRoot, extensions, exempt, skipNestedStandards, out);
  }
  return out;
}

function lineOf(text: string, pos: number): number {
  return text.slice(0, pos).split('\n').length;
}

function langFor(filePath: string): 'ts' | 'tsx' | 'js' {
  const ext = path.extname(filePath);
  if (ext === '.tsx') return 'tsx';
  if (ext === '.js' || ext === '.mjs') return 'js';
  return 'ts';
}

function checkTypeScript(filePath: string, text: string, projectRoot: string): CheckIssue[] {
  const relativePath = path.relative(projectRoot, filePath);
  const result = parseSync(filePath, text, { lang: langFor(filePath) });
  return result.comments
    .filter((comment) => !(comment.start === 0 && text.startsWith('#!')))
    .map((comment) => ({
      file: relativePath,
      line: lineOf(text, comment.start),
      message: 'comment not allowed',
    }));
}

function checkCss(filePath: string, text: string, projectRoot: string): CheckIssue[] {
  const relativePath = path.relative(projectRoot, filePath);
  const issues: CheckIssue[] = [];
  const pattern = /\/\*[\s\S]*?\*\//g;
  for (const match of text.matchAll(pattern)) {
    issues.push({
      file: relativePath,
      line: lineOf(text, match.index),
      message: 'comment not allowed',
    });
  }
  return issues;
}

function isShellHashComment(line: string, hash: number): boolean {
  if (hash === 0) return true;
  const prev = line[hash - 1];
  if (prev === '$' || prev === '{') return false;
  return /\s/.test(prev);
}

function checkHashComments(
  filePath: string,
  text: string,
  projectRoot: string,
  allowShebang: boolean
): CheckIssue[] {
  const relativePath = path.relative(projectRoot, filePath);
  const issues: CheckIssue[] = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (allowShebang && index === 0 && line.startsWith('#!')) continue;
    const hash = line.indexOf('#');
    if (hash === -1) continue;
    if (!isShellHashComment(line, hash)) continue;
    const before = line.slice(0, hash);
    const single = (before.match(/'/g) ?? []).length;
    const double = (before.match(/"/g) ?? []).length;
    if (single % 2 === 1 || double % 2 === 1) continue;
    issues.push({
      file: relativePath,
      line: index + 1,
      message: 'comment not allowed',
    });
  }
  return issues;
}

function checkFile(filePath: string, projectRoot: string): CheckIssue[] {
  const text = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath);
  if (ext === '.css') return checkCss(filePath, text, projectRoot);
  if (ext === '.sh' || ext === '.py') {
    return checkHashComments(filePath, text, projectRoot, true);
  }
  return checkTypeScript(filePath, text, projectRoot);
}

export function checkNoComments(options: CommentScanOptions): CheckIssue[] {
  const extensions = options.profile === 'python' ? PYTHON_EXTENSIONS : BUN_EXTENSIONS;
  const exempt = options.commentExempt ?? [];
  const skipNestedStandards = options.profile === 'python';
  const files = collectFiles(options.projectRoot, extensions, exempt, skipNestedStandards);
  files.sort();
  return files.flatMap((filePath) => checkFile(filePath, options.projectRoot));
}

if (import.meta.main) {
  const issues = checkNoComments({
    projectRoot: process.cwd(),
    profile: 'bun-ts',
  });
  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`${issue.file}:${issue.line}: ${issue.message}`);
    }
    console.error(
      `\n${issues.length} comment(s) found in ${new Set(issues.map((issue) => issue.file)).size} file(s).`
    );
    process.exit(1);
  }
  console.log('No comments found.');
}
