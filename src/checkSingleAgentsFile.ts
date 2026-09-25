import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';

const FORBIDDEN_PATHS = [
  'CLAUDE.md',
  path.join('.claude', 'CLAUDE.md'),
  'CLAUDE.local.md',
  '.cursorrules',
  path.join('.cursor', 'rules'),
] as const;

const MESSAGE = 'AGENTS.md is the single instruction file for every runtime';

export function checkSingleAgentsFile(projectRoot: string): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const relativePath of FORBIDDEN_PATHS) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    issues.push({
      file: relativePath,
      line: 1,
      message: MESSAGE,
    });
  }
  return issues;
}
