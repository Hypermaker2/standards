import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type { CheckIssue } from './paths.ts';
import { isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx']);
const RAW_COLOR_PATTERN =
  /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:hsl|hsla|oklch|rgb|rgba)\s*\(/;

type RawColorScanOptions = {
  projectRoot: string;
  tokensCss?: string;
};

function langFor(filePath: string): 'ts' | 'tsx' {
  return path.extname(filePath) === '.tsx' ? 'tsx' : 'ts';
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function walkAst(node: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const entry of node) walkAst(entry, visit);
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.type === 'string') visit(record);
  for (const value of Object.values(record)) walkAst(value, visit);
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/');
}

function isIconsModulePath(relativePath: string): boolean {
  return /(?:^|\/)components\/icons(?:\/|$)/.test(normalizeSlashes(relativePath));
}

function isTokensCssPath(relativePath: string, tokensCss?: string): boolean {
  const file = normalizeSlashes(relativePath);
  if (tokensCss && file === normalizeSlashes(tokensCss)) return true;
  return /(?:^|\/)tokens\.css$/.test(file);
}

function isGovernedPath(relativePath: string): boolean {
  const file = normalizeSlashes(relativePath);
  return /(?:^|\/)(?:features|components)\//.test(file);
}

function isSkippedPath(relativePath: string): boolean {
  const file = normalizeSlashes(relativePath);
  return file === 'scripts' || file.startsWith('scripts/') || file.includes('/scripts/');
}

function stringLiteralValue(node: Record<string, unknown>): string | null {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') {
    const quasis = node.quasis as Array<{ value?: { cooked?: string | null } }> | undefined;
    const expressions = (node.expressions as unknown[]) ?? [];
    if (expressions.length > 0) {
      const parts: string[] = [];
      for (const quasi of quasis ?? []) {
        const cooked = quasi.value?.cooked;
        if (typeof cooked === 'string') parts.push(cooked);
      }
      return parts.join(' ');
    }
    const cooked = quasis?.[0]?.value?.cooked;
    return typeof cooked === 'string' ? cooked : null;
  }
  return null;
}

function checkFile(absolutePath: string, projectRoot: string, text: string): CheckIssue[] {
  const relativePath = toRelative(projectRoot, absolutePath);
  const issues: CheckIssue[] = [];
  const result = parseSync(absolutePath, text, { lang: langFor(absolutePath) });
  walkAst(result.program, (node) => {
    const value = stringLiteralValue(node);
    if (value === null) return;
    if (!RAW_COLOR_PATTERN.test(value)) return;
    issues.push({
      file: relativePath,
      line: lineOf(text, (node.start as number) ?? 0),
      message: 'raw color literal is not allowed; use semantic token utilities',
    });
  });
  return issues;
}

export function checkRawColors(options: RawColorScanOptions): CheckIssue[] {
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: TS_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];
  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTestLikePath(relativePath)) continue;
    if (isSkippedPath(relativePath)) continue;
    if (!isGovernedPath(relativePath)) continue;
    if (isIconsModulePath(relativePath)) continue;
    if (isTokensCssPath(relativePath, options.tokensCss)) continue;
    const text = fs.readFileSync(absolutePath, 'utf8');
    issues.push(...checkFile(absolutePath, options.projectRoot, text));
  }
  return issues;
}
