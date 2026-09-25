import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', 'coverage', 'output']);
const DOT_DIR_ALLOWLIST = new Set(['.github', '.agents']);

export function isExemptPath(relativePath: string, exempt: string[]): boolean {
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
      if (isExemptPath(relativePath + '/', exempt) || isExemptPath(relativePath, exempt)) continue;
      if (skipNestedStandards && fs.existsSync(path.join(fullPath, 'standards.json'))) {
        continue;
      }
      collectFilesWalk(fullPath, projectRoot, extensions, exempt, skipNestedStandards, out);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;
    if (isExemptPath(relativePath, exempt)) continue;
    out.push(fullPath);
  }
}

type ListProjectFilesOptions = {
  projectRoot: string;
  extensions: Set<string>;
  exempt?: string[];
  skipNestedStandards?: boolean;
};

export function listProjectFiles(options: ListProjectFilesOptions): string[] {
  const exempt = options.exempt ?? [];
  const skipNestedStandards = options.skipNestedStandards ?? false;
  const out: string[] = [];
  const gitFiles = listGitFiles(options.projectRoot);
  if (gitFiles !== null) {
    for (const relativePath of gitFiles) {
      if (!options.extensions.has(path.extname(relativePath))) continue;
      if (pathHasSkippedSegment(relativePath)) continue;
      if (isExemptPath(relativePath, exempt)) continue;
      if (skipNestedStandards && isUnderNestedStandards(options.projectRoot, relativePath)) {
        continue;
      }
      out.push(path.join(options.projectRoot, relativePath));
    }
    return out;
  }

  for (const entry of fs.readdirSync(options.projectRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      const ext = path.extname(entry.name);
      if (!options.extensions.has(ext)) continue;
      if (isExemptPath(entry.name, exempt)) continue;
      out.push(path.join(options.projectRoot, entry.name));
      continue;
    }
    if (shouldSkipDirName(entry.name)) continue;
    const fullPath = path.join(options.projectRoot, entry.name);
    if (skipNestedStandards && fs.existsSync(path.join(fullPath, 'standards.json'))) {
      continue;
    }
    collectFilesWalk(
      fullPath,
      options.projectRoot,
      options.extensions,
      exempt,
      skipNestedStandards,
      out
    );
  }
  return out;
}

export function toRelative(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath);
}

export function isTestLikePath(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join('/');
  const base = path.basename(normalized);
  if (normalized.includes('/__tests__/') || normalized.startsWith('__tests__/')) return true;
  if (normalized.includes('/src/test/') || normalized.startsWith('src/test/')) return true;
  if (normalized.includes('/src/testing/') || normalized.startsWith('src/testing/')) return true;
  if (/\.test\./.test(base)) return true;
  if (/\.stories\./.test(base)) return true;
  return false;
}

export function isAlwaysExemptEnvPath(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join('/');
  if (isTestLikePath(normalized)) return true;
  if (normalized === 'scripts' || normalized.startsWith('scripts/')) return true;
  const base = path.basename(normalized);
  if (base.startsWith('vite.config.')) return true;
  if (base.startsWith('vitest.config.')) return true;
  if (base.endsWith('.config.ts')) return true;
  return false;
}
