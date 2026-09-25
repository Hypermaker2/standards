import { checkProject, reportIssues } from './check.ts';
import { loadStandardsConfig, type Profile } from './paths.ts';
import { initStandardsConfig, syncProject } from './sync.ts';

function printHelp(): void {
  console.log(`standards <command>

Commands:
  sync [--init --profile bun-ts|python [--design <tokens.css>]]
  check
  --help

sync materializes managed AGENTS.md / DESIGN.md regions and lint configs.
check fails when managed regions, configs, scripts, comments, or tokens drift.
`);
}

function parseProfile(value: string | undefined): Profile {
  if (value !== 'bun-ts' && value !== 'python') {
    throw new Error('--profile must be bun-ts or python');
  }
  return value;
}

function main(argv: string[]): number {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }

  const command = args[0];
  const projectRoot = process.cwd();

  if (command === 'sync') {
    const init = args.includes('--init');
    if (init) {
      const profileIndex = args.indexOf('--profile');
      if (profileIndex === -1 || !args[profileIndex + 1]) {
        console.error('sync --init requires --profile bun-ts|python');
        return 1;
      }
      const profile = parseProfile(args[profileIndex + 1]);
      const designIndex = args.indexOf('--design');
      const design = designIndex === -1 ? undefined : args[designIndex + 1];
      if (designIndex !== -1 && !design) {
        console.error('sync --init --design requires a tokens.css path');
        return 1;
      }
      const initResult = initStandardsConfig(projectRoot, { profile, design });
      console.log(`${initResult.file}: ${initResult.status}`);
    }

    const config = loadStandardsConfig(projectRoot);
    const results = syncProject(projectRoot, config);
    for (const result of results) {
      console.log(`${result.file}: ${result.status}`);
    }
    return 0;
  }

  if (command === 'check') {
    const config = loadStandardsConfig(projectRoot);
    const issues = checkProject(projectRoot, config);
    if (issues.length === 0) {
      console.log('standards check passed.');
      return 0;
    }
    reportIssues(issues);
    return 1;
  }

  console.error(`unknown command: ${command}`);
  printHelp();
  return 1;
}

const exitCode = main(process.argv);
if (import.meta.main) {
  process.exit(exitCode);
}

export { main };
