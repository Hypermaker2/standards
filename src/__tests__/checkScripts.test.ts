import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkScripts } from '../checkScripts.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-scripts-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkScripts', () => {
  it('reports each missing bun-ts root script', () => {
    const root = makeScratch();
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { test: 'vitest' } }, null, 2)
    );
    const issues = checkScripts(root, 'bun-ts');
    const messages = issues.map((issue) => issue.message);
    expect(messages).toContain('missing script "dev"');
    expect(messages).toContain('missing script "build"');
    expect(messages).toContain('missing script "check"');
    expect(messages).not.toContain('missing script "test"');
  });

  it('passes when all bun-ts scripts exist', () => {
    const root = makeScratch();
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify(
        {
          name: 'demo',
          scripts: {
            dev: 'echo',
            build: 'echo',
            test: 'echo',
            typecheck: 'echo',
            lint: 'echo',
            format: 'echo',
            'format:check': 'echo',
            check: 'echo',
          },
        },
        null,
        2
      )
    );
    expect(checkScripts(root, 'bun-ts')).toEqual([]);
  });

  it('requires pyproject.toml with ruff and pytest for python', () => {
    const root = makeScratch();
    fs.writeFileSync(
      path.join(root, 'pyproject.toml'),
      `[project]\nname = "demo"\nversion = "0.1.0"\n`
    );
    const issues = checkScripts(root, 'python');
    expect(issues.some((issue) => issue.message.includes('ruff'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('pytest'))).toBe(true);
  });
});
