import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';
import type { CheckIssue } from './paths.ts';
import { isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx']);

type SkeletonScanOptions = {
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

function checkFile(absolutePath: string, projectRoot: string, text: string): CheckIssue[] {
  const relativePath = toRelative(projectRoot, absolutePath);
  const issues: CheckIssue[] = [];
  const result = parseSync(absolutePath, text, { lang: langFor(absolutePath) });

  walkAst(result.program, (node) => {
    if (node.type === 'ImportSpecifier' || node.type === 'ExportSpecifier') {
      const imported = node.imported as { type?: string; name?: string } | undefined;
      const local = node.local as { type?: string; name?: string } | undefined;
      const name =
        imported?.type === 'Identifier'
          ? imported.name
          : local?.type === 'Identifier'
            ? local.name
            : undefined;
      if (name === 'Skeleton') {
        issues.push({
          file: relativePath,
          line: lineOf(text, (node.start as number) ?? 0),
          message: 'Skeleton import is not allowed; show cached data or the real shell',
        });
      }
    }
    if (node.type === 'JSXOpeningElement') {
      const nameNode = node.name as { type?: string; name?: string } | undefined;
      if (nameNode?.type === 'JSXIdentifier' && nameNode.name === 'Skeleton') {
        issues.push({
          file: relativePath,
          line: lineOf(text, (node.start as number) ?? 0),
          message: '<Skeleton> is not allowed; show cached data or the real shell',
        });
      }
    }
    if (node.type === 'JSXAttribute') {
      const attrName = node.name as { type?: string; name?: string } | undefined;
      if (attrName?.type === 'JSXIdentifier' && attrName.name === 'data-slot') {
        const value = node.value as { type?: string; value?: unknown } | undefined;
        if (value?.type === 'Literal' && value.value === 'skeleton') {
          issues.push({
            file: relativePath,
            line: lineOf(text, (node.start as number) ?? 0),
            message: 'data-slot="skeleton" is not allowed',
          });
        }
      }
    }
    if (node.type === 'Literal' && typeof node.value === 'string') {
      if (/\banimate-pulse\b/.test(node.value)) {
        issues.push({
          file: relativePath,
          line: lineOf(text, (node.start as number) ?? 0),
          message: 'animate-pulse placeholder is not allowed',
        });
      }
    }
    if (node.type === 'TemplateElement') {
      const cooked = (node.value as { cooked?: string | null } | undefined)?.cooked;
      if (typeof cooked === 'string' && /\banimate-pulse\b/.test(cooked)) {
        issues.push({
          file: relativePath,
          line: lineOf(text, (node.start as number) ?? 0),
          message: 'animate-pulse placeholder is not allowed',
        });
      }
    }
  });

  return issues;
}

export function checkNoSkeletons(options: SkeletonScanOptions): CheckIssue[] {
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: TS_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];
  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTestLikePath(relativePath)) continue;
    const text = fs.readFileSync(absolutePath, 'utf8');
    issues.push(...checkFile(absolutePath, options.projectRoot, text));
  }
  return issues;
}
