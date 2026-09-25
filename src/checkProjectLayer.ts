import fs from 'node:fs';
import path from 'node:path';
import type { CheckIssue } from './paths.ts';

const DEFAULT_AGENTS_LAYER_MAX = 100;
const DEFAULT_DESIGN_LAYER_MAX = 40;

const END_MARKER = '<!-- standards:end -->';

type ProjectLayerBudgets = {
  agents: number;
  design: number;
};

export function countProjectLayerLines(text: string): number | null {
  const endIndex = text.indexOf(END_MARKER);
  if (endIndex === -1) return null;
  let rest = text.slice(endIndex + END_MARKER.length);
  if (rest.startsWith('\n')) {
    rest = rest.slice(1);
  }
  let count = 0;
  for (const line of rest.split('\n')) {
    if (line.trim() === '') continue;
    count += 1;
  }
  return count;
}

function checkDocLayer(projectRoot: string, relativePath: string, maxLines: number): CheckIssue[] {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return [
      {
        file: relativePath,
        line: 1,
        message: 'file missing; run standards sync',
      },
    ];
  }
  const text = fs.readFileSync(absolutePath, 'utf8');
  const count = countProjectLayerLines(text);
  if (count === null) {
    return [
      {
        file: relativePath,
        line: 1,
        message: 'missing standards managed region; run standards sync',
      },
    ];
  }
  if (count > maxLines) {
    return [
      {
        file: relativePath,
        line: 1,
        message: `project layer has ${count} lines (budget ${maxLines})`,
      },
    ];
  }
  return [];
}

type ProjectLayerOptions = {
  projectRoot: string;
  design: boolean;
  projectLayerMaxLines?: {
    agents?: number;
    design?: number;
  };
};

function resolveProjectLayerBudgets(
  projectLayerMaxLines?: ProjectLayerOptions['projectLayerMaxLines']
): ProjectLayerBudgets {
  return {
    agents: projectLayerMaxLines?.agents ?? DEFAULT_AGENTS_LAYER_MAX,
    design: projectLayerMaxLines?.design ?? DEFAULT_DESIGN_LAYER_MAX,
  };
}

export function checkProjectLayer(options: ProjectLayerOptions): CheckIssue[] {
  const budgets = resolveProjectLayerBudgets(options.projectLayerMaxLines);
  const issues = checkDocLayer(options.projectRoot, 'AGENTS.md', budgets.agents);
  if (options.design) {
    issues.push(...checkDocLayer(options.projectRoot, 'DESIGN.md', budgets.design));
  }
  return issues;
}
