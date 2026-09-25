import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkNoSkeletons } from '../checkNoSkeletons.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-skeletons-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkNoSkeletons', () => {
  it('passes a tree without Skeleton or animate-pulse placeholders', () => {
    const root = makeScratch();
    const src = path.join(root, 'src');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'ok.tsx'), 'export function Ok() { return <div />; }\n');
    expect(checkNoSkeletons({ projectRoot: root })).toEqual([]);
  });

  it('fails on Skeleton imports, usage, data-slot, and animate-pulse', () => {
    const root = makeScratch();
    const src = path.join(root, 'src');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(
      path.join(src, 'bad.tsx'),
      `import { Skeleton } from '@/shared/components/ui';
export function Bad() {
  return <Skeleton data-slot="skeleton" className="animate-pulse h-4" />;
}
`
    );
    const issues = checkNoSkeletons({ projectRoot: root });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((issue) => issue.message.includes('Skeleton'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('animate-pulse'))).toBe(true);
  });
});
