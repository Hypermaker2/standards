import fs from 'node:fs';
import path from 'node:path';
import { syncConfigs } from './checkConfigs.ts';
import { applyManagedRegion, expectedAgentsBody } from './managedRegion.ts';
import { packageVersion, readPackageText, type Profile, type StandardsConfig } from './paths.ts';

export type SyncInitOptions = {
  profile: Profile;
  design?: string;
};

export type SyncResult = {
  file: string;
  status: 'written' | 'unchanged';
};

function writeTextIfChanged(targetPath: string, contents: string): 'written' | 'unchanged' {
  if (fs.existsSync(targetPath)) {
    const existing = fs.readFileSync(targetPath, 'utf8');
    if (existing === contents) return 'unchanged';
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents);
  return 'written';
}

export function initStandardsConfig(projectRoot: string, options: SyncInitOptions): SyncResult {
  const configPath = path.join(projectRoot, 'standards.json');
  const config: StandardsConfig = {
    profile: options.profile,
    design: typeof options.design === 'string',
  };
  if (config.design) {
    config.tokensCss = options.design;
  }
  const contents = `${JSON.stringify(config, null, 2)}\n`;
  return {
    file: 'standards.json',
    status: writeTextIfChanged(configPath, contents),
  };
}

function ensureDocFile(projectRoot: string, relativePath: string, title: string): string {
  const absolute = path.join(projectRoot, relativePath);
  if (fs.existsSync(absolute)) {
    return fs.readFileSync(absolute, 'utf8');
  }
  const seed = `# ${title}\n`;
  fs.writeFileSync(absolute, seed);
  return seed;
}

export function syncProject(projectRoot: string, config: StandardsConfig): SyncResult[] {
  const version = packageVersion();
  const results: SyncResult[] = [];

  const agentsPath = path.join(projectRoot, 'AGENTS.md');
  const agentsExisting = ensureDocFile(projectRoot, 'AGENTS.md', 'Project');
  const agentsBody = expectedAgentsBody(
    readPackageText('agents/base.md'),
    readPackageText(`agents/profile-${config.profile}.md`)
  );
  const agentsNext = applyManagedRegion(agentsExisting, version, config.profile, agentsBody);
  results.push({
    file: 'AGENTS.md',
    status: writeTextIfChanged(agentsPath, agentsNext),
  });

  if (config.design) {
    const designPath = path.join(projectRoot, 'DESIGN.md');
    const designExisting = ensureDocFile(projectRoot, 'DESIGN.md', 'Design');
    const designBody = readPackageText('design/base.md').replace(/\n$/, '');
    const designNext = applyManagedRegion(designExisting, version, config.profile, designBody);
    results.push({
      file: 'DESIGN.md',
      status: writeTextIfChanged(designPath, designNext),
    });
  }

  results.push(...syncConfigs(projectRoot, config.profile));
  return results;
}
