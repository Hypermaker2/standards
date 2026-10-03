import type { CheckIssue } from './paths.ts';

export function checkTestBaseline(
  key: string,
  measured: number,
  baseline: number | undefined
): CheckIssue[] {
  if (baseline === undefined) {
    return [
      {
        file: 'standards.json',
        line: 1,
        message: `${key} is required for bun-ts; measured ${measured}; set ${key} to ${measured}`,
      },
    ];
  }
  if (measured > baseline) {
    return [
      {
        file: 'standards.json',
        line: 1,
        message: `${key}: measured ${measured} exceeds frozen ${baseline}; never raise without the user's explicit approval`,
      },
    ];
  }
  if (measured < baseline * 0.98) {
    return [
      {
        file: 'standards.json',
        line: 1,
        message: `${key}: measured ${measured} is more than 2% below frozen ${baseline}; lower ${key} to ${measured}`,
      },
    ];
  }
  return [];
}
