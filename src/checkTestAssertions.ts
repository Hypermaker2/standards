import type { Node } from 'oxc-parser';
import type { CheckIssue } from './paths.ts';
import { checkTestBaseline } from './testBaseline.ts';
import { walkNodes, type TestInventory } from './testFiles.ts';

function propertyName(node: Node): string | undefined {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  return undefined;
}

function presentationValue(node: Node): boolean {
  if (node.type === 'MemberExpression')
    return ['className', 'classList', 'style'].includes(propertyName(node.property) ?? '');
  if (node.type === 'Property')
    return ['className', 'classList', 'style'].includes(propertyName(node.key) ?? '');
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return false;
  if (propertyName(node.callee.property) !== 'getAttribute') return false;
  const first = node.arguments[0];
  return first?.type === 'Literal' && ['class', 'style'].includes(String(first.value));
}

function sourcePath(node: Node): boolean {
  if (node.type === 'Literal' && typeof node.value === 'string')
    return /\.(ts|tsx|css)$/.test(node.value);
  return node.type === 'TemplateElement' && /\.(ts|tsx|css)$/.test(node.value.raw);
}

function containsValue(
  node: Node,
  predicate: (node: Node) => boolean,
  bindings: Map<string, Node>,
  seen = new Set<Node>()
): boolean {
  if (seen.has(node)) return false;
  seen.add(node);
  let found = false;
  walkNodes(node, (child) => {
    if (predicate(child)) found = true;
    if (child.type !== 'Identifier') return;
    const binding = bindings.get(child.name);
    if (binding !== undefined && containsValue(binding, predicate, bindings, seen)) found = true;
  });
  return found;
}

function expectChain(node: Node, names: Set<string>): boolean {
  if (node.type === 'MemberExpression') return expectChain(node.object, names);
  if (node.type !== 'CallExpression') return false;
  if (node.callee.type === 'Identifier') return names.has(node.callee.name);
  return expectChain(node.callee, names);
}

export function countTestAssertions(inventory: TestInventory): number {
  let count = 0;
  for (const { program } of inventory.files) {
    const bindings = new Map<string, Node>();
    const expectNames = new Set(['expect']);
    const readNames = new Set(['readFileSync']);
    for (const node of program.body) {
      if (node.type !== 'ImportDeclaration') continue;
      for (const specifier of node.specifiers) {
        if (specifier.type !== 'ImportSpecifier') continue;
        if (node.source.value === 'vitest' && propertyName(specifier.imported) === 'expect')
          expectNames.add(specifier.local.name);
        if (
          ['node:fs', 'fs'].includes(String(node.source.value)) &&
          propertyName(specifier.imported) === 'readFileSync'
        )
          readNames.add(specifier.local.name);
      }
    }
    walkNodes(program, (node) => {
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init !== null)
        bindings.set(node.id.name, node.init);
    });
    walkNodes(program, (node) => {
      if (node.type !== 'CallExpression') return;
      const callee = node.callee;
      const name =
        callee.type === 'MemberExpression' ? propertyName(callee.property) : propertyName(callee);
      const matcher = callee.type === 'MemberExpression' && expectChain(callee.object, expectNames);
      if (
        matcher &&
        ['toHaveClass', 'toHaveStyle', 'toMatchSnapshot', 'toMatchInlineSnapshot'].includes(
          name ?? ''
        )
      ) {
        count += 1;
        return;
      }
      if (
        matcher &&
        name === 'toHaveAttribute' &&
        node.arguments[0]?.type === 'Literal' &&
        ['class', 'style'].includes(String(node.arguments[0].value))
      ) {
        count += 1;
        return;
      }
      if (matcher && containsValue(node, presentationValue, bindings)) {
        count += 1;
        return;
      }
      const readsFile =
        readNames.has(name ?? '') ||
        (name === 'file' &&
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'Bun');
      const argument = node.arguments[0];
      if (readsFile && argument !== undefined && containsValue(argument, sourcePath, bindings))
        count += 1;
    });
  }
  return count;
}

export function checkTestAssertions(measured: number, baseline: number | undefined): CheckIssue[] {
  return checkTestBaseline('testBaselines.assertions', measured, baseline);
}
