import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkUseEffect } from '../checkUseEffect.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-effect-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkUseEffect', () => {
  it('bans useEffect everywhere when effectWrappers is missing', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(
      path.join(root, 'src', 'App.tsx'),
      `import { useEffect } from 'react';\nuseEffect(() => {});\n`
    );
    const issues = checkUseEffect({ projectRoot: root });
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].file).toBe(path.join('src', 'App.tsx'));
  });

  it('allows useEffect only in effectWrappers', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'src', 'hooks'), { recursive: true });
    const wrapper = path.join('src', 'hooks', 'useMountEffect.ts');
    fs.writeFileSync(
      path.join(root, wrapper),
      `import { useEffect } from 'react';\nexport function useMountEffect(fn: () => void) { useEffect(fn, []); }\n`
    );
    fs.writeFileSync(path.join(root, 'src', 'App.tsx'), `export const x = 1;\n`);
    expect(checkUseEffect({ projectRoot: root, effectWrappers: [wrapper] })).toEqual([]);
  });
});
