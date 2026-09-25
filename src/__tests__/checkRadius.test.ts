import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkRadius } from '../checkRadius.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-radius-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkRadius', () => {
  it('allows role radius utilities and rejects numeric, bare, arbitrary, and legacy vars', () => {
    const root = makeScratch();
    const src = path.join(root, 'src');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(
      path.join(src, 'ok.tsx'),
      'const ok = "rounded-tight rounded-control rounded-inset rounded-container rounded-sheet rounded-full rounded-none rounded-t-container";\n'
    );
    fs.writeFileSync(
      path.join(src, 'ok.css'),
      '.x { border-radius: var(--radius-control); border-top-left-radius: 0; }\n'
    );
    fs.writeFileSync(
      path.join(src, 'bad.tsx'),
      'const bad = "rounded-lg rounded-[12px] rounded rounded-t !rounded-md";\n'
    );
    fs.writeFileSync(
      path.join(src, 'bad.css'),
      '.x { border-radius: var(--radius-md); border-radius: 8px; }\n'
    );
    fs.writeFileSync(path.join(src, 'bad.html'), '<div class="rounded-xl"></div>\n');

    const issues = checkRadius({ projectRoot: root });
    expect(issues.some((issue) => issue.file.endsWith('ok.tsx'))).toBe(false);
    expect(issues.some((issue) => issue.file.endsWith('ok.css'))).toBe(false);
    expect(issues.some((issue) => issue.file.endsWith('bad.tsx'))).toBe(true);
    expect(issues.some((issue) => issue.file.endsWith('bad.css'))).toBe(true);
    expect(issues.some((issue) => issue.file.endsWith('bad.html'))).toBe(true);
  });
});
