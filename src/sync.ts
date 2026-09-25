import fs from 'node:fs';
import path from 'node:path';
import { syncBunVersion, syncCiWorkflow } from './checkCi.ts';
import { syncConfigs } from './checkConfigs.ts';
import {
  applyManagedRegion,
  expectedAgentsBody,
  expectedMultiAgentsBody,
} from './managedRegion.ts';
import {
  packageVersion,
  profileMarker,
  readPackageText,
  type Profile,
  type ProfileEntry,
  type StandardsConfig,
} from './paths.ts';

type SyncInitOptions = {
  profile: Profile;
  design?: string;
};

type SyncResult = {
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
  const config: Record<string, unknown> = {
    profile: options.profile,
    design: typeof options.design === 'string',
  };
  if (typeof options.design === 'string') {
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

function agentsBodyFor(config: StandardsConfig): string {
  const baseMd = readPackageText('agents/base.md');
  if (config.profiles.length === 1) {
    return expectedAgentsBody(
      baseMd,
      readPackageText(`agents/profile-${config.profiles[0].profile}.md`)
    );
  }
  return expectedMultiAgentsBody(
    baseMd,
    config.profiles.map((entry) => ({
      profileMd: readPackageText(`agents/profile-${entry.profile}.md`),
      root: entry.root,
    }))
  );
}

function syncProfileConfigs(projectRoot: string, entry: ProfileEntry): SyncResult[] {
  const absoluteRoot = entry.root === '.' ? projectRoot : path.join(projectRoot, entry.root);
  const results = syncConfigs(absoluteRoot, entry.profile);
  if (entry.root === '.') return results;
  return results.map((result) => ({
    ...result,
    file: path.join(entry.root, result.file),
  }));
}

export function syncProject(projectRoot: string, config: StandardsConfig): SyncResult[] {
  const version = packageVersion();
  const marker = profileMarker(config.profiles);
  const results: SyncResult[] = [];

  const agentsPath = path.join(projectRoot, 'AGENTS.md');
  const agentsExisting = ensureDocFile(projectRoot, 'AGENTS.md', 'Project');
  const agentsNext = applyManagedRegion(agentsExisting, version, marker, agentsBodyFor(config));
  results.push({
    file: 'AGENTS.md',
    status: writeTextIfChanged(agentsPath, agentsNext),
  });

  if (config.design) {
    const designPath = path.join(projectRoot, 'DESIGN.md');
    const designExisting = ensureDocFile(projectRoot, 'DESIGN.md', 'Design');
    const designBody = readPackageText('design/base.md').replace(/\n$/, '');
    const designNext = applyManagedRegion(designExisting, version, marker, designBody);
    results.push({
      file: 'DESIGN.md',
      status: writeTextIfChanged(designPath, designNext),
    });
  }

  for (const entry of config.profiles) {
    results.push(...syncProfileConfigs(projectRoot, entry));
  }

  const hasBunTs = config.profiles.some((entry) => entry.profile === 'bun-ts');
  if (config.ci === true && hasBunTs) {
    results.push(syncCiWorkflow(projectRoot));
    results.push(syncBunVersion(projectRoot));
  }

  return results;
}
