import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';
import { listProjectFiles, toRelative } from './projectFiles.ts';

type SingleTypeScriptOptions = {
  projectRoot: string;
  tscAllowed?: string[];
};

function isTscAllowedPackage(relativePackageJson: string, allowedDirs: string[]): boolean {
  const dir = path.dirname(relativePackageJson);
  const normalizedDir = dir === '.' ? '' : dir.split(path.sep).join('/');
  return allowedDirs.some((allowed) => {
    const normalizedAllowed = allowed.replace(/\/$/, '');
    if (normalizedAllowed === '' || normalizedAllowed === '.') {
      return normalizedDir === '';
    }
    return normalizedDir === normalizedAllowed || normalizedDir.startsWith(`${normalizedAllowed}/`);
  });
}

export function checkSingleTypeScript(options: SingleTypeScriptOptions): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const allowedDirs = options.tscAllowed ?? [];

  const lockPath = path.join(options.projectRoot, 'bun.lock');
  if (fs.existsSync(lockPath)) {
    const lockText = fs.readFileSync(lockPath, 'utf8');
    if (lockText.includes('typescript@5.') || lockText.includes('typescript@6.')) {
      issues.push({
        file: 'bun.lock',
        line: 1,
        message: 'bun.lock must not contain typescript@5 or typescript@6',
      });
    }
  }

  const packageFiles = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: new Set(['.json']),
  }).filter((absolutePath) => path.basename(absolutePath) === 'package.json');

  for (const absolutePath of packageFiles) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTscAllowedPackage(relativePath, allowedDirs)) continue;
    const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const scripts = parsed.scripts ?? {};
    for (const [name, value] of Object.entries(scripts)) {
      if (typeof value !== 'string') continue;
      if (!/\btsc\b/.test(value)) continue;
      issues.push({
        file: relativePath,
        line: 1,
        message: `script "${name}" must not use tsc`,
      });
    }
  }

  const workflowDir = path.join(options.projectRoot, '.github', 'workflows');
  if (fs.existsSync(workflowDir)) {
    const workflowFiles = listProjectFiles({
      projectRoot: options.projectRoot,
      extensions: new Set(['.yml', '.yaml']),
    }).filter((absolutePath) => {
      const relativePath = toRelative(options.projectRoot, absolutePath).split(path.sep).join('/');
      return relativePath.startsWith('.github/workflows/');
    });
    for (const absolutePath of workflowFiles) {
      const relativePath = toRelative(options.projectRoot, absolutePath);
      const text = fs.readFileSync(absolutePath, 'utf8');
      if (!/\btsc\b/.test(text)) continue;
      const lines = text.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        if (!/\btsc\b/.test(lines[index])) continue;
        issues.push({
          file: relativePath,
          line: index + 1,
          message: 'workflow must not use tsc',
        });
      }
    }
  }

  return issues;
}
