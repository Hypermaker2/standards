import fs from 'node:fs';
import path from 'node:path';
import { checkCiWorkflow } from './checkCi.ts';
import { checkConfigs } from './checkConfigs.ts';
import { checkControlSize } from './checkControlSize.ts';
import { checkEnvReads } from './checkEnvReads.ts';
import { checkHttpClientImports } from './checkHttpClientImports.ts';
import { checkIconImports } from './checkIconImports.ts';
import { checkLocalChecks } from './checkLocalChecks.ts';
import { checkNoComments } from './checkNoComments.ts';
import { checkNoFallbacks } from './checkNoFallbacks.ts';
import { checkNoSkeletons } from './checkNoSkeletons.ts';
import { checkProjectLayer } from './checkProjectLayer.ts';
import { checkRadius } from './checkRadius.ts';
import { checkRawColors } from './checkRawColors.ts';
import { checkScripts } from './checkScripts.ts';
import { checkShadows } from './checkShadows.ts';
import { checkSingleAgentsFile } from './checkSingleAgentsFile.ts';
import { checkSingleTypeScript } from './checkSingleTypeScript.ts';
import { checkTokens } from './checkTokens.ts';
import { checkUseEffect } from './checkUseEffect.ts';
import { expectedAgentsBody, expectedMultiAgentsBody, findManagedRegion } from './managedRegion.ts';
import {
  formatIssue,
  packageVersion,
  profileAbsoluteRoot,
  profileMarker,
  readPackageText,
  rebaseIssues,
  resolveTokensCss,
  type CheckIssue,
  type ProfileEntry,
  type StandardsConfig,
} from './paths.ts';

