import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkHttpClientImports } from '../checkHttpClientImports.ts';

const scratchDirs: string[] = [];

function makeScratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'standards-http-client-'));
  scratchDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('checkHttpClientImports', () => {
  it('fails when feature code imports the HTTP client', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend/src/features/chat'), { recursive: true });
    fs.mkdirSync(path.join(root, 'frontend/src/shared/lib'), { recursive: true });
    fs.writeFileSync(path.join(root, 'frontend/src/shared/lib/api.ts'), 'export const api = {};\n');
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/chat/useChat.ts'),
      `import { api } from '@/shared/lib/api';
export function useChat() { return api; }
`
    );
    const issues = checkHttpClientImports({ projectRoot: root });
    expect(issues.some((issue) => issue.message.includes('HTTP client'))).toBe(true);
  });

  it('passes when only queries/services import the HTTP client', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'frontend/src/features/chat'), { recursive: true });
    fs.mkdirSync(path.join(root, 'frontend/src/shared/queries'), { recursive: true });
    fs.mkdirSync(path.join(root, 'frontend/src/shared/lib'), { recursive: true });
    fs.writeFileSync(path.join(root, 'frontend/src/shared/lib/api.ts'), 'export const api = {};\n');
    fs.writeFileSync(
      path.join(root, 'frontend/src/shared/queries/useHealth.ts'),
      `import { api } from '@/shared/lib/api';
export function useHealth() { return api; }
`
    );
    fs.writeFileSync(
      path.join(root, 'frontend/src/features/chat/ChatPage.tsx'),
      `import { useHealth } from '@/shared/queries/useHealth';
export function ChatPage() { return useHealth(); }
`
    );
    expect(checkHttpClientImports({ projectRoot: root })).toEqual([]);
  });

  it('honors an explicit httpClientModule suffix', () => {
    const root = makeScratch();
    fs.mkdirSync(path.join(root, 'src/features'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'src/features/Bad.ts'),
      `import { client } from '../net/transport';
export const x = client;
`
    );
    const issues = checkHttpClientImports({
      projectRoot: root,
      httpClientModule: 'net/transport',
    });
    expect(issues).toHaveLength(1);
  });
});
