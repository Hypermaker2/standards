import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkTokens } from '../checkTokens.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-tokens-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const LIGHT_ROLES = `  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --positive: oklch(0.55 0.15 150);
  --negative: oklch(0.55 0.19 25);
  --chart-1: oklch(0.6 0.121 245);
  --chart-2: oklch(0.6 0.207 300);
  --chart-3: oklch(0.6 0.195 25);
  --chart-4: oklch(0.6 0.133 150);
  --chart-5: oklch(0.6 0.102 75);
  --radius: 0.625rem;`;

const DARK_ROLES = `  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --positive: oklch(0.72 0.15 150);
  --negative: oklch(0.7 0.17 25);
  --chart-1: oklch(0.72 0.125 245);
  --chart-2: oklch(0.72 0.138 300);
  --chart-3: oklch(0.72 0.139 25);
  --chart-4: oklch(0.72 0.159 150);
  --chart-5: oklch(0.72 0.122 75);`;

const VALID = `:root {
${LIGHT_ROLES}
}

.dark {
${DARK_ROLES}
}
`;

describe('checkTokens', () => {
  it('passes a complete token file', () => {
    const root = makeScratch();
    const relative = 'tokens.css';
    fs.writeFileSync(path.join(root, relative), VALID);
    expect(checkTokens(root, relative)).toEqual([]);
  });

  it('fails when a color role is missing in .dark', () => {
    const root = makeScratch();
    const relative = 'tokens.css';
    const broken = VALID.replace('  --positive: oklch(0.72 0.15 150);\n', '');
    fs.writeFileSync(path.join(root, relative), broken);
    const issues = checkTokens(root, relative);
    expect(
      issues.some(
        (issue) => issue.message.includes('--positive') && issue.message.includes('.dark')
      )
    ).toBe(true);
  });

  it('fails on an extra color-like role', () => {
    const root = makeScratch();
    const relative = 'tokens.css';
    const extra = VALID.replace(
      '  --radius: 0.625rem;',
      '  --brand: oklch(0.5 0.1 40);\n  --radius: 0.625rem;'
    ).replace('.dark {\n', '.dark {\n  --brand: oklch(0.6 0.1 40);\n');
    fs.writeFileSync(path.join(root, relative), extra);
    const issues = checkTokens(root, relative);
    expect(
      issues.some(
        (issue) => issue.message.includes('--brand') && issue.message.includes('extraRoles')
      )
    ).toBe(true);
  });

  it('aggregates a media-query :root before the main :root block', () => {
    const root = makeScratch();
    const relative = 'tokens.css';
    const css = `@media (min-width: 768px) {
  :root {
    --size-control-height: 32px;
  }
}

:root {
${LIGHT_ROLES}
}

.dark {
${DARK_ROLES}
}
`;
    fs.writeFileSync(path.join(root, relative), css);
    expect(checkTokens(root, relative)).toEqual([]);
  });

  it('accepts compound .dark, [data-theme=dark] selectors', () => {
    const root = makeScratch();
    const relative = 'tokens.css';
    const css = `:root {
${LIGHT_ROLES}
}

.dark, [data-theme='dark'] {
${DARK_ROLES}
}
`;
    fs.writeFileSync(path.join(root, relative), css);
    expect(checkTokens(root, relative)).toEqual([]);
  });

  it('ignores @theme blocks for role detection', () => {
    const root = makeScratch();
    const relative = 'tokens.css';
    const css = `${VALID}
@theme inline {
  --color-background: var(--background);
  --brand: oklch(0.5 0.1 40);
}
`;
    fs.writeFileSync(path.join(root, relative), css);
    expect(checkTokens(root, relative)).toEqual([]);
  });

  it('passes when two :root blocks together define all roles', () => {
    const root = makeScratch();
    const relative = 'tokens.css';
    const css = `@media (prefers-reduced-motion: no-preference) {
  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
  }
}

:root {
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --positive: oklch(0.55 0.15 150);
  --negative: oklch(0.55 0.19 25);
  --chart-1: oklch(0.6 0.121 245);
  --chart-2: oklch(0.6 0.207 300);
  --chart-3: oklch(0.6 0.195 25);
  --chart-4: oklch(0.6 0.133 150);
  --chart-5: oklch(0.6 0.102 75);
  --radius: 0.625rem;
}

.dark {
${DARK_ROLES}
}
`;
    fs.writeFileSync(path.join(root, relative), css);
    expect(checkTokens(root, relative)).toEqual([]);
  });
});
