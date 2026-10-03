import fs from 'node:fs';
import path from 'node:path';
import { parseSync, type Node, type Program } from 'oxc-parser';
import { listProjectFiles } from './projectFiles.ts';

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);

type TestFile = { file: string; text: string; program: Program };
export type TestInventory = { files: TestFile[]; lines: number; sourceLines: number };

export function walkNodes(value: unknown, visit: (node: Node) => void): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const entry of value) walkNodes(entry, visit);
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.type === 'string') visit(value as Node);
  for (const child of Object.values(record)) walkNodes(child, visit);
}

export function parseCode(file: string, text: string): Program {
  const extension = path.extname(file);
  const lang = /\.d\.(ts|mts|cts)$/.test(file)
    ? 'dts'
    : extension === '.tsx'
      ? 'tsx'
      : ['.ts', '.mts', '.cts'].includes(extension)
        ? 'ts'
        : 'jsx';
  const result = parseSync(file, text, { lang, preserveParens: false });
  if (result.errors.length > 0) {
    throw new Error(`${file}: ${result.errors.map((error) => error.message).join('; ')}`);
  }
  return result.program;
}

function nonblankLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function testPath(file: string): boolean {
  const normalized = file.replaceAll('\\', '/');
  if (/(^|\/)(__tests__|test|tests|testing|test-utils|test-helpers)(\/|$)/.test(normalized))
    return true;
  const name = path.basename(file);
  return (
    /\.(test|spec)\./.test(name) ||
    (CODE_EXTENSIONS.has(path.extname(file)) && /^(?:vitest[.-])?setup\./.test(name)) ||
    /(?:(?:test|integration).*?(?:Setup|Helpers?|Harness|Utils)|(?:setup|helpers?)[.-]tests?)\./i.test(
      name
    )
  );
}

export function collectTestFiles(projectRoot: string): TestInventory {
  const inventory: TestInventory = { files: [], lines: 0, sourceLines: 0 };
  const files = listProjectFiles({ projectRoot, extensions: undefined });
  for (const file of files) {
    const isCode = CODE_EXTENSIONS.has(path.extname(file));
    const isTest = testPath(path.relative(projectRoot, file));
    if (!isCode && !isTest) continue;
    const bytes = fs.readFileSync(file);
    if (bytes.includes(0)) continue;
    const text = bytes.toString('utf8');
    if (!isCode) {
      inventory.lines += nonblankLines(text);
      continue;
    }
    const program = parseCode(file, text);
    const importsVitest = program.body.some(
      (node) => node.type === 'ImportDeclaration' && node.source.value === 'vitest'
    );
    if (!isTest && !importsVitest) {
      inventory.sourceLines += nonblankLines(text);
      continue;
    }
    inventory.lines += nonblankLines(text);
    inventory.files.push({ file, text, program });
  }
  return inventory;
}
