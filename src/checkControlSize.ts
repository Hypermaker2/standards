import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type { CheckIssue } from './paths.ts';
import { isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx']);
const DEFAULT_UI_ROOT = 'frontend/src/shared/components/ui';
const CONTROL_COMPONENT_NAMES = new Set(['Button', 'IconButton']);
const HEIGHT_TOKEN = /(?:^|[\s"'`])(?:h|min-h|max-h|size)-[A-Za-z0-9_[\]().%/,:-]+/g;
const CLASS_HELPERS = new Set(['cn', 'clsx', 'cva']);

type ControlSizeScanOptions = {
  projectRoot: string;
  uiRoot?: string;
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

function isUnderUiRoot(relativePath: string, uiRoot: string): boolean {
  const file = normalizeSlashes(relativePath);
  const root = normalizeSlashes(uiRoot);
  return file === root || file.startsWith(`${root}/`);
}

function isUiImportSource(source: string, uiRoot: string): boolean {
  const cleaned = normalizeSlashes(source).replace(/^@\//, '').replace(/^\.\//, '');
  const root = normalizeSlashes(uiRoot);
  const suffix = root.replace(/^frontend\/src\//, '');
  if (cleaned === root || cleaned.startsWith(`${root}/`)) return true;
  if (cleaned === suffix || cleaned.startsWith(`${suffix}/`)) return true;
  const marker = 'shared/components/ui';
  const index = cleaned.lastIndexOf(marker);
  if (index === -1) return false;
  const rest = cleaned.slice(index);
  return rest === marker || rest.startsWith(`${marker}/`);
}

function classNameHeightHits(classBlob: string): string[] {
  const hits: string[] = [];
  for (const match of classBlob.matchAll(HEIGHT_TOKEN)) {
    const token = match[0].trim().replace(/^['"`]/, '');
    if (token.includes('[&_svg]:')) continue;
    if (token.startsWith('[&_svg]:')) continue;
    const bare = token.replace(/^["'`]/, '');
    if (/^(?:h|min-h|max-h|size)-/.test(bare)) hits.push(bare);
  }
  return hits;
}

function collectStringLiterals(node: unknown, out: string[]): void {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const entry of node) collectStringLiterals(entry, out);
    return;
  }
  const record = node as Record<string, unknown>;
  if (record.type === 'Literal' && typeof record.value === 'string') {
    out.push(record.value);
    return;
  }
  if (record.type === 'TemplateLiteral') {
    const quasis = record.quasis as Array<{ value?: { cooked?: string | null } }> | undefined;
    for (const quasi of quasis ?? []) {
      const cooked = quasi.value?.cooked;
      if (typeof cooked === 'string') out.push(cooked);
    }
    const expressions = record.expressions as unknown[] | undefined;
    for (const expression of expressions ?? []) collectStringLiterals(expression, out);
    return;
  }
  if (record.type === 'CallExpression') {
    const callee = record.callee as { type?: string; name?: string } | undefined;
    if (callee?.type === 'Identifier' && CLASS_HELPERS.has(callee.name ?? '')) {
      for (const arg of (record.arguments as unknown[]) ?? []) {
        collectStringLiterals(arg, out);
      }
      return;
    }
  }
  if (record.type === 'JSXExpressionContainer') {
    collectStringLiterals(record.expression, out);
    return;
  }
  for (const value of Object.values(record)) collectStringLiterals(value, out);
}

function classNameBlobFromAttribute(attr: Record<string, unknown>): string {
  const strings: string[] = [];
  collectStringLiterals(attr.value, strings);
  return strings.join(' ');
}

function jsxElementName(nameNode: unknown): string | null {
  if (nameNode === null || typeof nameNode !== 'object') return null;
  const record = nameNode as { type?: string; name?: string };
  if (record.type === 'JSXIdentifier' && typeof record.name === 'string') return record.name;
  return null;
}

function collectUiControlLocalNames(program: unknown, uiRoot: string): Set<string> {
  const names = new Set<string>();
  walkAst(program, (node) => {
    if (node.type !== 'ImportDeclaration') return;
    const source = node.source as { type?: string; value?: unknown } | undefined;
    if (source?.type !== 'Literal' || typeof source.value !== 'string') return;
    if (!isUiImportSource(source.value, uiRoot)) return;
    for (const specifier of (node.specifiers as Record<string, unknown>[]) ?? []) {
      if (specifier.type === 'ImportSpecifier') {
        const imported = specifier.imported as { type?: string; name?: string } | undefined;
        const local = specifier.local as { type?: string; name?: string } | undefined;
        const importedName =
          imported?.type === 'Identifier' && typeof imported.name === 'string'
            ? imported.name
            : undefined;
        const localName =
          local?.type === 'Identifier' && typeof local.name === 'string' ? local.name : undefined;
        if (importedName && localName && CONTROL_COMPONENT_NAMES.has(importedName)) {
          names.add(localName);
        }
      }
      if (specifier.type === 'ImportDefaultSpecifier') {
        const local = specifier.local as { type?: string; name?: string } | undefined;
        if (
          local?.type === 'Identifier' &&
          typeof local.name === 'string' &&
          CONTROL_COMPONENT_NAMES.has(local.name)
        ) {
          names.add(local.name);
        }
      }
    }
  });
  return names;
}

function checkFile(
  absolutePath: string,
  projectRoot: string,
  text: string,
  uiRoot: string
): CheckIssue[] {
  const relativePath = toRelative(projectRoot, absolutePath);
  if (isUnderUiRoot(relativePath, uiRoot)) return [];
  const issues: CheckIssue[] = [];
  const result = parseSync(absolutePath, text, { lang: langFor(absolutePath) });
  const uiNames = collectUiControlLocalNames(result.program, uiRoot);

  walkAst(result.program, (node) => {
    if (node.type !== 'JSXOpeningElement') return;
    const elementName = jsxElementName(node.name);
    if (elementName === null) return;
    const start = (node.start as number) ?? 0;
    if (elementName === 'button') {
      issues.push({
        file: relativePath,
        line: lineOf(text, start),
        message: 'raw <button>; use shared UI primitives from the UI root',
      });
      return;
    }
    if (!uiNames.has(elementName)) return;
    const attributes = (node.attributes as Record<string, unknown>[]) ?? [];
    for (const attr of attributes) {
      if (attr.type !== 'JSXAttribute') continue;
      const attrName = attr.name as { type?: string; name?: string } | undefined;
      if (attrName?.type !== 'JSXIdentifier' || attrName.name !== 'className') continue;
      const hits = classNameHeightHits(classNameBlobFromAttribute(attr));
      if (hits.length === 0) continue;
      issues.push({
        file: relativePath,
        line: lineOf(text, start),
        message: `${elementName} className overrides control height (${hits.join(', ')})`,
      });
    }
  });

  return issues;
}

export function checkControlSize(options: ControlSizeScanOptions): CheckIssue[] {
  const uiRoot = options.uiRoot ?? DEFAULT_UI_ROOT;
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: TS_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];
  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTestLikePath(relativePath)) continue;
    const text = fs.readFileSync(absolutePath, 'utf8');
    issues.push(...checkFile(absolutePath, options.projectRoot, text, uiRoot));
  }
  return issues;
}
