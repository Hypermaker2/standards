import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkShadows } from '../checkShadows.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-shadows-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkShadows', () => {
  it('fails on arbitrary shadow utilities and inline boxShadow in features', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend/src/features'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/Bad.tsx'),
      `export function Bad() {
  return <div className="shadow-[0_8px_24px_rgba(0,0,0,0.2)]" style={{ boxShadow: '0 4px 12px black' }} />;
}
`
    );
    const issues = checkShadows({ projectRoot: root });
    expect(issues.some((issue) => issue.message.includes('shadow-['))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('boxShadow'))).toBe(true);
  });

  it('allows token-backed shadow utilities in feature code', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend/src/features'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/Ok.tsx'),
      'export function Ok() { return <div className="shadow-sm hover:shadow-md" />; }\n'
    );
    expect(checkShadows({ projectRoot: root })).toEqual([]);
  });

  it('fails on raw box-shadow in feature CSS', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend/src/features'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/card.css'),
      '.card { box-shadow: 0 4px 12px black; }\n'
    );
    const issues = checkShadows({ projectRoot: root });
    expect(issues.some((issue) => issue.message.includes('box-shadow'))).toBe(true);
  });
});
