# Standards

Versioned Bun package of shared agent rules, design vocabulary, and lint configs. Projects install it as a git dependency, run `standards sync` to materialize managed regions, and `standards check` in CI or local lint so drift fails fast.

Values (token numbers, product rules) stay in each project. This package owns vocabulary and rules only.

## Install

```bash
bun add -d github:Hypermaker2/standards#v1.0.0
```

## Usage

```bash
bunx standards sync --init --profile bun-ts
bunx standards sync --init --profile bun-ts --design frontend/src/styles/tokens.css
bunx standards sync
bunx standards check
```

`standards.json` at the project root selects `bun-ts` or `python`, whether design docs and token checks run, and optional `commentExempt` / `extraRoles`.

## What check enforces

- Managed `AGENTS.md` (and `DESIGN.md` when enabled) match this package version and content.
- Lint config files match the package copies.
- No comments in scanned source.
- Root scripts (bun-ts) or pyproject + ruff/pytest (python).
- Token role vocabulary when design is enabled.

## Bump a version

1. Edit `package.json` version and any rule markdown under `agents/` or `design/`.
2. Run `bun run check` here.
3. Commit, tag `vX.Y.Z`, push the tag.
4. In each consumer, bump the git dep to the new tag and run `bunx standards sync`.
