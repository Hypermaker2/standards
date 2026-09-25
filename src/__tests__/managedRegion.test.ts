import { describe, expect, it } from 'vitest';
import { applyManagedRegion, buildManagedBlock, findManagedRegion } from '../managedRegion.ts';

describe('managedRegion', () => {
  it('inserts a managed region after the title', () => {
    const input = '# Project\n\nProject notes.\n';
    const next = applyManagedRegion(input, '1.0.0', 'bun-ts', 'rule one');
    expect(next).toBe(
      `# Project\n${buildManagedBlock('1.0.0', 'bun-ts', 'rule one')}\nProject notes.\n`
    );
    const region = findManagedRegion(next);
    expect(region?.version).toBe('1.0.0');
    expect(region?.profile).toBe('bun-ts');
    expect(region?.body).toBe('rule one');
  });

  it('replaces an existing managed region without touching the rest', () => {
    const input = `# Project
${buildManagedBlock('0.9.0', 'bun-ts', 'old body')}

Keep me.
`;
    const next = applyManagedRegion(input, '1.0.0', 'bun-ts', 'new body');
    expect(next).toContain('Keep me.');
    expect(next).not.toContain('old body');
    const region = findManagedRegion(next);
    expect(region?.version).toBe('1.0.0');
    expect(region?.body).toBe('new body');
  });

  it('detects content drift against an expected body', () => {
    const text = `# Project
${buildManagedBlock('1.0.0', 'bun-ts', 'shipped body')}
`;
    const region = findManagedRegion(text);
    expect(region).not.toBeNull();
    expect(region?.body === 'expected body').toBe(false);
  });
});
