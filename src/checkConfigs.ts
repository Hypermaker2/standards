import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue, Profile } from './paths.ts';
import { readPackageText } from './paths.ts';

const ALLOWED_CONFIG_EXTRA_KEYS = ['$schema', 'ignorePatterns'] as const;

const ALLOWED_EXTRA = new Set<string>(ALLOWED_CONFIG_EXTRA_KEYS);

const RUFF_EXTEND_LINE = 'extend = "ruff.base.toml"';

function writeIfChanged(targetPath: string, contents: string): 'written' | 'unchanged' {
  if (fs.existsSync(targetPath)) {
    const existing = fs.readFileSync(targetPath, 'utf8');
    if (existing === contents) return 'unchanged';
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents);
  return 'written';
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeJsonConfig(packageJson: string, existingPath: string): string {
  const packageConfig = JSON.parse(packageJson) as Record<string, unknown>;
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(existingPath)) {
    existing = JSON.parse(fs.readFileSync(existingPath, 'utf8')) as Record<string, unknown>;
  }
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(packageConfig)) {
    merged[key] = value;
  }
  for (const key of Object.keys(merged)) {
    if (!(key in packageConfig) && !ALLOWED_EXTRA.has(key)) {
      delete merged[key];
    }
  }
  return `${JSON.stringify(merged, null, 2)}\n`;
}

export function syncConfigs(
  projectRoot: string,
  profile: Profile
): Array<{ file: string; status: 'written' | 'unchanged' }> {
  const results: Array<{ file: string; status: 'written' | 'unchanged' }> = [];
  if (profile === 'bun-ts') {
    const oxlintPath = path.join(projectRoot, '.oxlintrc.json');
    const oxfmtPath = path.join(projectRoot, '.oxfmtrc.json');
    results.push({
      file: '.oxlintrc.json',
      status: writeIfChanged(
        oxlintPath,
        mergeJsonConfig(readPackageText('configs/oxlintrc.json'), oxlintPath)
      ),
    });
    results.push({
      file: '.oxfmtrc.json',
      status: writeIfChanged(
        oxfmtPath,
        mergeJsonConfig(readPackageText('configs/oxfmtrc.json'), oxfmtPath)
      ),
    });
    return results;
  }

  const basePath = path.join(projectRoot, 'ruff.base.toml');
  results.push({
    file: 'ruff.base.toml',
    status: writeIfChanged(basePath, readPackageText('configs/ruff.base.toml')),
  });

  const ruffPath = path.join(projectRoot, 'ruff.toml');
  if (!fs.existsSync(ruffPath)) {
    results.push({
      file: 'ruff.toml',
      status: writeIfChanged(ruffPath, `${RUFF_EXTEND_LINE}\n`),
    });
  } else {
    results.push({ file: 'ruff.toml', status: 'unchanged' });
  }
  return results;
}

export function checkConfigs(projectRoot: string, profile: Profile): CheckIssue[] {
  const issues: CheckIssue[] = [];
  if (profile === 'bun-ts') {
    checkJsonConfig(projectRoot, '.oxlintrc.json', 'configs/oxlintrc.json', issues);
    checkJsonConfig(projectRoot, '.oxfmtrc.json', 'configs/oxfmtrc.json', issues);
    return issues;
  }
  checkExactFile(projectRoot, 'ruff.base.toml', 'configs/ruff.base.toml', issues);
  checkRuffExtend(projectRoot, issues);
  return issues;
}

function checkJsonConfig(
  projectRoot: string,
  projectRelative: string,
  packageRelative: string,
  issues: CheckIssue[]
): void {
  const projectPath = path.join(projectRoot, projectRelative);
  const expected = JSON.parse(readPackageText(packageRelative)) as Record<string, unknown>;
  if (!fs.existsSync(projectPath)) {
    issues.push({
      file: projectRelative,
      line: 1,
      message: 'config file missing; run standards sync',
    });
    return;
  }
  const actual = JSON.parse(fs.readFileSync(projectPath, 'utf8')) as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    if (!(key in actual) || !deepEqual(actual[key], value)) {
      issues.push({
        file: projectRelative,
        line: 1,
        message: `config key "${key}" drifts from @dino/standards; run standards sync`,
      });
    }
  }
  for (const key of Object.keys(actual)) {
    if (!(key in expected) && !ALLOWED_EXTRA.has(key)) {
      issues.push({
        file: projectRelative,
        line: 1,
        message: `config key "${key}" is not allowed; allowed extras: ${ALLOWED_CONFIG_EXTRA_KEYS.join(', ')}`,
      });
    }
  }
}

function checkExactFile(
  projectRoot: string,
  projectRelative: string,
  packageRelative: string,
  issues: CheckIssue[]
): void {
  const projectPath = path.join(projectRoot, projectRelative);
  const expected = readPackageText(packageRelative);
  if (!fs.existsSync(projectPath)) {
    issues.push({
      file: projectRelative,
      line: 1,
      message: 'config file missing; run standards sync',
    });
    return;
  }
  const actual = fs.readFileSync(projectPath, 'utf8');
  if (actual !== expected) {
    issues.push({
      file: projectRelative,
      line: 1,
      message: 'config drifts from @dino/standards; run standards sync',
    });
  }
}

function checkRuffExtend(projectRoot: string, issues: CheckIssue[]): void {
  const projectPath = path.join(projectRoot, 'ruff.toml');
  if (!fs.existsSync(projectPath)) {
    issues.push({
      file: 'ruff.toml',
      line: 1,
      message: 'ruff.toml missing; run standards sync (should contain extend = "ruff.base.toml")',
    });
    return;
  }
  const text = fs.readFileSync(projectPath, 'utf8');
  if (!/^extend\s*=\s*"ruff\.base\.toml"\s*$/m.test(text)) {
    issues.push({
      file: 'ruff.toml',
      line: 1,
      message: 'ruff.toml must contain extend = "ruff.base.toml"',
    });
  }
}
