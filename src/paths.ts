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
  fallbackExempt?: string[];
  configModules?: string[];
  envReadExempt?: string[];
  effectWrappers?: string[];
  tscAllowed?: string[];
  ci?: boolean;
  projectLayerMaxLines?: {
    agents?: number;
    design?: number;
  };
};

export type CheckIssue = {
  file: string;
  line: number;
  message: string;
};

export function packageVersion(): string {
  const raw = fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8');
  const parsed = JSON.parse(raw) as { version: string };
  return parsed.version;
}

export function readPackageText(relativePath: string): string {
  return fs.readFileSync(path.join(PACKAGE_ROOT, relativePath), 'utf8');
}

function optionalStringArray(value: unknown, key: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`standards.json ${key} must be an array of strings`);
  }
  return value as string[];
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
  if (parsed.ci !== undefined && typeof parsed.ci !== 'boolean') {
    throw new Error(`standards.json ci must be a boolean`);
  }
  const projectLayerMaxLines = parseProjectLayerMaxLines(parsed.projectLayerMaxLines);
  return {
    ...parsed,
    commentExempt: optionalStringArray(parsed.commentExempt, 'commentExempt'),
    extraRoles: optionalStringArray(parsed.extraRoles, 'extraRoles'),
    fallbackExempt: optionalStringArray(parsed.fallbackExempt, 'fallbackExempt'),
    configModules: optionalStringArray(parsed.configModules, 'configModules'),
    envReadExempt: optionalStringArray(parsed.envReadExempt, 'envReadExempt'),
    effectWrappers: optionalStringArray(parsed.effectWrappers, 'effectWrappers'),
    tscAllowed: optionalStringArray(parsed.tscAllowed, 'tscAllowed'),
    projectLayerMaxLines,
  };
}

function parseProjectLayerMaxLines(
  value: unknown
): StandardsConfig['projectLayerMaxLines'] | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('standards.json projectLayerMaxLines must be an object');
  }
  const record = value as Record<string, unknown>;
  const result: { agents?: number; design?: number } = {};
  if (record.agents !== undefined) {
    if (
      typeof record.agents !== 'number' ||
      !Number.isInteger(record.agents) ||
      record.agents < 1
    ) {
      throw new Error('standards.json projectLayerMaxLines.agents must be a positive integer');
    }
    result.agents = record.agents;
  }
  if (record.design !== undefined) {
    if (
      typeof record.design !== 'number' ||
      !Number.isInteger(record.design) ||
      record.design < 1
    ) {
      throw new Error('standards.json projectLayerMaxLines.design must be a positive integer');
    }
    result.design = record.design;
  }
  return result;
}

export function formatIssue(issue: CheckIssue): string {
  return `${issue.file}:${issue.line}: ${issue.message}`;
}
