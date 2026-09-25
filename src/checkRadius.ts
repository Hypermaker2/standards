import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';
import { isTestLikePath, listProjectFiles, toRelative } from './projectFiles.ts';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);

const SIDE = '(?:t|r|b|l|tl|tr|br|bl|x|y|s|e|ss|se|es|ee)';
const NUMERIC = '(?:xs|sm|md|lg|xl|2xl|3xl|4xl)';
const ROUND = 'round' + 'ed';
const CLASS_HELPERS = new Set(['cn', 'clsx', 'cva']);

const FORBIDDEN_NUMERIC = new RegExp(`^!?${ROUND}-(?:${SIDE}-)?${NUMERIC}$`);
const FORBIDDEN_ARBITRARY = new RegExp(`^!?${ROUND}-(?:[a-z]+-)?\\[[^\\]]+\\]$`);
const FORBIDDEN_BARE = new RegExp(`^!?${ROUND}(?:-${SIDE})?$`);
const FORBIDDEN_VAR = /var\(--radius-(?:xs|sm|md|lg|xl|2xl|3xl|field)\)/;
const BORDER_RADIUS_DECL =
  /\bborder-(?:radius|(?:top|bottom)-(?:left|right)-radius|(?:start|end)-(?:start|end)-radius)\s*:\s*([^;]+)/gi;
const ALLOWED_RADIUS_VALUE =
  /^(?:0(?:px|rem|em|%)?|var\(--radius-(?:tight|control|inset|container|sheet|full|none)\))$/;

type RadiusScanOptions = {
  projectRoot: string;
};

type ClassSpan = {
  value: string;
  line: number;
};

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function stripTemplateExpressions(value: string): string {
  let out = '';
  let i = 0;
  while (i < value.length) {
    if (value[i] === '$' && value[i + 1] === '{') {
      let depth = 1;
      i += 2;
      while (i < value.length && depth > 0) {
        const ch = value[i];
        if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
        i += 1;
      }
      out += ' ';
      continue;
    }
    out += value[i];
    i += 1;
  }
  return out;
}

function readQuoted(
  text: string,
  start: number
): { value: string; end: number; quote: string } | null {
  const quote = text[start];
  if (quote !== '"' && quote !== "'" && quote !== '`') return null;
  let i = start + 1;
  let value = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      value += ch + (text[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (quote === '`' && ch === '$' && text[i + 1] === '{') {
      value += '${';
      i += 2;
      let depth = 1;
      while (i < text.length && depth > 0) {
        const inner = text[i];
        value += inner;
        if (inner === '{') depth += 1;
        else if (inner === '}') depth -= 1;
        i += 1;
      }
      continue;
    }
    if (ch === quote) {
      return { value: quote === '`' ? stripTemplateExpressions(value) : value, end: i + 1, quote };
    }
    value += ch;
    i += 1;
  }
  return null;
}

function skipString(text: string, start: number): number {
  const quoted = readQuoted(text, start);
  return quoted ? quoted.end : start + 1;
}

function extractStringsInRange(text: string, from: number, to: number): ClassSpan[] {
  const spans: ClassSpan[] = [];
  let i = from;
  while (i < to) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quoted = readQuoted(text, i);
      if (!quoted) {
        i += 1;
        continue;
      }
      spans.push({ value: quoted.value, line: lineOf(text, i) });
      i = quoted.end;
      continue;
    }
    i += 1;
  }
  return spans;
}

function findMatchingParen(text: string, openIndex: number): number {
  let depth = 0;
  let i = openIndex;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipString(text, i);
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

function extractHelperClassStrings(text: string): ClassSpan[] {
  const spans: ClassSpan[] = [];
  const pattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  for (const match of text.matchAll(pattern)) {
    const name = match[1];
    if (!CLASS_HELPERS.has(name)) continue;
    const openIndex = match.index + match[0].length - 1;
    const closeIndex = findMatchingParen(text, openIndex);
    if (closeIndex === -1) continue;
    spans.push(...extractStringsInRange(text, openIndex + 1, closeIndex));
  }
  return spans;
}

function extractAttrClassStrings(text: string): ClassSpan[] {
  const spans: ClassSpan[] = [];
  const pattern = /\bclass(?:Name)?\s*=/g;
  for (const match of text.matchAll(pattern)) {
    let i = match.index + match[0].length;
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (text[i] === '{') {
      i += 1;
      while (i < text.length && /\s/.test(text[i])) i += 1;
    }
    const quoted = readQuoted(text, i);
    if (!quoted) continue;
    spans.push({ value: quoted.value, line: lineOf(text, i) });
  }
  return spans;
}

function extractApplyClassStrings(text: string): ClassSpan[] {
  const spans: ClassSpan[] = [];
  const pattern = /@apply\b([^;{}]*)/g;
  for (const match of text.matchAll(pattern)) {
    spans.push({ value: match[1], line: lineOf(text, match.index) });
  }
  return spans;
}

function classSpansForFile(text: string, relativePath: string): ClassSpan[] {
  const ext = path.extname(relativePath);
  if (ext === '.css') return extractApplyClassStrings(text);
  if (ext === '.html') return extractAttrClassStrings(text);
  return [...extractAttrClassStrings(text), ...extractHelperClassStrings(text)];
}

function utilityToken(token: string): string {
  const sliced = token.includes(':') ? token.slice(token.lastIndexOf(':') + 1) : token;
  return sliced.trim();
}

function classTokenIssue(token: string): string | null {
  const utility = utilityToken(token);
  if (utility.length === 0) return null;
  if (FORBIDDEN_NUMERIC.test(utility)) {
    return 'numeric radius scale classes are not allowed; use role utilities (tight|control|inset|container|sheet|full|none)';
  }
  if (FORBIDDEN_ARBITRARY.test(utility)) {
    return 'arbitrary radius bracket values are not allowed';
  }
  if (FORBIDDEN_BARE.test(utility)) {
    return 'default radius utility is not allowed; use a radius role';
  }
  return null;
}

function isAllowedBorderRadiusValue(value: string): boolean {
  const parts = value
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return false;
  return parts.every((part) => ALLOWED_RADIUS_VALUE.test(part));
}

export function checkRadius(options: RadiusScanOptions): CheckIssue[] {
  const files = listProjectFiles({
    projectRoot: options.projectRoot,
    extensions: SOURCE_EXTENSIONS,
  });
  const issues: CheckIssue[] = [];
  for (const absolutePath of files) {
    const relativePath = toRelative(options.projectRoot, absolutePath);
    if (isTestLikePath(relativePath)) continue;
    const text = fs.readFileSync(absolutePath, 'utf8');
    for (const span of classSpansForFile(text, relativePath)) {
      for (const token of span.value.split(/\s+/)) {
        const message = classTokenIssue(token);
        if (!message) continue;
        issues.push({ file: relativePath, line: span.line, message });
      }
    }
    const lines = text.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (FORBIDDEN_VAR.test(line)) {
        issues.push({
          file: relativePath,
          line: index + 1,
          message: 'use var(--radius-tight|control|inset|container|sheet|full|none)',
        });
      }
      for (const match of line.matchAll(BORDER_RADIUS_DECL)) {
        if (isAllowedBorderRadiusValue(match[1])) continue;
        issues.push({
          file: relativePath,
          line: index + 1,
          message: 'border-radius must use 0 or var(--radius-<role>)',
        });
      }
    }
  }
  return issues;
}
