import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type { CheckIssue } from './paths.ts';
import { isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx']);

const DEFAULT_HTTP_CLIENT_SUFFIXES = [
  '/lib/api',
  '/shared/lib/api',
  '/api/http',
  '/api/client',
] as const;

type HttpClientImportScanOptions = {
  projectRoot: string;
  httpClientModule?: string;
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

function isUnderFeatures(relativePath: string): boolean {
  return /(?:^|\/)features\//.test(normalizeSlashes(relativePath));
}

function isQueriesOrServicesPath(relativePath: string): boolean {
  return /\/features\/(?:.+\/)?(?:queries|services)\//.test(normalizeSlashes(relativePath));
}

function isSkippedPath(relativePath: string): boolean {
  const file = normalizeSlashes(relativePath);
  return file === 'scripts' || file.startsWith('scripts/') || file.includes('/scripts/');
}

function normalizeImportSource(source: string): string {
  return normalizeSlashes(source)
    .replace(/^@\//, '')
    .replace(/\.(?:ts|tsx|js|jsx|mjs|cjs)$/, '');
}

function isHttpClientSource(source: string, extraModule?: string): boolean {
  const cleaned = normalizeImportSource(source);
  const candidates = [
    ...DEFAULT_HTTP_CLIENT_SUFFIXES,
    ...(extraModule
      ? ([`/${normalizeSlashes(extraModule).replace(/^\/+/, '').replace(/\/+$/, '')}`] as const)
      : []),
  ];
  for (const suffix of candidates) {
    if (cleaned === suffix.slice(1) || cleaned.endsWith(suffix)) return true;
  }
  return false;
}

function importSourceFromNode(node: Record<string, unknown>): string | null {
  if (node.type === 'ImportDeclaration') {
    const source = node.source as { type?: string; value?: unknown } | undefined;
    if (source?.type === 'Literal' && typeof source.value === 'string') return source.value;
    return null;
  }
  if (node.type === 'ImportExpression') {
    const source = node.source as { type?: string; value?: unknown } | undefined;
    if (source?.type === 'Literal' && typeof source.value === 'string') return source.value;
    return null;
  }
  if (node.type === 'CallExpression') {
    const callee = node.callee as { type?: string; name?: string } | undefined;
    if (callee?.type !== 'Identifier' || callee.name !== 'require') return null;
    const args = (node.arguments as unknown[]) ?? [];
    const first = args[0] as { type?: string; value?: unknown } | undefined;
    if (first?.type === 'Literal' && typeof first.value === 'string') return first.value;
  }
  return null;
}

function reexportSourceFromNode(node: Record<string, unknown>): string | null {
  if (node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportAllDeclaration') {
    return null;
  }
  const source = node.source as { type?: string; value?: unknown } | undefined;
  if (source?.type === 'Literal' && typeof source.value === 'string') return source.value;
  return null;
}

function checkFile(
  absolutePath: string,
  projectRoot: string,
  text: string,
  httpClientModule?: string
): CheckIssue[] {
  const relativePath = toRelative(projectRoot, absolutePath);
  if (!isUnderFeatures(relativePath)) return [];
  const allowHttpClientImport = isQueriesOrServicesPath(relativePath);
  const issues: CheckIssue[] = [];
  const result = parseSync(absolutePath, text, { lang: langFor(absolutePath) });
  walkAst(result.program, (node) => {
    const reexportSource = reexportSourceFromNode(node);
    if (reexportSource !== null && isHttpClientSource(reexportSource, httpClientModule)) {
      issues.push({
        file: relativePath,
        line: lineOf(text, (node.start as number) ?? 0),
        message: 'features must not re-export the HTTP client module',
      });
      return;
    }
    if (allowHttpClientImport) return;
    const source = importSourceFromNode(node);
    if (source === null) return;
    if (!isHttpClientSource(source, httpClientModule)) return;
    issues.push({
      file: relativePath,
      line: lineOf(text, (node.start as number) ?? 0),
      message: 'features must import queries/services, never the HTTP client module',
    });
  });
  return issues;
}

export function checkHttpClientImports(options: HttpClientImportScanOptions): CheckIssue[] {
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: TS_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];
  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTestLikePath(relativePath)) continue;
    if (isSkippedPath(relativePath)) continue;
    const text = fs.readFileSync(absolutePath, 'utf8');
    issues.push(...checkFile(absolutePath, options.projectRoot, text, options.httpClientModule));
  }
  return issues;
}
