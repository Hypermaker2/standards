import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkProject } from '../check.ts';
import {
  expectedAgentsBody,
  expectedMultiAgentsBody,
  findManagedRegion,
} from '../managedRegion.ts';
import { loadStandardsConfig, profileMarker, readPackageText } from '../paths.ts';
import { syncProject } from '../sync.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-multi-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function writeMinimalBunPackage(dir: string): void {
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'app',
        scripts: {
          dev: 'echo',
          build: 'echo',
          test: 'echo',
          typecheck: 'echo',
          lint: 'oxlint && knip',
          format: 'echo',
          'format:check': 'echo',
          check: 'bun run lint && bun run audit',
          knip: 'knip',
          audit: 'bun audit --audit-level=high',
        },
      },
      null,
      2
    )
  );
}

describe('multi-profile standards', () => {
  it('keeps a single-profile agents body unchanged', () => {
    const base = readPackageText('agents/base.md');
    const profile = readPackageText('agents/profile-bun-ts.md');
    const body = expectedAgentsBody(base, profile);
    expect(body.startsWith('## Working in this repo')).toBe(true);
    expect(body).toContain('## Bun / TypeScript stack\n');
    expect(body).not.toContain('(frontend/)');
  });

  it('builds one agents block with base once and rooted profile headings', () => {
    const body = expectedMultiAgentsBody(readPackageText('agents/base.md'), [
      { profileMd: readPackageText('agents/profile-python.md'), root: '.' },
      { profileMd: readPackageText('agents/profile-bun-ts.md'), root: 'frontend' },
    ]);
    expect(body.indexOf('## Working in this repo')).toBe(
      body.lastIndexOf('## Working in this repo')
    );
    expect(body).toContain('## Python stack\n');
    expect(body).toContain('## Bun / TypeScript stack (frontend/)');
    expect(
      profileMarker([
        { profile: 'python', root: '.' },
        { profile: 'bun-ts', root: 'frontend' },
      ])
    ).toBe('python+bun-ts');
  });

  it('syncs configs under the profile root and one AGENTS.md marker', () => {
    const root = makeScratch();
    fs.writeFileSync(
      path.join(root, 'standards.json'),
      JSON.stringify(
        {
          profiles: [
            { profile: 'python', root: '.' },
            {
              profile: 'bun-ts',
              root: 'frontend',
              design: true,
              tokensCss: 'src/styles/tokens.css',
            },
          ],
        },
        null,
        2
      )
    );
    fs.mkdirSync(path.join(root, 'frontend', 'src', 'styles'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'frontend', 'src', 'styles', 'tokens.css'),
      `:root { --background: oklch(1 0 0); --foreground: oklch(0 0 0); }\n.dark { --background: oklch(0 0 0); --foreground: oklch(1 0 0); }\n`
    );
    writeMinimalBunPackage(path.join(root, 'frontend'));
    fs.writeFileSync(
      path.join(root, 'pyproject.toml'),
      `[project]\nname = "demo"\nversion = "0.1.0"\n[tool.pytest.ini_options]\n`
    );

    const results = syncProject(root, loadStandardsConfig(root));
    expect(results.some((result) => result.file === 'AGENTS.md')).toBe(true);
    expect(results.some((result) => result.file === path.join('frontend', '.oxlintrc.json'))).toBe(
      true
    );
    expect(results.some((result) => result.file === 'ruff.base.toml')).toBe(true);
    expect(fs.existsSync(path.join(root, 'frontend', 'AGENTS.md'))).toBe(false);

    const region = findManagedRegion(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'));
    expect(region?.profile).toBe('python+bun-ts');
    expect(region?.body).toContain('## Bun / TypeScript stack (frontend/)');
  });

  it('errors when a nested standards.json overlaps a profiles root', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend'));
    fs.writeFileSync(
      path.join(root, 'standards.json'),
      JSON.stringify(
        {
          profiles: [
            { profile: 'python', root: '.' },
            { profile: 'bun-ts', root: 'frontend' },
          ],
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(root, 'frontend', 'standards.json'),
      JSON.stringify({ profile: 'bun-ts', design: false }, null, 2)
    );
    writeMinimalBunPackage(path.join(root, 'frontend'));
    fs.writeFileSync(
      path.join(root, 'pyproject.toml'),
      `[project]\nname = "demo"\nversion = "0.1.0"\n[tool.pytest.ini_options]\n`
    );
    syncProject(root, loadStandardsConfig(root));
    const issues = checkProject(root, loadStandardsConfig(root));
    expect(
      issues.some((issue) =>
        issue.message.includes('nested standards.json conflicts with root profiles entry')
      )
    ).toBe(true);
  });

  it('reports bun-ts violations under the profile root path', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend', 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'standards.json'),
      JSON.stringify(
        {
          profiles: [
            { profile: 'python', root: '.' },
            { profile: 'bun-ts', root: 'frontend' },
          ],
        },
        null,
        2
      )
    );
    writeMinimalBunPackage(path.join(root, 'frontend'));
    fs.writeFileSync(
      path.join(root, 'pyproject.toml'),
      `[project]\nname = "demo"\nversion = "0.1.0"\n[tool.pytest.ini_options]\n`
    );
    fs.writeFileSync(
      path.join(root, 'frontend', 'src', 'App.tsx'),
      `import { useEffect } from 'react';\nuseEffect(() => {});\n`
    );
    syncProject(root, loadStandardsConfig(root));
    const issues = checkProject(root, loadStandardsConfig(root));
    expect(issues.some((issue) => issue.file === path.join('frontend', 'src', 'App.tsx'))).toBe(
      true
    );
  });
});
