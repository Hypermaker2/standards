import fs from 'node:fs';
import type { CheckIssue } from './paths.ts';
import { isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx']);

const USE_EFFECT_PATTERN = new RegExp('\\b' + 'use' + 'Effect' + '\\b');

type UseEffectScanOptions = {
  projectRoot: string;
  effectWrappers?: string[];
};

export function checkUseEffect(options: UseEffectScanOptions): CheckIssue[] {
  const allowed = new Set(options.effectWrappers ?? []);
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: TS_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];
  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTestLikePath(relativePath)) continue;
    if (allowed.has(relativePath)) continue;
    const lines = fs.readFileSync(absolutePath, 'utf8').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      if (!USE_EFFECT_PATTERN.test(lines[index])) continue;
      issues.push({
        file: relativePath,
        line: index + 1,
        message: 'direct React effect hook is only allowed in effectWrappers',
      });
    }
  }
  return issues;
}
