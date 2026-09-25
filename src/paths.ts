import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export type Profile = 'bun-ts' | 'python';

export type StandardsConfig = {
  profile: Profile;
  design: boolean;
  tokensCss?: string;
  commentExempt?: string[];
  extraRoles?: string[];
};

export type CheckIssue = {
  file: string;
  line: number;
  message: string;
};

export function packageRoot(): string {
  return PACKAGE_ROOT;
}

export function packageVersion(): string {
  const raw = fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8');
  const parsed = JSON.parse(raw) as { version: string };
  return parsed.version;
}

export function readPackageText(relativePath: string): string {
  return fs.readFileSync(path.join(PACKAGE_ROOT, relativePath), 'utf8');
}

export function loadStandardsConfig(projectRoot: string): StandardsConfig {
  const configPath = path.join(projectRoot, 'standards.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `standards.json not found in ${projectRoot}. Run: standards sync --init --profile bun-ts`
    );
  }
  const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as StandardsConfig;
  if (parsed.profile !== 'bun-ts' && parsed.profile !== 'python') {
    throw new Error(`standards.json profile must be "bun-ts" or "python"`);
  }
  if (typeof parsed.design !== 'boolean') {
    throw new Error(`standards.json design must be a boolean`);
  }
  if (parsed.design && (typeof parsed.tokensCss !== 'string' || parsed.tokensCss.length === 0)) {
    throw new Error(`standards.json tokensCss is required when design is true`);
  }
  return parsed;
}

export function formatIssue(issue: CheckIssue): string {
  return `${issue.file}:${issue.line}: ${issue.message}`;
}
