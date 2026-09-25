import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';
import { readPackageText } from './paths.ts';

export type RolesCatalog = {
  colorRoles: string[];
  otherRoles: string[];
};

const COLOR_VALUE_RE = /^(oklch\(|hsl\(|rgb\(|#|var\(--)/i;

function loadRoles(): RolesCatalog {
  return JSON.parse(readPackageText('design/roles.json')) as RolesCatalog;
}

function extractBlock(css: string, selector: string): string | null {
  const pattern = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = pattern.exec(css);
  if (!match) return null;
  return match[1];
}

function parseCustomProperties(block: string): Map<string, string> {
  const props = new Map<string, string>();
  const pattern = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  for (const match of block.matchAll(pattern)) {
    props.set(match[1], match[2].trim());
  }
  return props;
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
  const rootBlock = extractBlock(css, ':root');
  const darkBlock = extractBlock(css, '\\.dark');

  if (!rootBlock) {
    issues.push({
      file: tokensCssRelative,
      line: 1,
      message: 'missing :root block',
    });
    return issues;
  }
  if (!darkBlock) {
    issues.push({
      file: tokensCssRelative,
      line: 1,
      message: 'missing .dark block',
    });
    return issues;
  }

  const rootProps = parseCustomProperties(rootBlock);
  const darkProps = parseCustomProperties(darkBlock);

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
