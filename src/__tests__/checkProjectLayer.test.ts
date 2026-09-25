import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkProjectLayer, countProjectLayerLines } from '../checkProjectLayer.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-layer-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function writeAgents(root: string, projectLines: string[]): void {
  const body = [
    '# Demo',
    '<!-- standards:begin 1.2.0 bun-ts -->',
    'managed',
    '<!-- standards:end -->',
    '',
    ...projectLines,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(root, 'AGENTS.md'), body);
}

describe('checkProjectLayer', () => {
  it('counts non-blank project-layer lines after standards:end', () => {
    const text = [
      '# Demo',
      '<!-- standards:begin 1.2.0 bun-ts -->',
      'managed',
      '<!-- standards:end -->',
      '',
      '## Project',
      '',
      'One.',
      '',
      'Two.',
      '',
    ].join('\n');
    expect(countProjectLayerLines(text)).toBe(3);
  });

  it('passes when the project layer is within the default budget', () => {
    const root = makeScratch();
    writeAgents(root, ['## Project', 'short']);
    expect(
      checkProjectLayer({
        projectRoot: root,
        design: false,
      })
    ).toEqual([]);
  });

  it('fails when the project layer exceeds the configured budget', () => {
    const root = makeScratch();
    const lines = Array.from({ length: 5 }, (_, index) => `- item ${index}`);
    writeAgents(root, ['## Project', ...lines]);
    const issues = checkProjectLayer({
      projectRoot: root,
      design: false,
      projectLayerMaxLines: { agents: 3 },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe('AGENTS.md');
    expect(issues[0].message).toContain('budget 3');
  });

  it('uses a custom design budget when design is enabled', () => {
    const root = makeScratch();
    writeAgents(root, ['## Project', 'ok']);
    fs.writeFileSync(
      path.join(root, 'DESIGN.md'),
      [
        '# Design',
        '<!-- standards:begin 1.2.0 bun-ts -->',
        'managed',
        '<!-- standards:end -->',
        '',
        '## Project',
        'one',
        'two',
        'three',
        '',
      ].join('\n')
    );
    expect(
      checkProjectLayer({
        projectRoot: root,
        design: true,
        projectLayerMaxLines: { design: 2 },
      })[0].message
    ).toContain('budget 2');
    expect(
      checkProjectLayer({
        projectRoot: root,
        design: true,
        projectLayerMaxLines: { design: 10 },
      })
    ).toEqual([]);
  });
});
