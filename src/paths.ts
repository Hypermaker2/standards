import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export type Profile = 'bun-ts' | 'python';

export type ProfileEntry = {
  profile: Profile;
  root: string;
  design?: boolean;
  tokensCss?: string;
  commentExempt?: string[];
  extraRoles?: string[];
  fallbackExempt?: string[];
  configModules?: string[];
  envReadExempt?: string[];
  effectWrappers?: string[];
  tscAllowed?: string[];
};

export type StandardsConfig = {
  profiles: ProfileEntry[];
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

function normalizeRoot(root: string): string {
  if (root === '.' || root === './' || root === '') return '.';
  return root.replace(/^\.\//, '').replace(/\/$/, '');
}

function parseProfileEntry(value: unknown, index: number): ProfileEntry {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`standards.json profiles[${index}] must be an object`);
  }
  const record = value as Record<string, unknown>;
  if (record.profile !== 'bun-ts' && record.profile !== 'python') {
    throw new Error(`standards.json profiles[${index}].profile must be "bun-ts" or "python"`);
  }
  if (typeof record.root !== 'string' || record.root.length === 0) {
    throw new Error(`standards.json profiles[${index}].root must be a non-empty string`);
  }
  if (record.design !== undefined && typeof record.design !== 'boolean') {
    throw new Error(`standards.json profiles[${index}].design must be a boolean`);
  }
  if (record.tokensCss !== undefined && typeof record.tokensCss !== 'string') {
    throw new Error(`standards.json profiles[${index}].tokensCss must be a string`);
  }
  return {
    profile: record.profile,
    root: normalizeRoot(record.root),
    design: record.design,
    tokensCss: record.tokensCss,
    commentExempt: optionalStringArray(record.commentExempt, `profiles[${index}].commentExempt`),
    extraRoles: optionalStringArray(record.extraRoles, `profiles[${index}].extraRoles`),
    fallbackExempt: optionalStringArray(record.fallbackExempt, `profiles[${index}].fallbackExempt`),
    configModules: optionalStringArray(record.configModules, `profiles[${index}].configModules`),
    envReadExempt: optionalStringArray(record.envReadExempt, `profiles[${index}].envReadExempt`),
    effectWrappers: optionalStringArray(record.effectWrappers, `profiles[${index}].effectWrappers`),
    tscAllowed: optionalStringArray(record.tscAllowed, `profiles[${index}].tscAllowed`),
  };
}

export function profileMarker(profiles: ProfileEntry[]): string {
  if (profiles.length === 1) return profiles[0].profile;
  return profiles.map((entry) => entry.profile).join('+');
}

export function profileAbsoluteRoot(projectRoot: string, entry: ProfileEntry): string {
  if (entry.root === '.') return projectRoot;
  return path.join(projectRoot, entry.root);
}

function prefixIssuePath(root: string, relativePath: string): string {
  if (root === '.') return relativePath;
  return path.join(root, relativePath);
}

export function rebaseIssues(issues: CheckIssue[], root: string): CheckIssue[] {
  if (root === '.') return issues;
  return issues.map((issue) => ({
    ...issue,
    file: prefixIssuePath(root, issue.file),
  }));
}

export function loadStandardsConfig(projectRoot: string): StandardsConfig {
  const configPath = path.join(projectRoot, 'standards.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `standards.json not found in ${projectRoot}. Run: standards sync --init --profile bun-ts`
    );
  }
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  if (raw.ci !== undefined && typeof raw.ci !== 'boolean') {
    throw new Error(`standards.json ci must be a boolean`);
  }

  let profiles: ProfileEntry[];
  if (raw.profiles !== undefined) {
    if (!Array.isArray(raw.profiles) || raw.profiles.length === 0) {
      throw new Error(`standards.json profiles must be a non-empty array`);
    }
    profiles = raw.profiles.map((entry, index) => parseProfileEntry(entry, index));
    const roots = new Set<string>();
    for (const entry of profiles) {
      if (roots.has(entry.root)) {
        throw new Error(`standards.json profiles has duplicate root "${entry.root}"`);
      }
      roots.add(entry.root);
    }
  } else {
    if (raw.profile !== 'bun-ts' && raw.profile !== 'python') {
      throw new Error(`standards.json profile must be "bun-ts" or "python"`);
    }
    if (typeof raw.design !== 'boolean') {
      throw new Error(`standards.json design must be a boolean`);
    }
    profiles = [
      {
        profile: raw.profile,
        root: '.',
        design: raw.design,
        tokensCss: typeof raw.tokensCss === 'string' ? raw.tokensCss : undefined,
        commentExempt: optionalStringArray(raw.commentExempt, 'commentExempt'),
        extraRoles: optionalStringArray(raw.extraRoles, 'extraRoles'),
        fallbackExempt: optionalStringArray(raw.fallbackExempt, 'fallbackExempt'),
        configModules: optionalStringArray(raw.configModules, 'configModules'),
        envReadExempt: optionalStringArray(raw.envReadExempt, 'envReadExempt'),
        effectWrappers: optionalStringArray(raw.effectWrappers, 'effectWrappers'),
        tscAllowed: optionalStringArray(raw.tscAllowed, 'tscAllowed'),
      },
    ];
  }

  const topDesign = raw.design === true || profiles.some((entry) => entry.design === true);
  const topTokens =
    typeof raw.tokensCss === 'string'
      ? raw.tokensCss
      : profiles.find((entry) => typeof entry.tokensCss === 'string')?.tokensCss;

  if (topDesign && (typeof topTokens !== 'string' || topTokens.length === 0)) {
    throw new Error(`standards.json tokensCss is required when design is true`);
  }

  return {
    profiles,
    design: topDesign,
    tokensCss: topTokens,
    commentExempt: optionalStringArray(raw.commentExempt, 'commentExempt'),
    extraRoles: optionalStringArray(raw.extraRoles, 'extraRoles'),
    fallbackExempt: optionalStringArray(raw.fallbackExempt, 'fallbackExempt'),
    configModules: optionalStringArray(raw.configModules, 'configModules'),
    envReadExempt: optionalStringArray(raw.envReadExempt, 'envReadExempt'),
    effectWrappers: optionalStringArray(raw.effectWrappers, 'effectWrappers'),
    tscAllowed: optionalStringArray(raw.tscAllowed, 'tscAllowed'),
    ci: raw.ci === true ? true : raw.ci === false ? false : undefined,
    projectLayerMaxLines: parseProjectLayerMaxLines(raw.projectLayerMaxLines),
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

export function resolveTokensCss(
  projectRoot: string,
  config: StandardsConfig
): { absolutePath: string; relativePath: string } {
  const designProfile = config.profiles.find((entry) => entry.design === true && entry.tokensCss);
  if (designProfile?.tokensCss) {
    const relativePath = prefixIssuePath(designProfile.root, designProfile.tokensCss);
    return {
      relativePath,
      absolutePath: path.join(projectRoot, relativePath),
    };
  }
  if (!config.tokensCss) {
    throw new Error('tokensCss is required when design is true');
  }
  return {
    relativePath: config.tokensCss,
    absolutePath: path.join(projectRoot, config.tokensCss),
  };
}
