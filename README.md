# Standards

Versioned Bun package of shared agent rules, design vocabulary, and lint configs. Projects install it as a git dependency, run `standards sync` to materialize managed regions, and `standards check` in CI or local lint so drift fails fast.

Values (token numbers, product rules) stay in each project. This package owns vocabulary and rules only.

## Install

The GitHub repo is public (Bun resolves `github:` deps via the tarball API).

```bash
bun add -d github:Hypermaker2/standards#v1.0.1
```

## Consumers

| Repo       | Profile                             |
| ---------- | ----------------------------------- |
| duet       | bun-ts                              |
| relay      | bun-ts                              |
| Framework  | bun-ts                              |
| life       | bun-ts                              |
| hyperflow  | bun-ts (frontend), python (backend) |
| laddermind | python                              |

## Usage

```bash
bunx standards sync --init --profile bun-ts
bunx standards sync --init --profile bun-ts --design frontend/src/styles/tokens.css
bunx standards sync
bunx standards check
```

`standards.json` at the project root selects `bun-ts` or `python`, whether design docs and token checks run, and optional `commentExempt` / `extraRoles`. The CLI always operates on the current working directory, not the git root.

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
- Root scripts (bun-ts) or pyproject + ruff/pytest (python).
- Token role vocabulary when design is enabled.

## Bump a version

1. Edit `package.json` version and any rule markdown under `agents/` or `design/`.
2. Run `bun run check` here.
3. Commit, tag `vX.Y.Z`, push the tag.
4. In each consumer, bump the git dep to the new tag and run `bunx standards sync`.
