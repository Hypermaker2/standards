import type { CheckIssue } from './paths.ts';
import { checkTestBaseline } from './testBaseline.ts';
import type { TestInventory } from './testFiles.ts';

export function checkTestBudget(inventory: TestInventory, lines: number | undefined): CheckIssue[] {
  return checkTestBaseline('testBudget.lines', inventory.lines, lines);
}
