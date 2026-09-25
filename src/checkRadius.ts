import fs from 'node:fs';
import type { CheckIssue } from './paths.ts';
import { isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);

const SIDE = '(?:t|r|b|l|tl|tr|br|bl|x|y|s|e|ss|se|es|ee)';
const NUMERIC = '(?:xs|sm|md|lg|xl|2xl|3xl|4xl)';
const ROUND = 'round' + 'ed';

const FORBIDDEN_NUMERIC = new RegExp(`(?:^|[^a-z-])!?${ROUND}-(?:${SIDE}-)?${NUMERIC}\\b`);
const FORBIDDEN_ARBITRARY = new RegExp(`\\b!?${ROUND}-(?:[a-z]+-)?\\[[^\\]]+\\]`);
const FORBIDDEN_BARE = new RegExp(`(?:^|[^a-z-])!?${ROUND}(?:-${SIDE})?(?![\\w-])`);
const FORBIDDEN_VAR = /var\(--radius-(?:xs|sm|md|lg|xl|2xl|3xl|field)\)/;
const BORDER_RADIUS_DECL =
  /\bborder-(?:radius|(?:top|bottom)-(?:left|right)-radius|(?:start|end)-(?:start|end)-radius)\s*:\s*([^;]+)/gi;
const ALLOWED_RADIUS_VALUE =
  /^(?:0(?:px|rem|em|%)?|var\(--radius-(?:tight|control|inset|container|sheet|full|none)\))$/;

type RadiusScanOptions = {
  projectRoot: string;
};

function isAllowedBorderRadiusValue(value: string): boolean {
  const parts = value
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return false;
  return parts.every((part) => ALLOWED_RADIUS_VALUE.test(part));
}

export function checkRadius(options: RadiusScanOptions): CheckIssue[] {
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: SOURCE_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];
  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTestLikePath(relativePath)) continue;
    const lines = fs.readFileSync(absolutePath, 'utf8').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (FORBIDDEN_NUMERIC.test(line)) {
        issues.push({
          file: relativePath,
          line: index + 1,
          message:
            'numeric radius scale classes are not allowed; use role utilities (tight|control|inset|container|sheet|full|none)',
        });
      }
      if (FORBIDDEN_ARBITRARY.test(line)) {
        issues.push({
          file: relativePath,
          line: index + 1,
          message: 'arbitrary radius bracket values are not allowed',
        });
      }
      if (FORBIDDEN_BARE.test(line)) {
        issues.push({
          file: relativePath,
          line: index + 1,
          message: 'default radius utility is not allowed; use a radius role',
        });
      }
      if (FORBIDDEN_VAR.test(line)) {
        issues.push({
          file: relativePath,
          line: index + 1,
          message: 'use var(--radius-tight|control|inset|container|sheet|full|none)',
        });
      }
      for (const match of line.matchAll(BORDER_RADIUS_DECL)) {
        if (isAllowedBorderRadiusValue(match[1])) continue;
        issues.push({
          file: relativePath,
          line: index + 1,
          message: 'border-radius must use 0 or var(--radius-<role>)',
        });
      }
    }
  }
  return issues;
}
