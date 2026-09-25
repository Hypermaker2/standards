import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type { CheckIssue, Profile } from './paths.ts';
import { listProjectFiles } from './projectFiles.ts';

const BUN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.sh']);
const PYTHON_EXTENSIONS = new Set(['.py', '.ts', '.tsx', '.js', '.mjs', '.css', '.sh']);

export type CommentScanOptions = {
  projectRoot: string;
  profile: Profile;
  commentExempt?: string[];
};

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
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions,
    exempt: options.commentExempt ?? [],
    skipNestedStandards: options.profile === 'python',
  });
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