function checkManagedDoc(
  projectRoot: string,
  relativePath: string,
  expectedBody: string,
  expectedProfile: string,
  expectedVersion: string
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const absolute = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolute)) {
    issues.push({
      file: relativePath,
      line: 1,
      message: 'file missing; run standards sync',
    });
    return issues;
  }
  const text = fs.readFileSync(absolute, 'utf8');
  let region;
  try {
    region = findManagedRegion(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issues.push({ file: relativePath, line: 1, message });
    return issues;
  }
  if (!region) {
    issues.push({
      file: relativePath,
      line: 1,
      message: 'missing standards managed region; run standards sync',
    });
    return issues;
  }
  if (region.version !== expectedVersion) {
    issues.push({
      file: relativePath,
      line: 1,
      message: `managed region version ${region.version} != package ${expectedVersion}; run standards sync`,
    });
  }
  if (region.profile !== expectedProfile) {
    issues.push({
      file: relativePath,
      line: 1,
      message: `managed region profile ${region.profile} != ${expectedProfile}; run standards sync`,
    });
  }
  if (region.body !== expectedBody) {
    issues.push({
      file: relativePath,
      line: 1,
      message: 'managed region content drifts from @dino/standards; run standards sync',
    });
  }
  return issues;
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

function checkNestedConsumerConflicts(projectRoot: string, profiles: ProfileEntry[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const entry of profiles) {
    if (entry.root === '.') continue;
    const nestedPath = path.join(entry.root, 'standards.json');
    if (!fs.existsSync(path.join(projectRoot, nestedPath))) continue;
    issues.push({
      file: nestedPath,
      line: 1,
      message: `nested standards.json conflicts with root profiles entry for "${entry.root}"; remove the nested consumer`,
    });
  }
  return issues;
}

function entryField<T>(
  entry: ProfileEntry,
  top: T[] | undefined,
  key: keyof ProfileEntry
): T[] | undefined {
  const fromEntry = entry[key] as T[] | undefined;
  if (fromEntry !== undefined) return fromEntry;
  if (entry.root === '.') return top;
  return undefined;
}

function checkBunTsProfile(
  projectRoot: string,
  entry: ProfileEntry,
  config: StandardsConfig
): CheckIssue[] {
  const absoluteRoot = profileAbsoluteRoot(projectRoot, entry);
  const issues: CheckIssue[] = [];
  issues.push(...rebaseIssues(checkConfigs(absoluteRoot, 'bun-ts'), entry.root));
  issues.push(...rebaseIssues(checkScripts(absoluteRoot, 'bun-ts'), entry.root));
  issues.push(
    ...rebaseIssues(
      checkNoFallbacks({
        projectRoot: absoluteRoot,
        fallbackExempt: entryField(entry, config.fallbackExempt, 'fallbackExempt'),
      }),
      entry.root
    )
  );
  issues.push(
    ...rebaseIssues(
      checkEnvReads({
        projectRoot: absoluteRoot,
        configModules: entryField(entry, config.configModules, 'configModules'),
        envReadExempt: entryField(entry, config.envReadExempt, 'envReadExempt'),
      }),
      entry.root
    )
  );
  issues.push(
    ...rebaseIssues(
      checkUseEffect({
        projectRoot: absoluteRoot,
        effectWrappers: entryField(entry, config.effectWrappers, 'effectWrappers'),
      }),
      entry.root
    )
  );
  issues.push(
    ...rebaseIssues(
      checkSingleTypeScript({
        projectRoot: absoluteRoot,
        tscAllowed: entryField(entry, config.tscAllowed, 'tscAllowed'),
      }),
      entry.root
    )
  );
  if (config.design) {
    issues.push(...rebaseIssues(checkRadius({ projectRoot: absoluteRoot }), entry.root));
    issues.push(...rebaseIssues(checkNoSkeletons({ projectRoot: absoluteRoot }), entry.root));
    const uiRoot =
      entry.uiRoot ?? (entry.root === '.' ? config.uiRoot : undefined) ?? config.uiRoot;
    issues.push(
      ...rebaseIssues(checkControlSize({ projectRoot: absoluteRoot, uiRoot }), entry.root)
    );
    const httpClientModule =
      entry.httpClientModule ??
      (entry.root === '.' ? config.httpClientModule : undefined) ??
      config.httpClientModule;
    const tokensCss =
      entry.tokensCss ?? (entry.root === '.' ? config.tokensCss : undefined) ?? config.tokensCss;
    issues.push(
      ...rebaseIssues(
        checkHttpClientImports({ projectRoot: absoluteRoot, httpClientModule }),
        entry.root
      )
    );
    issues.push(
      ...rebaseIssues(checkRawColors({ projectRoot: absoluteRoot, tokensCss }), entry.root)
    );
    issues.push(...rebaseIssues(checkIconImports({ projectRoot: absoluteRoot }), entry.root));
    issues.push(...rebaseIssues(checkShadows({ projectRoot: absoluteRoot }), entry.root));
  }
  return issues;
}

function checkPythonProfile(projectRoot: string, entry: ProfileEntry): CheckIssue[] {
  const absoluteRoot = profileAbsoluteRoot(projectRoot, entry);
  return [
    ...rebaseIssues(checkConfigs(absoluteRoot, 'python'), entry.root),
    ...rebaseIssues(checkScripts(absoluteRoot, 'python'), entry.root),
  ];
}

function mergedCommentExempt(config: StandardsConfig): string[] {
  const exempt: string[] = [...(config.commentExempt ?? [])];
  for (const entry of config.profiles) {
    for (const prefix of entry.commentExempt ?? []) {
      exempt.push(entry.root === '.' ? prefix : path.join(entry.root, prefix));
    }
  }
  return exempt;
}

export function checkProject(projectRoot: string, config: StandardsConfig): CheckIssue[] {
  const version = packageVersion();
  const marker = profileMarker(config.profiles);
  const issues: CheckIssue[] = [];

  issues.push(...checkManagedDoc(projectRoot, 'AGENTS.md', agentsBodyFor(config), marker, version));

  if (config.design) {
    const designBody = readPackageText('design/base.md').replace(/\n$/, '');
    issues.push(...checkManagedDoc(projectRoot, 'DESIGN.md', designBody, marker, version));
  }

  issues.push(...checkNestedConsumerConflicts(projectRoot, config.profiles));
  issues.push(...checkSingleAgentsFile(projectRoot));
  issues.push(...checkLocalChecks({ projectRoot, localChecks: config.localChecks }));
  issues.push(
    ...checkProjectLayer({
      projectRoot,
      design: config.design,
      projectLayerMaxLines: config.projectLayerMaxLines,
    })
  );

  const hasPython = config.profiles.some((entry) => entry.profile === 'python');
  issues.push(
    ...checkNoComments({
      projectRoot,
      profile: hasPython ? 'python' : 'bun-ts',
      commentExempt: mergedCommentExempt(config),
    })
  );

  for (const entry of config.profiles) {
    if (entry.profile === 'bun-ts') {
      issues.push(...checkBunTsProfile(projectRoot, entry, config));
    } else {
      issues.push(...checkPythonProfile(projectRoot, entry));
    }
  }

  if (config.ci === true && config.profiles.some((entry) => entry.profile === 'bun-ts')) {
    issues.push(...checkCiWorkflow(projectRoot));
  }

  if (config.design) {
    const tokens = resolveTokensCss(projectRoot, config);
    const designEntry = config.profiles.find((entry) => entry.design === true);
    const extraRoles =
      designEntry?.extraRoles ??
      (designEntry?.root === '.' ? config.extraRoles : undefined) ??
      config.extraRoles ??
      [];
    const tokenIssues = checkTokens(projectRoot, tokens.relativePath, extraRoles);
    issues.push(...tokenIssues);
  }

  return issues;
}

export function reportIssues(issues: CheckIssue[]): void {
  for (const issue of issues) {
    console.error(formatIssue(issue));
  }
  if (issues.length > 0) {
    console.error(`\n${issues.length} standards check failure(s).`);
  }
}
