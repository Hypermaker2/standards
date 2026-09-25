import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkCiWorkflow, syncBunVersion, syncCiWorkflow } from '../checkCi.ts';
import { syncProject } from '../sync.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-ci-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkCi', () => {
  it('sync writes the workflow and .bun-version and check verifies them', () => {
    const root = makeScratch();
    fs.writeFileSync(
      path.join(root, 'standards.json'),
      JSON.stringify({ profile: 'bun-ts', design: false, ci: true }, null, 2)
    );
    const results = syncProject(root, { profile: 'bun-ts', design: false, ci: true });
    expect(results.some((result) => result.file.includes('standards.yml'))).toBe(true);
    expect(results.some((result) => result.file === '.bun-version')).toBe(true);
    expect(fs.readFileSync(path.join(root, '.bun-version'), 'utf8').trim()).toMatch(
      /^\d+\.\d+\.\d+/
    );
    expect(checkCiWorkflow(root)).toEqual([]);
  });

  it('does not overwrite an existing .bun-version', () => {
    const root = makeScratch();
    fs.writeFileSync(path.join(root, '.bun-version'), '1.2.3\n');
    expect(syncBunVersion(root)).toEqual({ file: '.bun-version', status: 'unchanged' });
    expect(fs.readFileSync(path.join(root, '.bun-version'), 'utf8')).toBe('1.2.3\n');
  });

  it('fails when the workflow or .bun-version is missing or drifted', () => {
    const root = makeScratch();
    const missing = checkCiWorkflow(root);
    expect(missing.some((issue) => issue.message.includes('CI workflow missing'))).toBe(true);
    expect(missing.some((issue) => issue.message.includes('.bun-version missing'))).toBe(true);
    syncCiWorkflow(root);
    syncBunVersion(root);
    fs.appendFileSync(path.join(root, '.github', 'workflows', 'standards.yml'), '\n');
    expect(checkCiWorkflow(root).some((issue) => issue.message.includes('drifts'))).toBe(true);
  });
});
