import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkConfigs, syncConfigs } from '../checkConfigs.ts';
import { readPackageText } from '../paths.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-configs-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkConfigs allowlist', () => {
  it('passes when package keys match and ignorePatterns is present', () => {
    const root = makeScratch();
    const packageFmt = JSON.parse(readPackageText('configs/oxfmtrc.json')) as Record<
      string,
      unknown
    >;
    fs.writeFileSync(
      path.join(root, '.oxfmtrc.json'),
      `${JSON.stringify({ ...packageFmt, ignorePatterns: ['mockServiceWorker.js'] }, null, 2)}\n`
    );
    fs.writeFileSync(path.join(root, '.oxlintrc.json'), readPackageText('configs/oxlintrc.json'));
    expect(checkConfigs(root, 'bun-ts')).toEqual([]);
  });

  it('fails on an unknown extra key', () => {
    const root = makeScratch();
    const packageFmt = JSON.parse(readPackageText('configs/oxfmtrc.json')) as Record<
      string,
      unknown
    >;
    fs.writeFileSync(
      path.join(root, '.oxfmtrc.json'),
      `${JSON.stringify({ ...packageFmt, plugins: [] }, null, 2)}\n`
    );
    fs.writeFileSync(path.join(root, '.oxlintrc.json'), readPackageText('configs/oxlintrc.json'));
    const issues = checkConfigs(root, 'bun-ts');
    expect(
      issues.some((issue) => issue.file === '.oxfmtrc.json' && issue.message.includes('"plugins"'))
    ).toBe(true);
  });

  it('sync keeps ignorePatterns when merging package keys', () => {
    const root = makeScratch();
    fs.writeFileSync(
      path.join(root, '.oxfmtrc.json'),
      `${JSON.stringify({ ignorePatterns: ['mockServiceWorker.js'], semi: false }, null, 2)}\n`
    );
    const results = syncConfigs(root, 'bun-ts');
    expect(results.find((result) => result.file === '.oxfmtrc.json')?.status).toBe('written');
    const merged = JSON.parse(fs.readFileSync(path.join(root, '.oxfmtrc.json'), 'utf8')) as {
      ignorePatterns: string[];
      semi: boolean;
    };
    expect(merged.ignorePatterns).toEqual(['mockServiceWorker.js']);
    expect(merged.semi).toBe(true);
    expect(checkConfigs(root, 'bun-ts').filter((issue) => issue.file === '.oxfmtrc.json')).toEqual(
      []
    );
  });
});

describe('python ruff extend', () => {
  it('sync writes ruff.base.toml and extend stub when ruff.toml is absent', () => {
    const root = makeScratch();
    const results = syncConfigs(root, 'python');
    expect(results.map((result) => result.file)).toEqual(['ruff.base.toml', 'ruff.toml']);
    expect(fs.readFileSync(path.join(root, 'ruff.base.toml'), 'utf8')).toBe(
      readPackageText('configs/ruff.base.toml')
    );
    expect(fs.readFileSync(path.join(root, 'ruff.toml'), 'utf8')).toContain(
      'extend = "ruff.base.toml"'
    );
    expect(checkConfigs(root, 'python')).toEqual([]);
  });

  it('sync does not clobber an existing ruff.toml', () => {
    const root = makeScratch();
    fs.writeFileSync(
      path.join(root, 'ruff.toml'),
      `extend = "ruff.base.toml"\n\n[lint]\nselect = ["E"]\n`
    );
    syncConfigs(root, 'python');
    expect(fs.readFileSync(path.join(root, 'ruff.toml'), 'utf8')).toContain('select = ["E"]');
    expect(checkConfigs(root, 'python')).toEqual([]);
  });
});
