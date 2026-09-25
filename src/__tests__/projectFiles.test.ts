import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkNoComments } from '../checkNoComments.ts';
import { listProjectFiles } from '../projectFiles.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-files-'));
  scratchDirs.push(dir);
  return dir;
}

function gitInit(root: string): void {
  expect(spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' }).status).toBe(0);
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'test'], { cwd: root });
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('listProjectFiles', () => {
  it('skips index entries deleted from disk without crashing checks', () => {
    const root = makeScratch();
    gitInit(root);
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'keep.ts'), `export const keep = 1;\n`);
    fs.writeFileSync(path.join(root, 'src', 'gone.ts'), `export const gone = 1;\n`);
    expect(spawnSync('git', ['add', '.'], { cwd: root, encoding: 'utf8' }).status).toBe(0);
    fs.unlinkSync(path.join(root, 'src', 'gone.ts'));

    const files = listProjectFiles({
      projectRoot: root,
      extensions: new Set(['.ts']),
    });
    expect(files.map((filePath) => path.relative(root, filePath))).toEqual([
      path.join('src', 'keep.ts'),
    ]);
    expect(() => checkNoComments({ projectRoot: root, profile: 'bun-ts' })).not.toThrow();
  });
});
