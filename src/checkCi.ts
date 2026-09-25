import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';
import { readPackageText } from './paths.ts';

const CI_WORKFLOW_RELATIVE = path.join('.github', 'workflows', 'standards.yml');
const BUN_VERSION_RELATIVE = '.bun-version';

function ciWorkflowTemplate(): string {
  return readPackageText('configs/github/workflows/standards.yml');
}

function runningBunVersion(): string {
  if (typeof Bun !== 'undefined' && typeof Bun.version === 'string') {
    return Bun.version;
  }
  const result = spawnSync('bun', ['--version'], { encoding: 'utf8' });
  if (
    result.status !== 0 ||
    typeof result.stdout !== 'string' ||
    result.stdout.trim().length === 0
  ) {
    throw new Error('unable to determine Bun version for .bun-version');
  }
  return result.stdout.trim();
}

export function syncCiWorkflow(projectRoot: string): {
  file: string;
  status: 'written' | 'unchanged';
} {
  const targetPath = path.join(projectRoot, CI_WORKFLOW_RELATIVE);
  const contents = ciWorkflowTemplate();
  if (fs.existsSync(targetPath) && fs.readFileSync(targetPath, 'utf8') === contents) {
    return { file: CI_WORKFLOW_RELATIVE, status: 'unchanged' };
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents);
  return { file: CI_WORKFLOW_RELATIVE, status: 'written' };
}

export function syncBunVersion(projectRoot: string): {
  file: string;
  status: 'written' | 'unchanged';
} {
  const targetPath = path.join(projectRoot, BUN_VERSION_RELATIVE);
  if (fs.existsSync(targetPath)) {
    return { file: BUN_VERSION_RELATIVE, status: 'unchanged' };
  }
  fs.writeFileSync(targetPath, `${runningBunVersion()}\n`);
  return { file: BUN_VERSION_RELATIVE, status: 'written' };
}

export function checkCiWorkflow(projectRoot: string): CheckIssue[] {
  const relativePath = CI_WORKFLOW_RELATIVE;
  const absolutePath = path.join(projectRoot, relativePath);
  const expected = ciWorkflowTemplate();
  const issues: CheckIssue[] = [];
  if (!fs.existsSync(absolutePath)) {
    issues.push({
      file: relativePath,
      line: 1,
      message: 'CI workflow missing; run standards sync with "ci": true',
    });
  } else {
    const actual = fs.readFileSync(absolutePath, 'utf8');
    if (actual !== expected) {
      issues.push({
        file: relativePath,
        line: 1,
        message: 'CI workflow drifts from @dino/standards; run standards sync',
      });
    }
  }

  const bunVersionPath = path.join(projectRoot, BUN_VERSION_RELATIVE);
  if (!fs.existsSync(bunVersionPath)) {
    issues.push({
      file: BUN_VERSION_RELATIVE,
      line: 1,
      message: '.bun-version missing; run standards sync with "ci": true',
    });
  }

  return issues;
}
