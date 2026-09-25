import fs from 'node:fs';
import type { CheckIssue } from './paths.ts';
import { isExemptPath, isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx']);

const FALLBACK_PATTERNS: { regex: RegExp; message: string }[] = [
  { regex: /\|\|\s*\[\]/, message: 'runtime or-fallback to empty array is not allowed' },
  {
    regex: /\|\|\s*''/,
    message: 'runtime or-fallback to empty single-quoted string is not allowed',
  },
  {
    regex: /\|\|\s*""/,
    message: 'runtime or-fallback to empty double-quoted string is not allowed',
  },
  {
    regex: /\|\|\s*undefined\b/,
    message: 'runtime or-fallback to undefined is not allowed',
  },
];

type FallbackScanOptions = {
  projectRoot: string;
  fallbackExempt?: string[];
};

export function checkNoFallbacks(options: FallbackScanOptions): CheckIssue[] {
  const exempt = options.fallbackExempt ?? [];
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: TS_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];
  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTestLikePath(relativePath)) continue;
    if (isExemptPath(relativePath, exempt)) continue;
    const lines = fs.readFileSync(absolutePath, 'utf8').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const pattern of FALLBACK_PATTERNS) {
        if (!pattern.regex.test(line)) continue;
        issues.push({
          file: relativePath,
          line: index + 1,
          message: pattern.message,
        });
      }
    }
  }
  return issues;
}
