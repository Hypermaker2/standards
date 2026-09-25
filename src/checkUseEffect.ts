import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';
import { isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const TS_EXTENSIONS = new Set(['.ts', '.tsx']);

const USE_EFFECT_PATTERN = new RegExp('\\b' + 'use' + 'Effect' + '\\b');

type UseEffectScanOptions = {
  projectRoot: string;
  effectWrappers?: string[];
};

function lineOfMatch(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

const EFFECT_HOOK = 'use' + 'Effect';

function effectCalleeNames(text: string): string[] {
  const names = new Set<string>([EFFECT_HOOK]);
  const aliasPattern = new RegExp(
    String.raw`\b` + EFFECT_HOOK + String.raw`\s+as\s+([A-Za-z_][A-Za-z0-9_]*)`,
    'g'
  );
  for (const match of text.matchAll(aliasPattern)) {
    names.add(match[1]);
  }
  return [...names];
}

function checkWrapperShape(relativePath: string, text: string): CheckIssue[] {
  const issues: CheckIssue[] = [];

  const optionalDeps = /\bdeps\s*\?/.exec(text);
  if (optionalDeps) {
    issues.push({
      file: relativePath,
      line: lineOfMatch(text, optionalDeps.index),
      message: 'effect wrapper deps parameter must be required, not optional',
    });
  }

  const mountWithDeps = /export\s+function\s+useMountEffect\s*\(\s*[^)]*?,\s*[^)]*?\)/.exec(text);
  if (mountWithDeps) {
    issues.push({
      file: relativePath,
      line: lineOfMatch(text, mountWithDeps.index),
      message: 'useMountEffect must not accept a deps parameter',
    });
  }

  if (/export\s+function\s+useMountEffect\b/.test(text)) {
    const callees = effectCalleeNames(text);
    const hasEmptyDepsCall = callees.some((name) =>
      new RegExp(`\\b${name}\\(\\s*effect\\s*,\\s*\\[\\]\\s*\\)`).test(text)
    );
    if (!hasEmptyDepsCall) {
      issues.push({
        file: relativePath,
        line: 1,
        message:
          'useMountEffect must call the effect hook as (effect, []) or the aliased import with []',
      });
    }
  }

  return issues;
}

export function checkUseEffect(options: UseEffectScanOptions): CheckIssue[] {
  const wrappers = options.effectWrappers ?? [];
  const allowed = new Set(wrappers);
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: TS_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];

  for (const relativePath of wrappers) {
    const absolutePath = path.join(options.projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      issues.push({
        file: relativePath,
        line: 1,
        message: 'effectWrappers path not found',
      });
      continue;
    }
    const text = fs.readFileSync(absolutePath, 'utf8');
    issues.push(...checkWrapperShape(relativePath, text));
  }

  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTestLikePath(relativePath)) continue;
    if (allowed.has(relativePath)) continue;
    const lines = fs.readFileSync(absolutePath, 'utf8').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      if (!USE_EFFECT_PATTERN.test(lines[index])) continue;
      issues.push({
        file: relativePath,
        line: index + 1,
        message: 'direct React effect hook is only allowed in effectWrappers',
      });
    }
  }
  return issues;
}
