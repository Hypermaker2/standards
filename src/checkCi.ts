import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';
import { readPackageText } from './paths.ts';

const CI_WORKFLOW_RELATIVE = path.join('.github', 'workflows', 'standards.yml');

function ciWorkflowTemplate(): string {
  return readPackageText('configs/github/workflows/standards.yml');
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

export function checkCiWorkflow(projectRoot: string): CheckIssue[] {
  const relativePath = CI_WORKFLOW_RELATIVE;
  const absolutePath = path.join(projectRoot, relativePath);
  const expected = ciWorkflowTemplate();
  if (!fs.existsSync(absolutePath)) {
    return [
      {
        file: relativePath,
        line: 1,
        message: 'CI workflow missing; run standards sync with "ci": true',
      },
    ];
  }
  const actual = fs.readFileSync(absolutePath, 'utf8');
  if (actual !== expected) {
    return [
      {
        file: relativePath,
        line: 1,
        message: 'CI workflow drifts from @dino/standards; run standards sync',
      },
    ];
  }
  return [];
}
