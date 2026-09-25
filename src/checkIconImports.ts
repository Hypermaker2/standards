import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type { CheckIssue } from './paths.ts';
import { isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx']);
const ICON_PACKAGES = [
  'lucide-react',
  'react-icons',
  '@radix-ui/react-icons',
  '@tabler/icons-react',
] as const;
const ICON_PACKAGE_PREFIXES = ['@phosphor-icons/', '@heroicons/'] as const;

type IconImportScanOptions = {
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

function isIconsModulePath(relativePath: string): boolean {
  return /(?:^|\/)components\/icons(?:\/|$)/.test(normalizeSlashes(relativePath));
}

function isSkippedPath(relativePath: string): boolean {
  const file = normalizeSlashes(relativePath);
  return file === 'scripts' || file.startsWith('scripts/') || file.includes('/scripts/');
}

function isIconPackage(source: string): boolean {
  if ((ICON_PACKAGES as readonly string[]).includes(source)) return true;
  return ICON_PACKAGE_PREFIXES.some(
    (prefix) => source === prefix.slice(0, -1) || source.startsWith(prefix)
  );
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
  return null;
}

function checkFile(absolutePath: string, projectRoot: string, text: string): CheckIssue[] {
  const relativePath = toRelative(projectRoot, absolutePath);
  if (isIconsModulePath(relativePath)) return [];
  const issues: CheckIssue[] = [];
  const result = parseSync(absolutePath, text, { lang: langFor(absolutePath) });
  walkAst(result.program, (node) => {
    const source = importSourceFromNode(node);
    if (source === null) return;
    if (!isIconPackage(source)) return;
    issues.push({
      file: relativePath,
      line: lineOf(text, (node.start as number) ?? 0),
      message: 'icon packages must be imported only from the local icons module',
    });
  });
  return issues;
}

export function checkIconImports(options: IconImportScanOptions): CheckIssue[] {
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
    issues.push(...checkFile(absolutePath, options.projectRoot, text));
  }
  return issues;
}
