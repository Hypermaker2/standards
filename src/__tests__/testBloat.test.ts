import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { checkTestBudget } from '../checkTestBudget.ts';
import { checkTestAssertions, countTestAssertions } from '../checkTestAssertions.ts';
import { checkTestFakes, countTestFakes } from '../checkTestFakes.ts';
import { loadStandardsConfig } from '../paths.ts';
import { initStandardsConfig, syncProject } from '../sync.ts';
import { checkProject } from '../check.ts';
import { collectTestFiles } from '../testFiles.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-tests-'));
  roots.push(root);
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

it('includes test helpers and Vitest imports without charging application code to the budget', () => {
  const root = fixture({
    'src/main.ts': 'export const app = 1;\n\n',
    'src/view.test.tsx': 'const view = <div />;\n\n',
    'src/action.spec.js': 'const action = 1;',
    '__tests__/helper.ts': 'export const helper = 1;',
    'vitest.setup.ts': 'const setup = 1;',
    'src/testing/fixture.ts': 'const data = 1;',
    'src/check.ts': "import { expect } from 'vitest';\nexpect(1).toBe(1);",
    'src/testApiRouteHarness.ts': 'const harness = 1;',
    '__tests__/fixture.json': '{\n  "data": 1\n}',
    'src/platform.d.mts': 'export const platform: string;',
    'node_modules/ignored.test.ts': 'const ignored = 1;',
  });
  const inventory = collectTestFiles(root);
  expect([inventory.lines, inventory.sourceLines, inventory.files.length]).toEqual([11, 2, 7]);
});

it.each([
  [100, 100, undefined],
  [98, 100, undefined],
  [97, 100, 'lower'],
  [101, 100, 'exceeds'],
  [0, 0, undefined],
  [1, 0, 'exceeds'],
  [0, 1, 'lower'],
  [3, undefined, 'required'],
])('ratchets all three counts at measured %s and baseline %s', (measured, baseline, failure) => {
  const inventory = { files: [], lines: measured, sourceLines: 1 };
  for (const issues of [
    checkTestBudget(inventory, baseline),
    checkTestAssertions(measured, baseline),
    checkTestFakes(measured, baseline),
  ]) {
    expect(issues.length).toBe(failure === undefined ? 0 : 1);
    if (failure !== undefined) expect(issues[0].message).toContain(failure);
    if (failure !== undefined) expect(issues[0].message).toContain(`measured ${measured}`);
  }
});

it.each([
  ["expect(el).toHaveClass('active')", 1],
  ["expect(el.className).not.toContain('active')", 1],
  ["expect(el.classList.contains('active')).toBe(true)", 1],
  ["expect(el.getAttribute('class')).toBe('active')", 1],
  ["expect(el.style.color).toBe('red')", 1],
  ["const classes = el.className; expect(classes).toBe('active')", 1],
  ["expect(el).toEqual({ style: { color: 'red' } })", 1],
  ["const file = './View.tsx'; readFileSync(file, 'utf8')", 1],
  ["import { expect as check } from 'vitest'; check(el.className).toBe('active')", 1],
  ["import { readFileSync as read } from 'node:fs'; read('./tokens.css', 'utf8')", 1],
  ["expect(el).toHaveStyle({ color: 'red' })", 1],
  ["expect(el).toHaveAttribute('class', 'active')", 1],
  ["expect(el).toMatchSnapshot(); expect(el).toMatchInlineSnapshot('x')", 2],
  ["readFileSync(new URL('./View.tsx', import.meta.url), 'utf8')", 1],
  ['Bun.file(`${root}/tokens.css`).text()', 1],
  ["readFileSync('./data.json', 'utf8'); expect(el.textContent).toBe('Saved')", 0],
  [
    "const text = `expect(el).toHaveClass('active')`; const el = <div className='active' style={{ color: 'red' }} />",
    0,
  ],
])('counts only targeted assertion sites: %s', (text, expected) => {
  const root = fixture({ 'view.test.tsx': text });
  expect(countTestAssertions(collectTestFiles(root))).toBe(expected);
});

it.each([
  ["vi.mock('./own')", 1],
  [
    "import * as own from './own'; vi.spyOn(own, 'run').mockReturnValue(1).mockReturnValueOnce(2)",
    2,
  ],
  ["import * as own from './own'; vi.spyOn(own, 'run').mockName('name')", 0],
  ['const db = ({} as unknown) as Database', 1],
  ["vi.doMock(import('./own'))", 1],
  ["vi.mock('external'); vi.mock('node:fs')", 0],
  ["vi.mock('@/own'); vi.mock('@local/core')", 2],
  ["import * as own from './own'; vi.spyOn(own, 'run').mockImplementation(() => 1)", 1],
  ["import { run } from './own'; const spy = vi.spyOn(run, 'call'); spy.mockReturnValue(1)", 1],
  ["import * as own from './own'; vi.spyOn(own, 'run'); vi.spyOn(own, 'run').mockRestore()", 0],
  ["import { vi as mocker } from 'vitest'; mocker.mock('./own')", 1],
  ['const db = {} as unknown as DbClient; const prisma = {} as unknown as PrismaClient', 2],
  ['const db = {} as DbClient; const other = {} as unknown as Other', 0],
])('resolves own fakes without counting external adapters: %s', (text, expected) => {
  const root = fixture({
    'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@/*": ["src/*"] } } }',
    'tsconfig.json': '{ "extends": "./tsconfig.base.json", }',
    'src/own.ts': 'export const run = () => 1;',
    'src/own.test.ts': text,
    'packages/core/package.json': '{ "name": "@local/core" }',
  });
  expect(countTestFakes(collectTestFiles(root), root)).toBe(expected);
});

