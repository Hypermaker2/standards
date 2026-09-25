import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkIconImports } from '../checkIconImports.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-icon-imports-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkIconImports', () => {
  it('fails when feature code imports lucide-react', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend/src/features'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/Bad.tsx'),
      `import { Check } from 'lucide-react';
export function Bad() { return <Check />; }
`
    );
    const issues = checkIconImports({ projectRoot: root });
    expect(issues.some((issue) => issue.message.includes('icon packages'))).toBe(true);
  });

  it('allows icon packages inside the icons module', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend/src/shared/components/icons'), { recursive: true });
    fs.mkdirSync(path.join(root, 'frontend/src/features'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'frontend/src/shared/components/icons/appIcons.ts'),
      `import { Check } from 'lucide-react';
export { Check };
`
    );
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/Ok.tsx'),
      `import { Check } from '@/shared/components/icons/appIcons';
export function Ok() { return <Check />; }
`
    );
    expect(checkIconImports({ projectRoot: root })).toEqual([]);
  });
});
