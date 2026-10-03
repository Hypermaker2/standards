import fs from 'node:fs';
import path from 'node:path';
import type { Node } from 'oxc-parser';
import type { CheckIssue, TestBoundary } from './paths.ts';
import { checkTestBaseline } from './testBaseline.ts';
import { parseCode, walkNodes, type TestInventory } from './testFiles.ts';
import { TestModuleResolver } from './testModuleResolver.ts';

const DEFAULT_FAKE_TYPES = ['DbClient', 'PrismaClient', 'Database'];

function rootIdentifier(node: Node): string | undefined {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') return rootIdentifier(node.object);
  return undefined;
}

function memberName(node: Node): string | undefined {
  if (node.type !== 'MemberExpression') return undefined;
  if (node.property.type === 'Identifier' && !node.computed) return node.property.name;
  if (node.property.type === 'Literal' && typeof node.property.value === 'string')
    return node.property.value;
  return undefined;
}

function typeName(node: Node): string | undefined {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'TSQualifiedName') return node.right.name;
  if (node.type === 'TSTypeReference') return typeName(node.typeName);
  return undefined;
}

function databaseBoundary(file: string, module: string, fakeTypes: string[]): boolean {
  if (/(?:prisma|database|dbclient)|(?:^|[/@-])db(?:[/.-]|$)/i.test(module)) return true;
  if (!fs.statSync(file).isFile()) return false;
  if (!/\.[cm]?[jt]sx?$/.test(file)) return false;
  let found = false;
  const program = parseCode(file, fs.readFileSync(file, 'utf8'));
  walkNodes(program, (node) => {
    if (node.type === 'Identifier' && [...DEFAULT_FAKE_TYPES, ...fakeTypes].includes(node.name))
      found = true;
    if (
      node.type === 'ImportDeclaration' &&
      typeof node.source.value === 'string' &&
      /(?:prisma|database|dbclient)|(?:^|[/@-])db(?:[/.-]|$)/i.test(node.source.value)
    )
      found = true;
  });
  return found;
}

function spyOrigin(node: Node, spies: Map<string, Node>, seen = new Set<Node>()): Node | undefined {
  if (seen.has(node)) return undefined;
  seen.add(node);
  if (node.type === 'Identifier') {
    const origin = spies.get(node.name);
    return origin === undefined ? undefined : spyOrigin(origin, spies, seen);
  }
  if (node.type !== 'CallExpression') return undefined;
  if (memberName(node.callee) === 'spyOn') return node;
  if (node.callee.type === 'MemberExpression') return spyOrigin(node.callee.object, spies, seen);
  return undefined;
}

export function countTestFakes(
  inventory: TestInventory,
  repoRoot: string,
  boundaries: TestBoundary[] = [],
  fakeTypes: string[] = DEFAULT_FAKE_TYPES
): number {
  const resolver = new TestModuleResolver(repoRoot);
  const allowed = new Set(
    boundaries.map(({ module }) => {
      const resolved = resolver.boundaryModule(module);
      if (databaseBoundary(resolved, path.relative(repoRoot, resolved), fakeTypes))
        throw new Error(`A database client is never a valid test boundary: ${module}`);
      return resolved;
    })
  );
  let count = 0;
  for (const { file, program } of inventory.files) {
    const ownBindings = new Map<string, string>();
    const vitestNames = new Set(['vi']);
    for (const node of program.body) {
      if (node.type !== 'ImportDeclaration' || typeof node.source.value !== 'string') continue;
      const module = resolver.resolve(file, node.source.value);
      for (const specifier of node.specifiers) {
        if (module !== undefined) ownBindings.set(specifier.local.name, module);
        if (
          node.source.value === 'vitest' &&
          specifier.type === 'ImportSpecifier' &&
          rootIdentifier(specifier.imported) === 'vi'
        )
          vitestNames.add(specifier.local.name);
      }
    }
    const spies = new Map<string, Node>();
    walkNodes(program, (node) => {
      if (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'Identifier' &&
        node.init?.type === 'CallExpression'
      )
        spies.set(node.id.name, node.init);
    });
    walkNodes(program, (node) => {
      if (
        node.type === 'TSAsExpression' &&
        node.expression.type === 'TSAsExpression' &&
        node.expression.typeAnnotation.type === 'TSUnknownKeyword' &&
        fakeTypes.includes(typeName(node.typeAnnotation) ?? '')
      ) {
        count += 1;
        return;
      }
      if (node.type !== 'CallExpression') return;
      const name = memberName(node.callee);
      const viCall = (call: Node): boolean =>
        call.type === 'CallExpression' &&
        call.callee.type === 'MemberExpression' &&
        vitestNames.has(rootIdentifier(call.callee.object) ?? '');
      if ((name === 'mock' || name === 'doMock') && viCall(node)) {
        const argument = node.arguments[0];
        const source = argument?.type === 'ImportExpression' ? argument.source : argument;
        if (source?.type !== 'Literal' || typeof source.value !== 'string') return;
        const module = resolver.resolve(file, source.value);
        if (module !== undefined && !allowed.has(module)) count += 1;
        return;
      }
      if (
        !name?.startsWith('mock') ||
        name === 'mockName' ||
        name === 'mockClear' ||
        name === 'mockReset' ||
        name === 'mockRestore' ||
        node.callee.type !== 'MemberExpression'
      )
        return;
      const object = node.callee.object;
      const spy = spyOrigin(object, spies);
      if (spy?.type !== 'CallExpression' || memberName(spy.callee) !== 'spyOn' || !viCall(spy))
        return;
      const binding = rootIdentifier(spy.arguments[0]);
      const module = binding === undefined ? undefined : ownBindings.get(binding);
      if (module !== undefined && !allowed.has(module)) count += 1;
    });
  }
  return count;
}

export function checkTestFakes(measured: number, baseline: number | undefined): CheckIssue[] {
  return checkTestBaseline('testBaselines.fakes', measured, baseline);
}