it('allows exact outside adapters and custom fake types while rejecting a database boundary', () => {
  const root = fixture({
    'spawn.ts': 'export const spawn = () => 1;',
    'db/client.ts': 'export const database = 1;',
    'storage.ts': 'export type Storage = PrismaClient;',
    'app.test.ts':
      "vi.mock('./spawn'); vi.mock('./db/client'); const db = {} as unknown as StoreClient;",
  });
  const inventory = collectTestFiles(root);
  expect(
    countTestFakes(
      inventory,
      root,
      [{ module: 'spawn.ts', reason: 'Process adapter' }],
      ['StoreClient']
    )
  ).toBe(2);
  expect(() =>
    countTestFakes(inventory, root, [{ module: 'db/client.ts', reason: 'Database' }])
  ).toThrow('never a valid test boundary');
  expect(() =>
    countTestFakes(inventory, root, [{ module: 'storage.ts', reason: 'Data adapter' }])
  ).toThrow('never a valid test boundary');
});

it.each([
  { testBudget: { lines: -1 } },
  { testBudget: { lines: 1.5 } },
  { testBaselines: { assertions: 0 } },
  { testBoundaries: [{ module: 'spawn.ts', reason: '' }] },
  { testFakeTypes: [1] },
])('rejects malformed test settings: %j', (settings) => {
  const root = fixture({
    'standards.json': JSON.stringify({ profile: 'bun-ts', design: false, ...settings }),
  });
  expect(() => loadStandardsConfig(root)).toThrow();
});

it('resolves package exports and inherited baseUrl paths to exact boundary files', () => {
  const root = fixture({
    'tsconfig.base.json': '{ "compilerOptions": { "baseUrl": "." } }',
    'app/tsconfig.json':
      '{ "extends": "../tsconfig.base.json", "compilerOptions": { "paths": { "@adapter": ["packages/platform/src/spawn.ts"] } } }',
    'app/worker.test.ts':
      "vi.mock('@adapter'); vi.mock('@local/platform'); vi.mock('@local/platform/spawn'); vi.mock('@local/platform/other');",
    'packages/platform/package.json':
      '{ "name": "@local/platform", "exports": { ".": { "import": "./src/spawn.ts" }, "./*": "./src/*.ts" } }',
    'packages/platform/src/spawn.ts': 'export const spawn = () => 1;',
    'packages/platform/src/other.ts': 'export const ownCode = 1;',
  });
  const inventory = collectTestFiles(path.join(root, 'app'));
  expect(countTestFakes(inventory, root)).toBe(4);
  expect(
    countTestFakes(inventory, root, [{ module: '@local/platform', reason: 'Process adapter' }])
  ).toBe(1);
});

it('initializes once and never changes frozen counts during sync', () => {
  const root = fixture({ 'app.test.ts': 'expect(1).toBe(1);' });
  initStandardsConfig(root, { profile: 'bun-ts' });
  expect(loadStandardsConfig(root).testBudget).toEqual({ lines: 1 });
  fs.writeFileSync(path.join(root, 'app.test.ts'), 'expect(1).toBe(1);\nexpect(2).toBe(2);');
  syncProject(root, loadStandardsConfig(root));
  expect(loadStandardsConfig(root).testBudget).toEqual({ lines: 1 });
  expect(() => initStandardsConfig(root, { profile: 'bun-ts' })).toThrow(
    'cannot reset frozen test counts'
  );
});

it('requires separate measured baselines under each bun-ts profile root', () => {
  const root = fixture({
    'standards.json': JSON.stringify({
      profiles: [
        { profile: 'python', root: '.' },
        {
          profile: 'bun-ts',
          root: 'frontend',
          testBudget: { lines: 0 },
          testBaselines: { assertions: 0, fakes: 0 },
        },
        { profile: 'bun-ts', root: 'backend' },
      ],
    }),
    'frontend/app.test.ts': 'expect(1).toBe(1);',
    'backend/app.test.ts': 'expect(1).toBe(1);',
  });
  const issues = checkProject(root, loadStandardsConfig(root)).filter((issue) =>
    issue.message.startsWith('test')
  );
  expect(issues.map(({ file, message }) => [file, message.split(':')[0].split(' is ')[0]])).toEqual(
    [
      ['frontend/standards.json', 'testBudget.lines'],
      ['backend/standards.json', 'testBudget.lines'],
      ['backend/standards.json', 'testBaselines.assertions'],
      ['backend/standards.json', 'testBaselines.fakes'],
    ]
  );
});
