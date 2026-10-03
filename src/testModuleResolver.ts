import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { Node } from 'oxc-parser';
import { listProjectFiles } from './projectFiles.ts';
import { parseCode } from './testFiles.ts';

const MODULE_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '/index.ts',
  '/index.tsx',
  '/index.js',
];
type Alias = { pattern: string; targets: string[] };
type LocalPackage = { root: string; main?: string; exports?: unknown };
type TsConfig = { baseUrl: string | undefined; aliases: Alias[] };

function jsonValue(node: Node): unknown {
  if (node.type === 'ParenthesizedExpression') return jsonValue(node.expression);
  if (node.type === 'Literal') return node.value;
  if (node.type === 'ArrayExpression')
    return node.elements.map((element) => (element === null ? null : jsonValue(element)));
  if (node.type === 'ObjectExpression') {
    const entries = node.properties.map((property) => {
      if (property.type !== 'Property' || property.key.type !== 'Literal')
        throw new Error('Invalid tsconfig property');
      return [String(property.key.value), jsonValue(property.value)] as const;
    });
    return Object.fromEntries(entries);
  }
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal')
    return -Number(node.argument.value);
  throw new Error(`Invalid tsconfig value: ${node.type}`);
}

function readTsConfig(file: string, seen: Set<string>): TsConfig {
  if (seen.has(file)) throw new Error(`Circular tsconfig extends: ${file}`);
  seen.add(file);
  const text = fs.readFileSync(file, 'utf8');
  const program = parseCode(`${file}.ts`, `const config = (${text});`);
  const statement = program.body[0];
  if (statement.type !== 'VariableDeclaration' || statement.declarations[0].init === null)
    throw new Error(`Invalid tsconfig: ${file}`);
  const raw = jsonValue(statement.declarations[0].init) as {
    extends?: string | string[];
    compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  };
  let inherited: TsConfig = { baseUrl: undefined, aliases: [] };
  const parents = typeof raw.extends === 'string' ? [raw.extends] : (raw.extends ?? []);
  for (const parent of parents) {
    const target = parent.startsWith('.')
      ? path.resolve(path.dirname(file), parent)
      : createRequire(file).resolve(parent);
    const config = readTsConfig(
      target.endsWith('.json') ? target : `${target}.json`,
      new Set(seen)
    );
    inherited = { baseUrl: config.baseUrl, aliases: [...inherited.aliases, ...config.aliases] };
  }
  const baseUrl =
    raw.compilerOptions?.baseUrl === undefined
      ? inherited.baseUrl
      : path.resolve(path.dirname(file), raw.compilerOptions.baseUrl);
  const aliases =
    raw.compilerOptions?.paths === undefined
      ? inherited.aliases
      : Object.entries(raw.compilerOptions.paths).map(([pattern, targets]) => ({
          pattern,
          targets: targets.map((target) => path.resolve(baseUrl ?? path.dirname(file), target)),
        }));
  return { baseUrl, aliases };
}

function exportTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const conditions = value as Record<string, unknown>;
  for (const key of ['bun', 'import', 'node', 'default', 'types']) {
    const target = exportTarget(conditions[key]);
    if (target !== undefined) return target;
  }
  return undefined;
}

