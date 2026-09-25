import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue, Profile } from './paths.ts';
import { readPackageText } from './paths.ts';

function writeIfChanged(targetPath: string, contents: string): 'written' | 'unchanged' {
  if (fs.existsSync(targetPath)) {
    const existing = fs.readFileSync(targetPath, 'utf8');
    if (existing === contents) return 'unchanged';
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents);
  return 'written';
}

export function syncConfigs(
  projectRoot: string,
  profile: Profile
): Array<{ file: string; status: 'written' | 'unchanged' }> {
  const results: Array<{ file: string; status: 'written' | 'unchanged' }> = [];
  if (profile === 'bun-ts') {
    const oxlint = readPackageText('configs/oxlintrc.json');
    const oxfmt = readPackageText('configs/oxfmtrc.json');
    results.push({
      file: '.oxlintrc.json',
      status: writeIfChanged(path.join(projectRoot, '.oxlintrc.json'), oxlint),
    });
    results.push({
      file: '.oxfmtrc.json',
      status: writeIfChanged(path.join(projectRoot, '.oxfmtrc.json'), oxfmt),
    });
    return results;
  }
  const ruff = readPackageText('configs/ruff.toml');
  results.push({
    file: 'ruff.toml',
    status: writeIfChanged(path.join(projectRoot, 'ruff.toml'), ruff),
  });
  return results;
}

export function checkConfigs(projectRoot: string, profile: Profile): CheckIssue[] {
  const issues: CheckIssue[] = [];
  if (profile === 'bun-ts') {
    compareFile(projectRoot, '.oxlintrc.json', 'configs/oxlintrc.json', issues);
    compareFile(projectRoot, '.oxfmtrc.json', 'configs/oxfmtrc.json', issues);
    return issues;
  }
  compareFile(projectRoot, 'ruff.toml', 'configs/ruff.toml', issues);
  return issues;
}

function compareFile(
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
