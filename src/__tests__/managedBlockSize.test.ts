import { describe, expect, it } from 'vitest';
import { expectedAgentsBody } from '../managedRegion.ts';
import { readPackageText } from '../paths.ts';

describe('managed block size', () => {
  it('keeps the bun-ts rendered block at most 7000 characters', () => {
    const body = expectedAgentsBody(
      readPackageText('agents/base.md'),
      readPackageText('agents/profile-bun-ts.md')
    );
    expect(body.length).toBeLessThanOrEqual(7000);
  });

  it('keeps the python rendered block at most 6000 characters', () => {
    const body = expectedAgentsBody(
      readPackageText('agents/base.md'),
      readPackageText('agents/profile-python.md')
    );
    expect(body.length).toBeLessThanOrEqual(6000);
  });
});
