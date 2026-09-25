import fs from 'node:fs';
import type { CheckIssue } from './paths.ts';
import {
  isAlwaysExemptEnvPath,
  isExemptPath,
  listProjectFiles,
  toRelative,
} from './projectFiles.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);

const ENV_READ_PATTERN = new RegExp(
  String.raw`\bprocess\.` + String.raw`env\b|\bimport\.meta\.` + String.raw`env\b`
);

type EnvReadScanOptions = {
  projectRoot: string;
  configModules?: string[];
  envReadExempt?: string[];
};

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
