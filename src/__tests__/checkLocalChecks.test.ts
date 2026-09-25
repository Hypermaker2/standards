import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkLocalChecks } from '../checkLocalChecks.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-local-checks-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkLocalChecks', () => {
  it('fails when scripts/check-*.ts is undeclared', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'scripts/check-domain.ts'), 'export {};\n');
    const issues = checkLocalChecks({ projectRoot: root });
    expect(
      issues.some(
        (issue) =>
          issue.file === 'scripts/check-domain.ts' &&
          issue.message.includes('undeclared local check')
      )
    ).toBe(true);
  });

  it('passes when the local check is declared with a reason', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'scripts/check-domain.ts'), 'export {};\n');
    expect(
      checkLocalChecks({
        projectRoot: root,
        localChecks: {
          'scripts/check-domain.ts': 'Relay-only domain invariant for chat subtree deletion',
        },
      })
    ).toEqual([]);
  });
});
