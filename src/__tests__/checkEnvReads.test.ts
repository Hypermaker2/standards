import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkEnvReads } from '../checkEnvReads.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-env-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkEnvReads', () => {
  it('fails when configModules is missing and a runtime env read exists', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'app.ts'), `const port = process.env.PORT;\n`);
    const issues = checkEnvReads({ projectRoot: root });
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe(path.join('src', 'app.ts'));
    expect(issues[0].message).toContain('configModules');
  });

  it('allows listed config modules and always-exempt paths', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'src'));
    fs.mkdirSync(path.join(root, 'scripts'));
    fs.writeFileSync(path.join(root, 'src', 'config.ts'), `export const x = process.env.X;\n`);
    fs.writeFileSync(path.join(root, 'scripts', 'tool.ts'), `process.env.Y;\n`);
    fs.writeFileSync(path.join(root, 'vite.config.ts'), `process.env.Z;\n`);
    expect(
      checkEnvReads({
        projectRoot: root,
        configModules: [path.join('src', 'config.ts')],
      })
    ).toEqual([]);
  });

  it('rejects a config module that launders the raw environment object', () => {
    const root = makeScratch();
    const configPath = path.join('src', 'config.ts');
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(
      path.join(root, configPath),
      `export function runtimeProcessEnv() {\n  return process.env;\n}\nexport const envAlias = process.env;\nexport const merged = () => ({ ...process.env });\n`
    );
    const issues = checkEnvReads({
      projectRoot: root,
      configModules: [configPath],
    });
    expect(issues.length).toBeGreaterThanOrEqual(3);
    expect(issues.some((issue) => issue.message.includes('return'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('alias'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('spread'))).toBe(true);
  });

  it('allows a zod-parsing config module that reads env keys', () => {
    const root = makeScratch();
    const configPath = path.join('src', 'config.ts');
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(
      path.join(root, configPath),
      `import { z } from 'zod';\nconst schema = z.object({ PORT: z.string() });\nexport const config = schema.parse({\n  PORT: process.env.PORT,\n});\n`
    );
    expect(
      checkEnvReads({
        projectRoot: root,
        configModules: [configPath],
      })
    ).toEqual([]);
  });
});
