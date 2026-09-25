import fs from 'node:fs';
import path from 'node:path';
import { checkConfigs } from './checkConfigs.ts';
import { checkNoComments } from './checkNoComments.ts';
import { checkScripts } from './checkScripts.ts';
import { checkTokens } from './checkTokens.ts';
import { expectedAgentsBody, findManagedRegion } from './managedRegion.ts';
import {
  formatIssue,
  packageVersion,
  readPackageText,
  type CheckIssue,
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

export function checkProject(projectRoot: string, config: StandardsConfig): CheckIssue[] {
  const version = packageVersion();
  const issues: CheckIssue[] = [];

  const agentsBody = expectedAgentsBody(
    readPackageText('agents/base.md'),
    readPackageText(`agents/profile-${config.profile}.md`)
  );
  issues.push(...checkManagedDoc(projectRoot, 'AGENTS.md', agentsBody, config.profile, version));

  if (config.design) {
    const designBody = readPackageText('design/base.md').replace(/\n$/, '');
    issues.push(...checkManagedDoc(projectRoot, 'DESIGN.md', designBody, config.profile, version));
  }

  issues.push(...checkConfigs(projectRoot, config.profile));
  issues.push(
    ...checkNoComments({
      projectRoot,
      profile: config.profile,
      commentExempt: config.commentExempt,
    })
  );
  issues.push(...checkScripts(projectRoot, config.profile));

  if (config.design) {
    issues.push(...checkTokens(projectRoot, config.tokensCss as string, config.extraRoles ?? []));
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
