import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkNoComments } from '../checkNoComments.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-comments-'));
  scratchDirs.push(dir);
  return dir;
}

function gitInit(root: string): void {
  const init = spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' });
  expect(init.status).toBe(0);
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'test'], { cwd: root });
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkNoComments', () => {
  it('reports three comments in a scratch TypeScript file', () => {
    const root = makeScratch();
    const srcDir = path.join(root, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(
      path.join(srcDir, 'sample.ts'),
      `const a = 1;
// one
const b = 2;
/* two */
const c = 3;
/** three */
`
    );
    const issues = checkNoComments({ projectRoot: root, profile: 'bun-ts' });
    expect(issues).toHaveLength(3);
    expect(issues.map((issue) => issue.line)).toEqual([2, 4, 6]);
  });

  it('ignores a URL inside a string', () => {
    const root = makeScratch();
    const srcDir = path.join(root, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(
      path.join(srcDir, 'sample.ts'),
      `export const docs = "https://example.com/path#section";\n`
    );
    const issues = checkNoComments({ projectRoot: root, profile: 'bun-ts' });
    expect(issues).toEqual([]);
  });

  it('shell hash comments ignore length expansions and quoted hashes', () => {
    const root = makeScratch();
    const scriptsDir = path.join(root, 'scripts');
    fs.mkdirSync(scriptsDir);
    fs.writeFileSync(
      path.join(scriptsDir, 'ok.sh'),
      [
        '#!/usr/bin/env bash',
        'files=(a b)',
        'echo "${#files[@]}"',
        'echo $#',
        'echo "a # b"',
        "echo 'c # d'",
        '',
      ].join('\n')
    );
    expect(checkNoComments({ projectRoot: root, profile: 'bun-ts' })).toEqual([]);

    fs.writeFileSync(
      path.join(scriptsDir, 'bad.sh'),
      `#!/usr/bin/env bash
x=1 # real comment
# real
`
    );
    const issues = checkNoComments({ projectRoot: root, profile: 'bun-ts' });
    expect(issues.map((issue) => issue.line).sort()).toEqual([2, 3]);
  });

  it('python profile skips nested directories that have standards.json', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'app.py'), `x = 1\n`);
    fs.mkdirSync(path.join(root, 'frontend', 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'frontend', 'standards.json'),
      `{"profile":"bun-ts","design":false}\n`
    );
    fs.writeFileSync(
      path.join(root, 'frontend', 'src', 'App.tsx'),
      `const x = 1;\n// nested comment owned by frontend check\n`
    );
    const issues = checkNoComments({ projectRoot: root, profile: 'python' });
    expect(issues).toEqual([]);
  });

  it('python profile skips nested consumers under git listing', () => {
    const root = makeScratch();
    gitInit(root);
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'app.py'), `x = 1\n`);
    fs.mkdirSync(path.join(root, 'frontend', 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'frontend', 'standards.json'),
      `{"profile":"bun-ts","design":false}\n`
    );
    fs.writeFileSync(
      path.join(root, 'frontend', 'src', 'App.tsx'),
      `const x = 1;\n// nested comment owned by frontend check\n`
    );
    const add = spawnSync('git', ['add', '.'], { cwd: root, encoding: 'utf8' });
    expect(add.status).toBe(0);
    const issues = checkNoComments({ projectRoot: root, profile: 'python' });
    expect(issues).toEqual([]);
  });

  it('python profile still scans ts files outside nested consumers', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.writeFileSync(path.join(root, 'scripts', 'tool.ts'), `const x = 1;\n// bad\n`);
    const issues = checkNoComments({ projectRoot: root, profile: 'python' });
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe(path.join('scripts', 'tool.ts'));
  });

  it('git listing respects gitignore and still scans untracked unignored files', () => {
    const root = makeScratch();
    gitInit(root);
    fs.writeFileSync(path.join(root, '.gitignore'), `.venv/\n`);
    fs.mkdirSync(path.join(root, '.venv'));
    fs.writeFileSync(path.join(root, '.venv', 'ignored.py'), `# ignored comment\n`);
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'clean.py'), `x = 1\n`);
    const add = spawnSync('git', ['add', '.gitignore', 'src'], { cwd: root, encoding: 'utf8' });
    expect(add.status).toBe(0);
    expect(checkNoComments({ projectRoot: root, profile: 'python' })).toEqual([]);

    fs.writeFileSync(path.join(root, 'src', 'dirty.py'), `x = 1\n# untracked comment\n`);
    const issues = checkNoComments({ projectRoot: root, profile: 'python' });
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe(path.join('src', 'dirty.py'));
  });

  it('always skips tool cache directories even when listed', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, '.mypy_cache'));
    fs.writeFileSync(path.join(root, '.mypy_cache', 'cache.py'), `# cache comment\n`);
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'app.py'), `x = 1\n`);
    expect(checkNoComments({ projectRoot: root, profile: 'python' })).toEqual([]);
  });
});
