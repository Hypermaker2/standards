import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkControlSize } from '../checkControlSize.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-control-size-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function seedTree(root: string): void {
  fs.mkdirSync(path.join(root, 'frontend/src/features'), { recursive: true });
  fs.mkdirSync(path.join(root, 'frontend/src/shared/components/ui'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'frontend/src/shared/components/ui/Button.tsx'),
    'export function Button() { return <button type="button" />; }\n'
  );
}

describe('checkControlSize', () => {
  it('fails on a raw button outside the UI root', () => {
    const root = makeScratch();
    seedTree(root);
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/Bad.tsx'),
      'export function Bad() {\n  return <button type="button">Go</button>;\n}\n'
    );
    const issues = checkControlSize({ projectRoot: root });
    expect(issues.some((issue) => issue.message.includes('raw <button>'))).toBe(true);
  });

  it('fails on height utilities in UI component className', () => {
    const root = makeScratch();
    seedTree(root);
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/Tall.tsx'),
      `import { IconButton } from '@/shared/components/ui';
export function Tall() {
  return <IconButton aria-label="X" className="h-11" />;
}
`
    );
    const issues = checkControlSize({ projectRoot: root });
    expect(issues.some((issue) => issue.message.includes('overrides control height'))).toBe(true);
  });

  it('passes clean Button usage and allows UI primitives to use raw buttons', () => {
    const root = makeScratch();
    seedTree(root);
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/Ok.tsx'),
      `import { Button, IconButton } from '@/shared/components/ui';
export function Ok() {
  return (
    <>
      <Button intent="ghost">Save</Button>
      <IconButton aria-label="Close" className="rounded-control [&_svg]:size-3.5" />
    </>
  );
}
`
    );
    expect(checkControlSize({ projectRoot: root })).toEqual([]);
  });
});
