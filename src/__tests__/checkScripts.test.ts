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
            lint: 'oxlint && knip',
            format: 'echo',
            'format:check': 'echo',
            check: 'bun run lint && bun run audit',
            knip: 'knip',
            audit: 'bun audit --audit-level=high',
          },
        },
        null,
        2
      )
    );
    expect(checkScripts(root, 'bun-ts')).toEqual([]);
  });

  it('requires knip in lint and audit in check or lint', () => {
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
            lint: 'oxlint',
            format: 'echo',
            'format:check': 'echo',
            check: 'bun run lint',
            knip: 'knip',
            audit: 'bun audit --audit-level=high',
          },
        },
        null,
        2
      )
    );
    const messages = checkScripts(root, 'bun-ts').map((issue) => issue.message);
    expect(messages).toContain('script "lint" must include knip');
    expect(messages).toContain('script "check" or "lint" must include audit');
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

  it('accepts ruff.base.toml plus ruff.toml for python', () => {
    const root = makeScratch();
    fs.writeFileSync(
      path.join(root, 'pyproject.toml'),
      `[project]\nname = "demo"\nversion = "0.1.0"\n[tool.pytest.ini_options]\n`
    );
    fs.writeFileSync(path.join(root, 'ruff.base.toml'), 'line-length = 100\n');
    fs.writeFileSync(path.join(root, 'ruff.toml'), 'extend = "ruff.base.toml"\n');
    expect(checkScripts(root, 'python')).toEqual([]);
  });
});
