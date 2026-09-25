# Standards

Versioned Bun package of shared agent rules, design vocabulary, and lint configs. Projects install it as a git dependency, run `standards sync` to materialize managed regions, and `standards check` in CI or local lint so drift fails fast.

Values (token numbers, product rules) stay in each project. This package owns vocabulary and rules only.

## Install

The GitHub repo is public (Bun resolves `github:` deps via the tarball API).

```bash
bun add -d github:Hypermaker2/standards#v1.5.0
```

## Consumers

| Repo      | Profile                          |
| --------- | -------------------------------- |
| duet      | bun-ts                           |
| relay     | bun-ts                           |
| Framework | bun-ts                           |
| life      | bun-ts                           |
| hyperflow | python root + bun-ts `frontend/` |
| standards | bun-ts                           |

## Usage

```bash
bunx standards sync --init --profile bun-ts
bunx standards sync --init --profile bun-ts --design frontend/src/styles/tokens.css
bunx standards sync
bunx standards check
```

`standards.json` at the repository root selects one or more profiles. The CLI always operates on the current working directory (the repo root for mixed repos).

## standards.json keys

| Key                    | Default                       | Purpose                                                                                                          |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `profile`              | (or use `profiles`)           | single-profile shorthand: `bun-ts` or `python` (means `[{ profile, root: "." }]`)                                |
| `profiles`             | unset                         | array of `{ profile, root, ... }`; use for mixed repos with one root `AGENTS.md`                                 |
| `design`               | required for single-profile   | whether root `DESIGN.md` and token checks run; may also be set on a profile entry                                |
| `tokensCss`            | unset                         | path to tokens.css when design is true (repo-relative at top level, or profile-root-relative on a profile entry) |
| `commentExempt`        | `[]`                          | path prefixes skipped by the comment scanner (profile-relative when set on a profile entry)                      |
| `extraRoles`           | `[]`                          | additional token roles allowed beyond the package list                                                           |
| `fallbackExempt`       | `[]`                          | path prefixes skipped by the no-fallbacks check                                                                  |
| `configModules`        | unset                         | files allowed to read env keys; must export parsed values only                                                   |
| `envReadExempt`        | `[]`                          | path prefixes skipped by the env-read check                                                                      |
| `effectWrappers`       | unset (ban everywhere)        | files allowed to call `useEffect`                                                                                |
| `tscAllowed`           | `[]`                          | workspace directories allowed to keep `tsc` in scripts                                                           |
| `ci`                   | `false`                       | when true and any bun-ts profile exists, sync writes root CI workflow + `.bun-version`                           |
| `projectLayerMaxLines` | `{ agents: 100, design: 40 }` | optional budgets for non-blank project-layer lines after `standards:end`                                         |

## Mixed repos

One repository, one `AGENTS.md`. Declare every stack in root `standards.json` with `profiles`:

```json
{
  "profiles": [
    { "profile": "python", "root": "." },
    {
      "profile": "bun-ts",
      "root": "frontend",
      "design": true,
      "tokensCss": "src/styles/tokens.css",
      "configModules": ["src/lib/env.ts"],
      "effectWrappers": ["src/lib/effects.ts"],
      "commentExempt": ["src/generated", "scripts/fixtures"]
    }
  ],
  "ci": false
}
```

Sync writes:

- one managed block in root `AGENTS.md` with marker `standards:begin <version> python+bun-ts` (single-profile markers stay `bun-ts` / `python` with no `+`)
- base rules once, then each profile section (non-`.` roots get a heading suffix like `(frontend/)`)
- one root `DESIGN.md` when design is enabled
- lint configs into each profile root (`.oxlintrc.json` under `frontend/`, `ruff.base.toml` at `.`)
- bun-ts checks, scripts, knip/audit, env/effects/fallbacks/tokens all resolve under that profile's root; reported paths are repo-relative (`frontend/src/...`)
- comment scan and the Claude/Cursor shadow-file guard run at the repo root

Do not keep a nested `frontend/standards.json` alongside a `profiles` entry for `frontend`; check fails with a clear conflict message.

### Migrating hyperflow