function inside(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export class TestModuleResolver {
  private readonly packages = new Map<string, LocalPackage>();
  private readonly configs = new Map<string, TsConfig>();

  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = fs.realpathSync(repoRoot);
    const files = listProjectFiles({ projectRoot: this.repoRoot, extensions: new Set(['.json']) });
    for (const file of files) {
      if (path.basename(file) !== 'package.json') continue;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        name?: string;
        main?: string;
        exports?: unknown;
      };
      if (typeof raw.name === 'string')
        this.packages.set(raw.name, {
          root: path.dirname(file),
          main: raw.main,
          exports: raw.exports,
        });
    }
  }

  private moduleFile(target: string): string | undefined {
    for (const extension of MODULE_EXTENSIONS) {
      const candidate = target.replace(/\.(?:js|mjs|cjs)$/, '') + extension;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile())
        return fs.realpathSync(candidate);
    }
    return undefined;
  }

  private configFor(file: string): TsConfig {
    let directory = path.dirname(file);
    while (inside(this.repoRoot, directory)) {
      const config = path.join(directory, 'tsconfig.json');
      if (fs.existsSync(config)) {
        if (!this.configs.has(config)) this.configs.set(config, readTsConfig(config, new Set()));
        return this.configs.get(config)!;
      }
      directory = path.dirname(directory);
    }
    return { baseUrl: undefined, aliases: [] };
  }

  private packageModule(specifier: string): string | undefined {
    for (const [name, entry] of this.packages) {
      if (specifier !== name && !specifier.startsWith(`${name}/`)) continue;
      const subpath = specifier === name ? '.' : `.${specifier.slice(name.length)}`;
      const exports = entry.exports;
      let target = subpath === '.' ? exportTarget(exports) : undefined;
      if (exports !== null && typeof exports === 'object' && !Array.isArray(exports)) {
        for (const [pattern, value] of Object.entries(exports)) {
          if (pattern === subpath) target = exportTarget(value);
          const star = pattern.indexOf('*');
          if (
            star === -1 ||
            !subpath.startsWith(pattern.slice(0, star)) ||
            !subpath.endsWith(pattern.slice(star + 1))
          )
            continue;
          const captured = subpath.slice(star, subpath.length - pattern.length + star + 1);
          target = exportTarget(value)?.replace('*', captured);
        }
      }
      if (target === undefined && subpath === '.') target = entry.main;
      const file =
        target === undefined
          ? path.join(entry.root, subpath === '.' ? '' : subpath.slice(2))
          : path.resolve(entry.root, target);
      return this.moduleFile(file) ?? file;
    }
    return undefined;
  }

  resolve(file: string, specifier: string): string | undefined {
    file = path.join(fs.realpathSync(path.dirname(file)), path.basename(file));
    if (specifier.startsWith('node:')) return undefined;
    if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
      const target = path.resolve(path.dirname(file), specifier);
      if (!inside(this.repoRoot, target)) return undefined;
      return this.moduleFile(target) ?? target;
    }
    const config = this.configFor(file);
    for (const { pattern, targets } of config.aliases) {
      const star = pattern.indexOf('*');
      const prefix = star === -1 ? pattern : pattern.slice(0, star);
      const suffix = star === -1 ? '' : pattern.slice(star + 1);
      if (
        star === -1
          ? specifier !== pattern
          : !specifier.startsWith(prefix) || !specifier.endsWith(suffix)
      )
        continue;
      const captured =
        star === -1 ? '' : specifier.slice(prefix.length, specifier.length - suffix.length);
      for (const target of targets) {
        const resolved = this.moduleFile(target.replace('*', captured));
        if (resolved && inside(this.repoRoot, resolved)) return resolved;
      }
      const target = targets[0].replace('*', captured);
      if (inside(this.repoRoot, target)) return target;
    }
    const workspace = this.packageModule(specifier);
    if (workspace !== undefined) return workspace;
    const local =
      config.baseUrl === undefined
        ? undefined
        : this.moduleFile(path.join(config.baseUrl, specifier));
    if (local && inside(this.repoRoot, local)) return local;
    return undefined;
  }

  boundaryModule(module: string): string {
    const workspace = this.packageModule(module);
    if (workspace !== undefined) return workspace;
    const target = path.resolve(this.repoRoot, module);
    if (!inside(this.repoRoot, target))
      throw new Error(`testBoundaries module must be inside the repo: ${module}`);
    const resolved = this.moduleFile(target);
    if (resolved === undefined)
      throw new Error(`testBoundaries module does not resolve: ${module}`);
    return resolved;
  }
}
