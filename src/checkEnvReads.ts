import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';
import {
  isAlwaysExemptEnvPath,
  isExemptPath,
  listProjectFiles,
  toRelative,
} from './projectFiles.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);

const PROCESS_ENV = 'process' + '.' + 'env';
const IMPORT_META_ENV = 'import' + '.meta.' + 'env';

function envObjectToken(name: string): string {
  return name.replaceAll('.', String.raw`\.`) + String.raw`(?!\s*(?:\?\.|[.\[]))`;
}

const ENV_READ_PATTERN = new RegExp(
  String.raw`\b` +
    PROCESS_ENV.replace('.', String.raw`\.`) +
    String.raw`\b|\b` +
    IMPORT_META_ENV.replaceAll('.', String.raw`\.`) +
    String.raw`\b`
);

const PROCESS_ENV_OBJECT = envObjectToken(PROCESS_ENV);
const IMPORT_META_ENV_OBJECT = envObjectToken(IMPORT_META_ENV);

const LAUNDER_PATTERNS: { regex: RegExp; message: string }[] = [
  {
    regex: new RegExp(String.raw`\breturn\s+` + PROCESS_ENV_OBJECT),
    message: 'config module must not return the raw environment object',
  },
  {
    regex: new RegExp(String.raw`\breturn\s+` + IMPORT_META_ENV_OBJECT),
    message: 'config module must not return the raw environment object',
  },
  {
    regex: new RegExp(String.raw`\bexport\s+(?:const|let|var)\s+\w+\s*=\s*` + PROCESS_ENV_OBJECT),
    message: 'config module must not export an alias of the raw environment object',
  },
  {
    regex: new RegExp(
      String.raw`\bexport\s+(?:const|let|var)\s+\w+\s*=\s*` + IMPORT_META_ENV_OBJECT
    ),
    message: 'config module must not export an alias of the raw environment object',
  },
  {
    regex: new RegExp(String.raw`=>\s*` + PROCESS_ENV_OBJECT),
    message: 'config module must not return the raw environment object',
  },
  {
    regex: new RegExp(String.raw`=>\s*` + IMPORT_META_ENV_OBJECT),
    message: 'config module must not return the raw environment object',
  },
  {
    regex: new RegExp(String.raw`\.\.\.\s*` + PROCESS_ENV_OBJECT),
    message: 'config module must not spread the raw environment object',
  },
  {
    regex: new RegExp(String.raw`\.\.\.\s*` + IMPORT_META_ENV_OBJECT),
    message: 'config module must not spread the raw environment object',
  },
];

type EnvReadScanOptions = {
  projectRoot: string;
  configModules?: string[];
  envReadExempt?: string[];
};

function checkConfigModuleLaundering(relativePath: string, text: string): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of LAUNDER_PATTERNS) {
      if (!pattern.regex.test(line)) continue;
      issues.push({
        file: relativePath,
        line: index + 1,
        message: pattern.message,
      });
    }
  }
  return issues;
}

export function checkEnvReads(options: EnvReadScanOptions): CheckIssue[] {
  const configModules = options.configModules;
  const exempt = options.envReadExempt ?? [];
  const allowed = new Set(configModules ?? []);
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: TS_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];
  let sawRuntimeRead = false;

  if (configModules !== undefined) {
    for (const relativePath of configModules) {
      const absolutePath = path.join(options.projectRoot, relativePath);
      if (!fs.existsSync(absolutePath)) {
        issues.push({
          file: relativePath,
          line: 1,
          message: 'configModules path not found',
        });
        continue;
      }
      const text = fs.readFileSync(absolutePath, 'utf8');
      issues.push(...checkConfigModuleLaundering(relativePath, text));
    }
  }

  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isAlwaysExemptEnvPath(relativePath)) continue;
    if (isExemptPath(relativePath, exempt)) continue;
    if (allowed.has(relativePath)) continue;
    const lines = fs.readFileSync(absolutePath, 'utf8').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      if (!ENV_READ_PATTERN.test(lines[index])) continue;
      sawRuntimeRead = true;
      issues.push({
        file: relativePath,
        line: index + 1,
        message:
          configModules === undefined
            ? 'env read outside config; set configModules in standards.json'
            : 'env read only allowed in configModules',
      });
    }
  }

  if (configModules === undefined && !sawRuntimeRead) {
    return [];
  }
  return issues;
}
