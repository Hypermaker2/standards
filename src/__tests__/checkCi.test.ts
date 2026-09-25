import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkCiWorkflow, syncCiWorkflow } from '../checkCi.ts';
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
  it('sync writes the workflow and check verifies it', () => {
    const root = makeScratch();
    fs.writeFileSync(
      path.join(root, 'standards.json'),
      JSON.stringify({ profile: 'bun-ts', design: false, ci: true }, null, 2)
    );
    const results = syncProject(root, { profile: 'bun-ts', design: false, ci: true });
    expect(results.some((result) => result.file.includes('standards.yml'))).toBe(true);
    expect(checkCiWorkflow(root)).toEqual([]);
  });

  it('fails when the workflow is missing or drifted', () => {
    const root = makeScratch();
    expect(checkCiWorkflow(root)[0].message).toContain('missing');
    syncCiWorkflow(root);
    fs.appendFileSync(path.join(root, '.github', 'workflows', 'standards.yml'), '\n');
    expect(checkCiWorkflow(root)[0].message).toContain('drifts');
  });
});
