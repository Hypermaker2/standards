import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkSingleAgentsFile } from '../checkSingleAgentsFile.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-agents-file-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkSingleAgentsFile', () => {
  it('passes when no shadow instruction files exist', () => {
    const root = makeScratch();
    fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Demo\n');
    expect(checkSingleAgentsFile(root)).toEqual([]);
  });

  it('fails when Claude or Cursor instruction files shadow AGENTS.md', () => {
    const root = makeScratch();
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'shadow\n');
    fs.mkdirSync(path.join(root, '.claude'));
    fs.writeFileSync(path.join(root, '.claude', 'CLAUDE.md'), 'shadow\n');
    fs.writeFileSync(path.join(root, 'CLAUDE.local.md'), 'shadow\n');
    fs.writeFileSync(path.join(root, '.cursorrules'), 'shadow\n');
    fs.mkdirSync(path.join(root, '.cursor', 'rules'), { recursive: true });
    const issues = checkSingleAgentsFile(root);
    expect(issues.map((issue) => issue.file).sort()).toEqual(
      [
        'CLAUDE.md',
        'CLAUDE.local.md',
        path.join('.claude', 'CLAUDE.md'),
        '.cursorrules',
        path.join('.cursor', 'rules'),
      ].sort()
    );
    expect(issues.every((issue) => issue.message.includes('single instruction file'))).toBe(true);
  });
});
