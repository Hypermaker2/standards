import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkSingleTypeScript } from '../checkSingleTypeScript.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-ts-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkSingleTypeScript', () => {
  it('flags typescript@5 in bun.lock and tsc in scripts and workflows', () => {
    const root = makeScratch();
    fs.writeFileSync(
      path.join(root, 'bun.lock'),
      `{\n  "packages": {\n    "typescript": ["typescript@5.9.0", "", {}, ""]\n  }\n}\n`
    );
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { typecheck: 'tsc -p .' } }, null, 2)
    );
    fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.github', 'workflows', 'ci.yml'),
      `jobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n      - run: tsc -p .\n`
    );
    const issues = checkSingleTypeScript({ projectRoot: root });
    expect(issues.some((issue) => issue.file === 'bun.lock')).toBe(true);
    expect(
      issues.some((issue) => issue.message.includes('tsc') && issue.file === 'package.json')
    ).toBe(true);
    expect(issues.some((issue) => issue.file === path.join('.github', 'workflows', 'ci.yml'))).toBe(
      true
    );
  });

  it('allows tsc in tscAllowed workspaces', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'legacy'));
    fs.writeFileSync(
      path.join(root, 'legacy', 'package.json'),
      JSON.stringify({ name: 'legacy', scripts: { typecheck: 'tsc -p .' } }, null, 2)
    );
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'root' }, null, 2));
    expect(checkSingleTypeScript({ projectRoot: root, tscAllowed: ['legacy'] })).toEqual([]);
  });
});