1. Replace the two consumers with the `profiles` document above (adjust keys to match the current frontend `standards.json`).
2. Delete `frontend/standards.json`, `frontend/AGENTS.md`, and `frontend/DESIGN.md`.
3. Move the frontend `DESIGN.md` project layer into root `DESIGN.md`, and the frontend `AGENTS.md` project-layer lines into the root `AGENTS.md` project layer.
4. Keep a root `package.json` `check` script (hyperflow already delegates to `frontend` and `uv`).
5. `bun remove @dino/standards && bun add -d github:Hypermaker2/standards#v1.5.0 && bunx standards sync`

## Ruff

Python sync writes `ruff.base.toml` (package defaults) and, if missing, a `ruff.toml` with `extend = "ruff.base.toml"` into the python profile root. Put project-specific Ruff rules in `ruff.toml`. Remove `[tool.ruff]` from `pyproject.toml` once `ruff.toml` exists.

## What check enforces

- Managed `AGENTS.md` (and `DESIGN.md` when enabled) match this package version and content.
- Lint config files match the package copies under each profile root. Bun-ts projects may keep `$schema` and `ignorePatterns` extras.
- No comments in scanned source (repo-wide).
- Scripts contract per profile root (bun-ts scripts including knip/audit, or pyproject + ruff/pytest).
- Token role vocabulary when design is enabled (including radius roles derived from `--radius`).
- Bun-ts: no Tailwind numeric / arbitrary / bare `rounded*` classes, no legacy `--radius-(xs|sm|…)` vars, and no raw `border-radius` lengths other than `0` (use role utilities / `var(--radius-<role>)`).
- Bun-ts: no `|| []` / `|| ''` / `|| ""` / `|| undefined` in runtime source (`fallbackExempt` optional).
- Bun-ts: `process.env` / `import.meta.env` only in `configModules` (plus always-exempt tests, `scripts/`, and config files). Config modules must not return, alias, or spread the raw environment object.
- Bun-ts: `useEffect` only in `effectWrappers` (missing key bans it everywhere; tests exempt). Wrapper files must expose `useMountEffect(effect)` calling `useEffect(effect, [])` (or an aliased import with `[]`) and may expose `useSyncedEffect(effect, deps)` with required deps. Optional deps or a `useMountEffect` that accepts deps is a rename and fails.
- Bun-ts: lockfile has no `typescript@5` / `@6`; no `tsc` in package scripts or GitHub workflows (`tscAllowed` optional).
- Bun-ts with `ci: true`: `.github/workflows/standards.yml` matches the package template and `.bun-version` exists.
- Project layer of `AGENTS.md` / `DESIGN.md` (non-blank lines after `standards:end`) stays within `projectLayerMaxLines` (defaults 100 / 40); the configured budget is printed on failure.
- No `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`, `.cursorrules`, or `.cursor/rules/` at the consumer root (`AGENTS.md` is the single instruction file for every runtime).
- No nested `standards.json` under a directory already listed in root `profiles`.

## Recommended scripts

```json
{
  "knip": "knip",
  "audit": "bun audit --audit-level=high",
  "lint": "oxlint . && bunx standards check && knip",
  "check": "bun run lint && bun run typecheck && bun run test && bun run format:check && bun run audit"
}
```

## CI

Set `"ci": true` in `standards.json`, then `bunx standards sync`. That writes:

- `.github/workflows/standards.yml` (push to main and pull_request, concurrency cancel-in-progress, `oven-sh/setup-bun@v2` with `bun-version-file: .bun-version`, Bun install cache on `bun.lock`, `bun install --frozen-lockfile`, `bun run check`)
- `.bun-version` with the running Bun version (`Bun.version`) when the file is missing; an existing `.bun-version` is left unchanged

`standards check` verifies the workflow matches the package template byte for byte and that `.bun-version` exists. Mixed repos need a root `package.json` with `check`.

## Bump a version

1. Edit `package.json` version and any rule markdown under `agents/` or `design/`.
2. Run `bun run check` here.
3. Commit, tag `vX.Y.Z`, push the tag.
4. In each consumer, bump the git dep to the new tag and run `bunx standards sync`.

Bun can fail with `DependencyLoop` when bumping a `github:` dependency in place; the reliable sequence is:

```bash
bun remove @dino/standards && bun add -d github:Hypermaker2/standards#vX.Y.Z && bunx standards sync
```
