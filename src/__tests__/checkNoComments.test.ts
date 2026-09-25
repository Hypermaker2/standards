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
});
