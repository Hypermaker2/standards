import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue, Profile } from './paths.ts';

const BUN_SCRIPTS = [
  'dev',
  'build',
  'test',
  'typecheck',
  'lint',
  'format',
  'format:check',
  'check',
] as const;

export function checkScripts(projectRoot: string, profile: Profile): CheckIssue[] {
  if (profile === 'bun-ts') {
    return checkBunScripts(projectRoot);
  }
  return checkPythonProject(projectRoot);
}

function checkBunScripts(projectRoot: string): CheckIssue[] {
  const packagePath = path.join(projectRoot, 'package.json');
  const issues: CheckIssue[] = [];
  if (!fs.existsSync(packagePath)) {
    issues.push({
      file: 'package.json',
      line: 1,
      message: 'package.json not found',
    });
    return issues;
  }
  const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const scripts = parsed.scripts ?? {};
  for (const name of BUN_SCRIPTS) {
    if (typeof scripts[name] !== 'string' || scripts[name].length === 0) {
      issues.push({
        file: 'package.json',
        line: 1,
        message: `missing script "${name}"`,
      });
    }
  }
  return issues;
}

function checkPythonProject(projectRoot: string): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const pyprojectPath = path.join(projectRoot, 'pyproject.toml');
  if (!fs.existsSync(pyprojectPath)) {
    issues.push({
      file: 'pyproject.toml',
      line: 1,
      message: 'pyproject.toml not found',
    });
    return issues;
  }
  const text = fs.readFileSync(pyprojectPath, 'utf8');
  const hasRuffFiles =
    fs.existsSync(path.join(projectRoot, 'ruff.base.toml')) &&
    fs.existsSync(path.join(projectRoot, 'ruff.toml'));
  if (!hasRuffFiles && !/\[tool\.ruff/.test(text)) {
    issues.push({
      file: 'pyproject.toml',
      line: 1,
      message: 'ruff is not configured (need ruff.base.toml + ruff.toml from standards sync)',
    });
  }
  if (!/\[tool\.pytest|pytest/.test(text)) {
    issues.push({
      file: 'pyproject.toml',
      line: 1,
      message: 'pytest is not configured in pyproject.toml',
    });
  }
  return issues;
}
