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

const RELAY_STYLE = `import {
  useEffect as useReactEffect,
  type DependencyList,
  type EffectCallback,
} from 'react';

export function useMountEffect(effect: EffectCallback): void {
  useReactEffect(effect, []);
}

export function useSyncedEffect(effect: EffectCallback, deps: DependencyList): void {
  useReactEffect(effect, deps);
}
`;

const RENAME_STYLE = `import { useEffect, type DependencyList, type EffectCallback } from 'react';

export function useMountEffect(effect: EffectCallback, deps?: DependencyList): void {
  useEffect(effect, deps);
}
`;

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
    fs.writeFileSync(path.join(root, wrapper), RELAY_STYLE);
    fs.writeFileSync(path.join(root, 'src', 'App.tsx'), `export const x = 1;\n`);
    expect(checkUseEffect({ projectRoot: root, effectWrappers: [wrapper] })).toEqual([]);
  });

  it('accepts a relay-style mount and synced wrapper file', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'src', 'hooks'), { recursive: true });
    const wrapper = path.join('src', 'shared', 'hooks', 'useMountEffect.ts');
    fs.mkdirSync(path.dirname(path.join(root, wrapper)), { recursive: true });
    fs.writeFileSync(path.join(root, wrapper), RELAY_STYLE);
    expect(checkUseEffect({ projectRoot: root, effectWrappers: [wrapper] })).toEqual([]);
  });

  it('rejects a rename-style wrapper with optional deps', () => {
    const root = makeScratch();
    const wrapper = path.join('src', 'hooks', 'useMountEffect.ts');
    fs.mkdirSync(path.dirname(path.join(root, wrapper)), { recursive: true });
    fs.writeFileSync(path.join(root, wrapper), RENAME_STYLE);
    const issues = checkUseEffect({ projectRoot: root, effectWrappers: [wrapper] });
    expect(issues.some((issue) => issue.message.includes('optional'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('must not accept a deps'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('(effect, [])'))).toBe(true);
  });
});
