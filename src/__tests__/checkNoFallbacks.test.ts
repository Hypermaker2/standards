import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkNoFallbacks } from '../checkNoFallbacks.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-fallbacks-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkNoFallbacks', () => {
  it('flags || [] and || undefined in runtime source', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(
      path.join(root, 'src', 'app.ts'),
      ` const items = value || [];
const name = label || '';
const other = maybe || "";
const none = flag || undefined;
`
    );
    const issues = checkNoFallbacks({ projectRoot: root });
    expect(issues.map((issue) => issue.line).sort()).toEqual([1, 2, 3, 4]);
  });

  it('ignores test files and fallbackExempt prefixes', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'src', '__tests__'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', '__tests__', 'app.test.ts'), `const x = y || [];\n`);
    fs.mkdirSync(path.join(root, 'generated'));
    fs.writeFileSync(path.join(root, 'generated', 'shim.ts'), `const x = y || [];\n`);
    expect(checkNoFallbacks({ projectRoot: root, fallbackExempt: ['generated'] })).toEqual([]);
  });
});
