import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkRawColors } from '../checkRawColors.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-raw-colors-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkRawColors', () => {
  it('fails on raw colors in feature or component code', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend/src/features'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/Bad.tsx'),
      'export const accent = "#ff00aa";\nexport const wash = "rgba(0, 0, 0, 0.2)";\n'
    );
    const issues = checkRawColors({ projectRoot: root });
    expect(issues.length).toBeGreaterThan(0);
  });

  it('allows tokens.css and the icons module', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend/src/styles'), { recursive: true });
    fs.mkdirSync(path.join(root, 'frontend/src/shared/components/icons'), { recursive: true });
    fs.mkdirSync(path.join(root, 'frontend/src/features'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'frontend/src/styles/tokens.css'),
      ':root { --background: oklch(1 0 0); --accent: #111111; }\n'
    );
    fs.writeFileSync(
      path.join(root, 'frontend/src/shared/components/icons/appIcons.ts'),
      'export const FALLBACK = "#000000";\n'
    );
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/Ok.tsx'),
      'export function Ok() { return "bg-background text-foreground"; }\n'
    );
    expect(
      checkRawColors({
        projectRoot: root,
        tokensCss: 'frontend/src/styles/tokens.css',
      })
    ).toEqual([]);
  });
});
