import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';
import { readPackageText } from './paths.ts';

export type RolesCatalog = {
  colorRoles: string[];
  otherRoles: string[];
};

const COLOR_VALUE_RE = new RegExp('^(?:oklch\\(|hsl\\(|rgb\\(|#|var\\()', 'i');
const CUSTOM_PROPERTY_RE = new RegExp('(?:--)([a-z0-9-]+)\\s*:\\s*([^;]+);', 'gi');

function loadRoles(): RolesCatalog {
  return JSON.parse(readPackageText('design/roles.json')) as RolesCatalog;
}

function parseCustomProperties(block: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const match of block.matchAll(CUSTOM_PROPERTY_RE)) {
    props.set(match[1], match[2].trim());
  }
  return props;
}

function skipComment(css: string, index: number): number {
  if (css.startsWith('/*', index)) {
    const end = css.indexOf('*/', index + 2);
    return end === -1 ? css.length : end + 2;
  }
  return index;
}

function skipString(css: string, index: number): number {
  const quote = css[index];
  if (quote !== '"' && quote !== "'") return index;
  let i = index + 1;
  while (i < css.length) {
    if (css[i] === '\\') {
      i += 2;
      continue;
    }
    if (css[i] === quote) return i + 1;
    i += 1;
  }
  return css.length;
}

function skipWhitespaceAndComments(css: string, index: number): number {
  let i = index;
  while (i < css.length) {
    if (/\s/.test(css[i])) {
      i += 1;
      continue;
    }
    const afterComment = skipComment(css, i);
    if (afterComment !== i) {
      i = afterComment;
      continue;
    }
    break;
  }
  return i;
}

function readBalancedBlock(css: string, openBrace: number): { body: string; end: number } {
  let depth = 0;
  let i = openBrace;
  while (i < css.length) {
    const afterComment = skipComment(css, i);
    if (afterComment !== i) {
      i = afterComment;
      continue;
    }
    const afterString = skipString(css, i);
    if (afterString !== i) {
      i = afterString;
      continue;
    }
    const ch = css[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { body: css.slice(openBrace + 1, i), end: i + 1 };
      }
    }
    i += 1;
  }
  return { body: css.slice(openBrace + 1), end: css.length };
}

function selectorParts(selectorList: string): string[] {
  return selectorList
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function isLightRootSelector(part: string): boolean {
  if (/\.dark\b/.test(part)) return false;
  return /(^|[^a-zA-Z0-9_-]):root\b/.test(` ${part}`);
}

function isDarkSelector(part: string): boolean {
  return /\.dark\b/.test(part);
}

function classifySelectorList(selectorList: string): { light: boolean; dark: boolean } {
  const parts = selectorParts(selectorList);
  return {
    light: parts.some(isLightRootSelector),
    dark: parts.some(isDarkSelector),
  };
}

function mergeProps(target: Map<string, string>, source: Map<string, string>): void {
  for (const [name, value] of source) {
    target.set(name, value);
  }
}

function scanCss(css: string, light: Map<string, string>, dark: Map<string, string>): void {
  let i = 0;
  while (i < css.length) {
    i = skipWhitespaceAndComments(css, i);
    if (i >= css.length) break;

    if (css[i] === '@') {
      const nameMatch = /^@([a-zA-Z0-9_-]+)/.exec(css.slice(i));
      if (!nameMatch) {
        i += 1;
        continue;
      }
      const atName = nameMatch[1].toLowerCase();
      i += nameMatch[0].length;
      i = skipWhitespaceAndComments(css, i);

      if (atName === 'theme') {
        while (i < css.length && css[i] !== '{' && css[i] !== ';') {
          const afterComment = skipComment(css, i);
          if (afterComment !== i) {
            i = afterComment;
            continue;
          }
          const afterString = skipString(css, i);
          if (afterString !== i) {
            i = afterString;
            continue;
          }
          i += 1;
        }
        if (i < css.length && css[i] === '{') {
          i = readBalancedBlock(css, i).end;
        } else if (i < css.length && css[i] === ';') {
          i += 1;
        }
        continue;
      }

      while (i < css.length && css[i] !== '{' && css[i] !== ';') {
        const afterComment = skipComment(css, i);
        if (afterComment !== i) {
          i = afterComment;
          continue;
        }
        const afterString = skipString(css, i);
        if (afterString !== i) {
          i = afterString;
          continue;
        }
        i += 1;
      }
      if (i < css.length && css[i] === '{') {
        const block = readBalancedBlock(css, i);
        scanCss(block.body, light, dark);
        i = block.end;
      } else if (i < css.length && css[i] === ';') {
        i += 1;
      }
      continue;
    }

    const selectorStart = i;
    while (i < css.length && css[i] !== '{') {
      const afterComment = skipComment(css, i);
      if (afterComment !== i) {
        i = afterComment;
        continue;
      }
      const afterString = skipString(css, i);
      if (afterString !== i) {
        i = afterString;
        continue;
      }
      i += 1;
    }
    if (i >= css.length || css[i] !== '{') break;
    const selectorList = css.slice(selectorStart, i).trim();
    const block = readBalancedBlock(css, i);
    const classification = classifySelectorList(selectorList);
    if (classification.light || classification.dark) {
      const props = parseCustomProperties(block.body);
      if (classification.light) mergeProps(light, props);
      if (classification.dark) mergeProps(dark, props);
    }
    i = block.end;
  }
}

export function collectThemeProperties(css: string): {
  light: Map<string, string>;
  dark: Map<string, string>;
} {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  scanCss(css, light, dark);
  return { light, dark };
}

export function checkTokens(
  projectRoot: string,
  tokensCssRelative: string,
  extraRoles: string[] = []
): CheckIssue[] {
  const roles = loadRoles();
  const known = new Set([...roles.colorRoles, ...roles.otherRoles, ...extraRoles]);
  const filePath = path.join(projectRoot, tokensCssRelative);
  const issues: CheckIssue[] = [];

  if (!fs.existsSync(filePath)) {
    issues.push({
      file: tokensCssRelative,
      line: 1,
      message: 'tokensCss file not found',
    });
    return issues;
  }

  const css = fs.readFileSync(filePath, 'utf8');
  const { light: rootProps, dark: darkProps } = collectThemeProperties(css);

  if (rootProps.size === 0) {
    issues.push({
      file: tokensCssRelative,
      line: 1,
      message: 'missing :root block',
    });
    return issues;
  }
  if (darkProps.size === 0) {
    issues.push({
      file: tokensCssRelative,
      line: 1,
      message: 'missing .dark block',
    });
    return issues;
  }

  for (const role of roles.colorRoles) {
    if (!rootProps.has(role)) {
      issues.push({
        file: tokensCssRelative,
        line: 1,
        message: `color role --${role} missing in :root`,
      });
    }
    if (!darkProps.has(role)) {
      issues.push({
        file: tokensCssRelative,
        line: 1,
        message: `color role --${role} missing in .dark`,
      });
    }
  }

  const seenUnknown = new Set<string>();
  for (const [name, value] of [...rootProps.entries(), ...darkProps.entries()]) {
    if (!COLOR_VALUE_RE.test(value)) continue;
    if (known.has(name)) continue;
    if (seenUnknown.has(name)) continue;
    seenUnknown.add(name);
    issues.push({
      file: tokensCssRelative,
      line: 1,
      message: `unknown color-like role --${name}; add it to standards.json "extraRoles": ["${name}"] or to @dino/standards design/roles.json`,
    });
  }

  return issues;
}
