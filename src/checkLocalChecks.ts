import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';

const LOCAL_CHECK_FILE = /^check-[A-Za-z0-9_-]+\.ts$/;

type LocalChecksScanOptions = {
  projectRoot: string;
  localChecks?: Record<string, string>;
};

function listDeclaredLocalCheckFiles(projectRoot: string): string[] {
  const scriptsDir = path.join(projectRoot, 'scripts');
  if (!fs.existsSync(scriptsDir)) return [];
  const entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!LOCAL_CHECK_FILE.test(entry.name)) continue;
    if (entry.name.endsWith('.test.ts')) continue;
    files.push(path.join('scripts', entry.name));
  }
  return files.sort();
}

export function checkLocalChecks(options: LocalChecksScanOptions): CheckIssue[] {
  const declared = options.localChecks ?? {};
  const issues: CheckIssue[] = [];

  for (const [relativePath, reason] of Object.entries(declared)) {
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      issues.push({
        file: 'standards.json',
        line: 1,
        message: `localChecks["${relativePath}"] must be a non-empty one-line reason`,
      });
    }
    const absolute = path.join(options.projectRoot, relativePath);
    if (!fs.existsSync(absolute)) {
      issues.push({
        file: 'standards.json',
        line: 1,
        message: `localChecks["${relativePath}"] path not found`,
      });
    }
  }

  for (const relativePath of listDeclaredLocalCheckFiles(options.projectRoot)) {
    if (relativePath in declared) continue;
    issues.push({
      file: relativePath,
      line: 1,
      message:
        'undeclared local check; add standards.json localChecks["' +
        relativePath +
        '"] with a one-line reason this is project-only, or move the rule into @dino/standards',
    });
  }

  return issues;
}
