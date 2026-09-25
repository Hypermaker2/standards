import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type { CheckIssue } from './paths.ts';
import { isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const ARBITRARY_SHADOW = /(?:^|[\s"'`:])(?:!)?(?:[a-z0-9-[\]()]+:)*shadow-\[[^\]]+\]/;
const BOX_SHADOW_DECL = /\bbox-shadow\s*:/i;

type ShadowScanOptions = {
  projectRoot: string;
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

function isFeaturePath(relativePath: string): boolean {
  return /(?:^|\/)features\//.test(normalizeSlashes(relativePath));
}

function isSkippedPath(relativePath: string): boolean {
  const file = normalizeSlashes(relativePath);
  return file === 'scripts' || file.startsWith('scripts/') || file.includes('/scripts/');
}

function stringLiteralValue(node: Record<string, unknown>): string | null {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') {
    const quasis = node.quasis as Array<{ value?: { cooked?: string | null } }> | undefined;
    const parts: string[] = [];
    for (const quasi of quasis ?? []) {
      const cooked = quasi.value?.cooked;
      if (typeof cooked === 'string') parts.push(cooked);
    }
    return parts.length > 0 ? parts.join(' ') : null;
  }
  return null;
}

function checkCssFile(relativePath: string, text: string): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (BOX_SHADOW_DECL.test(line)) {
      issues.push({
        file: relativePath,
        line: index + 1,
        message: 'raw box-shadow is not allowed in feature CSS; use token-backed shadow utilities',
      });
    }
    if (ARBITRARY_SHADOW.test(line)) {
      issues.push({
        file: relativePath,
        line: index + 1,
        message: 'arbitrary shadow-[...] utilities are not allowed in feature code',
      });
    }
  }
  return issues;
}

function isBoxShadowKey(node: Record<string, unknown>): boolean {
  if (node.type !== 'Property' && node.type !== 'PropertyDefinition') return false;
  const key = node.key as { type?: string; name?: string; value?: unknown } | undefined;
  if (key?.type === 'Identifier' && key.name === 'boxShadow') return true;
  if (key?.type === 'Literal' && key.value === 'boxShadow') return true;
  return false;
}

function checkTsFile(absolutePath: string, relativePath: string, text: string): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const result = parseSync(absolutePath, text, { lang: langFor(absolutePath) });
  walkAst(result.program, (node) => {
    if (isBoxShadowKey(node)) {
      issues.push({
        file: relativePath,
        line: lineOf(text, (node.start as number) ?? 0),
        message: 'inline boxShadow is not allowed in feature code',
      });
      return;
    }
    const value = stringLiteralValue(node);
    if (value === null) return;
    if (!ARBITRARY_SHADOW.test(value)) return;
    issues.push({
      file: relativePath,
      line: lineOf(text, (node.start as number) ?? 0),
      message: 'arbitrary shadow-[...] utilities are not allowed in feature code',
    });
  });
  return issues;
}

export function checkShadows(options: ShadowScanOptions): CheckIssue[] {
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: SOURCE_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];
  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTestLikePath(relativePath)) continue;
    if (isSkippedPath(relativePath)) continue;
    if (!isFeaturePath(relativePath)) continue;
    const text = fs.readFileSync(absolutePath, 'utf8');
    if (path.extname(relativePath) === '.css') {
      issues.push(...checkCssFile(relativePath, text));
      continue;
    }
    issues.push(...checkTsFile(absolutePath, relativePath, text));
  }
  return issues;
}
