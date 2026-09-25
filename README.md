# Standards

Versioned Bun package of shared agent rules, design vocabulary, and lint configs. Projects install it as a git dependency, run `standards sync` to materialize managed regions, and `standards check` in CI or local lint so drift fails fast.

Values (token numbers, product rules) stay in each project. This package owns vocabulary and rules only.

## Install

The GitHub repo is public (Bun resolves `github:` deps via the tarball API).

```bash
bun add -d github:Hypermaker2/standards#v1.1.2
```

## Consumers

| Repo      | Profile                             |
| --------- | ----------------------------------- |
| duet      | bun-ts                              |
| relay     | bun-ts                              |
| Framework | bun-ts                              |
| life      | bun-ts                              |
| hyperflow | bun-ts (frontend), python (backend) |
| standards | bun-ts                              |

## Usage

```bash
bunx standards sync --init --profile bun-ts
bunx standards sync --init --profile bun-ts --design frontend/src/styles/tokens.css
bunx standards sync
bunx standards check
```

`standards.json` at the project root selects `bun-ts` or `python`, whether design docs and token checks run, and optional keys below. The CLI always operates on the current working directory, not the git root.

## standards.json keys

| Key              | Default                | Purpose                                                                                                                    |
| ---------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `profile`        | required               | `bun-ts` or `python`                                                                                                       |
| `design`         | required               | whether DESIGN.md and token checks run                                                                                     |
| `tokensCss`      | unset                  | path to tokens.css when `design` is true                                                                                   |
| `commentExempt`  | `[]`                   | path prefixes skipped by the comment scanner                                                                               |
| `extraRoles`     | `[]`                   | additional token roles allowed beyond the package list                                                                     |
| `fallbackExempt` | `[]`                   | path prefixes skipped by the no-fallbacks check                                                                            |
| `configModules`  | unset                  | repo-relative files allowed to read env keys; must export parsed values only, never the raw environment object             |
| `envReadExempt`  | `[]`                   | path prefixes skipped by the env-read check                                                                                |
| `effectWrappers` | unset (ban everywhere) | repo-relative files allowed to call `useEffect`; each must be a real mount/synced wrapper, not a rename with optional deps |
| `tscAllowed`     | `[]`                   | workspace directories allowed to keep `tsc` in scripts                                                                     |
| `ci`             | `false`                | when true, sync writes `.github/workflows/standards.yml` and check verifies it                                             |

## Mixed repos

A repo can nest consumers. Example: Python root plus a Bun frontend:

```bash
# repo root
bunx standards sync --init --profile python
# frontend/
cd frontend && bunx standards sync --init --profile bun-ts --design src/styles/tokens.css
```

Each directory with a `standards.json` owns its own `AGENTS.md`, optional `DESIGN.md`, and lint configs. Run `sync` / `check` from that directory. The python profile comment scan skips child directories that contain their own `standards.json`.

## Ruff

Python sync writes `ruff.base.toml` (package defaults) and, if missing, a `ruff.toml` with `extend = "ruff.base.toml"`. Put project-specific Ruff rules in `ruff.toml`. Remove `[tool.ruff]` from `pyproject.toml` once `ruff.toml` exists.

## What check enforces

- Managed `AGENTS.md` (and `DESIGN.md` when enabled) match this package version and content.
- Lint config files match the package copies. Bun-ts projects may keep `$schema` and `ignorePatterns` extras.
- No comments in scanned source.
- Root scripts (bun-ts) or pyproject + ruff/pytest (python). Bun-ts also requires `knip` and `audit` scripts; `lint` must run knip; `check` or `lint` must run audit.
- Token role vocabulary when design is enabled.
- Bun-ts: no `|| []` / `|| ''` / `|| ""` / `|| undefined` in runtime source (`fallbackExempt` optional).
- Bun-ts: `process.env` / `import.meta.env` only in `configModules` (plus always-exempt tests, `scripts/`, and config files). Config modules must not return, alias, or spread the raw environment object.
- Bun-ts: `useEffect` only in `effectWrappers` (missing key bans it everywhere; tests exempt). Wrapper files must expose `useMountEffect(effect)` calling `useEffect(effect, [])` (or an aliased import with `[]`) and may expose `useSyncedEffect(effect, deps)` with required deps. Optional deps or a `useMountEffect` that accepts deps is a rename and fails.
- Bun-ts: lockfile has no `typescript@5` / `@6`; no `tsc` in package scripts or GitHub workflows (`tscAllowed` optional).
- Bun-ts with `ci: true`: `.github/workflows/standards.yml` matches the package template.

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

Set `"ci": true` in `standards.json`, then `bunx standards sync`. That writes `.github/workflows/standards.yml` (push to main and pull_request, concurrency cancel-in-progress, `oven-sh/setup-bun@v2`, Bun install cache on `bun.lock`, `bun install --frozen-lockfile`, `bun run check`). `standards check` verifies the file matches the package template byte for byte.

## Bump a version

1. Edit `package.json` version and any rule markdown under `agents/` or `design/`.
2. Run `bun run check` here.
3. Commit, tag `vX.Y.Z`, push the tag.
4. In each consumer, bump the git dep to the new tag and run `bunx standards sync`.

Bun can fail with `DependencyLoop` when bumping a `github:` dependency in place; the reliable sequence is:

```bash
bun remove @dino/standards && bun add -d github:Hypermaker2/standards#vX.Y.Z && bunx standards sync
```
