# Standards
<!-- standards:begin 1.8.0 bun-ts -->
## Working in this repo

- Never hand-edit `standards:begin`/`standards:end` in `AGENTS.md`/`DESIGN.md`. Edit `Hypermaker2/standards`, release a tag, then `bun remove @dino/standards && bun add -d github:Hypermaker2/standards#vX.Y.Z && bunx standards sync`. Edit project layers only.
- `AGENTS.md` is the only agent instruction file; never add `CLAUDE.md`, `.cursorrules`, or similar (they shadow it and split the rules).
- Project layers: `AGENTS.md` (<100 lines) holds product (2-3 sentences), domain invariants, repo-specific commands, architecture, dependency deviations and `standards.json` exceptions with reasons. Never duplicate code/tests/`package.json` or add behavior descriptions, inventories, changelogs, plans or benchmarks. `DESIGN.md` (<40 lines) holds extra color-role, density and component rules; never tokens, screens or catalogs. Move overflow into code, tests, ADRs or standards.
- Put cross-project rules in standards. Declare project-only checks in `localChecks` with a reason.
- Fix the code to pass `bunx standards check` (first in `lint`); never rename, alias, wrap, exempt, or spread the forbidden thing (a forwarding wrapper is the forbidden call). Legitimate new patterns change the check in the standards repo in the same work. Declare exceptions only in `standards.json` (`configModules`, `effectWrappers`, `envReadExempt`, `commentExempt`, `extraRoles`, `tscAllowed`, `fallbackExempt`, `httpClientModule`, `localChecks`, `testBoundaries`) with a reason; never launder.
- Before reporting done, run `check` (lint, typecheck, tests, format:check, audit) and make it pass; if the brief allows a subset, name skips. Never commit or push unless asked.

## Code rules

- Repository invariants are executable checks inside `lint` (`scripts/check-*.ts` + colocated test), never review conventions. Legitimate exceptions change the check in the same change; never disable it.
- Optimize for readability and skimmability. Avoid cleverness; prefer early returns.
- No code comments; `lint` rejects them. Names and structure explain behavior; tests explain non-obvious requirements. Move comment facts into names, tests or commit bodies; put history and external refs in commit bodies or docs.
- No backward compatibility: one app, one codebase. Evolve types/interfaces and update all callers together; no shims or fallbacks.
- Fail fast on broken invariants: throw instead of returning null/empty placeholders from typed paths. Never swallow errors; recover or rethrow with context.
- Write the happy path. Guard only untrusted external data (network, user input, localStorage). No defensive `?.`/`??`/`if (!x) return` for own typed values.
- Parse all runtime config through a typed schema at boot in one config module per runtime; app code reads that object, never the environment. Config modules export parsed typed values only, never the environment object (no return/alias/spread of `process.env`/`import.meta.env`); misconfiguration fails at startup.
- Keep it simple. Handle the important cases; no enterprise-style code. Prefer 80% of the value with less code. If ambiguous, ask a structured multiple-choice question; else assume a low-risk default, state it, and continue.
- Throw typed errors from one errors module. Never `res.status(4xx).json({ error })` in a route handler. Frontend: `toaster.error` for user-facing errors, `console.error` for debug. Let errors bubble to boundaries.

## TypeScript

- Strict mode; avoid `any`, never `as any` to silence an error, use `!` sparingly. Explicit return types on exported functions; union types for status enums; always async/await, never callbacks. Naming: `camelCase` vars/functions, `PascalCase` types/interfaces/components, `SCREAMING_SNAKE_CASE` constants. Files: `PascalCase.tsx` components, `useCamelCase.ts` hooks, `camelCase.ts` services/routes/utils; utilities/validation/business logic/API schemas always `.ts`. One clear purpose per file.

## Docs

- Write prose (docs, plans, ADRs, README, AGENTS.md/DESIGN.md project layers, commit bodies, PR descriptions) in ASD-STE100 Simplified Technical English: sentences of at most 20 words, one instruction each, active voice, simple tenses, one term for one meaning. Keep code and technical names unchanged.

- `docs/` holds only what code cannot show: setup, operations, external constraints. Behavior lives in code and tests; review and test reports are not docs. `docs/decisions/` holds numbered ADRs. `plans/` holds finite work; delete when done. Never put inventories, versions, routes, env values, or benchmarks in docs.

## Build, verification, and scope

- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`. Bodies carry the why. Dependency hygiene: remove unused deps and their build config immediately; audit bundle impact before adding.
- Complete the agreed outcome only. Record adjacent ideas separately; do not implement them unless scope expands. Verify, then wait for acceptance before more work.

## Bun / TypeScript stack

- Use Bun, oxlint, oxfmt, tsgo (`@typescript/native-preview`), Vitest and knip. Unused deps/exports/files and high/critical `bun audit` findings fail `lint`/`check`.
- Only tsgo for TypeScript; no `tsc` scripts/CI or `typescript@5`/`@6` in the lockfile. Emit via tsgo or `bun build`. Root scripts: `dev`, `build`, `test`, `typecheck`, `lint`, `format`, `format:check`, `check`, `knip`, `audit`. Stack: React 19 typed functional components, Vite, Tailwind v4 with one `tokens.css` `@theme`; monorepos use `shared/`, `frontend/`, `backend/`, with boundary types in `shared/src`.
- Never call `useEffect` directly. Only `useMountEffect(effect)` (no deps; mount sync) and `useSyncedEffect(effect, deps)` (required deps; DOM, subscriptions, timers, storage) may. Never use them for derivation, fetching, user actions or prop resets (use `key`). Optional deps or forwarding wrappers fail.
- Features import queries/services, never HTTP clients; parse responses once at the client boundary with shared schemas. Use `cn` from `cn`; record `cva` deviations. Base UI: `@base-ui/react` (shadcn `base-nova`), own UI in `shared/components/ui`. TanStack Query, Express 5, SQLite, zod at untrusted boundaries. Icons via a local module, never packages in features.

## Tests

- Name the user-visible bug each test catches.
- Run real code; only process, network, clock and browser-platform adapters may be faked via `testBoundaries`. Never fake the database.
- No other kept test catches the same bug.
- Types, lint or a standards check must not already guarantee it.
- Survive behavior-preserving refactors.
- Bug fixes get one regression test that fails before the fix and counts in the budget; add more only for distinct paths.
- Never raise `testBudget` or a test baseline without the user's explicit approval.
<!-- standards:end -->
Shared agent rules, design vocabulary, and lint configs for Dino Bun and Python projects.

## Project

- This repository is the source of `@dino/standards`. Consumers install it as a git dependency and run the `standards` CLI.
- Rule markdown under `agents/` and `design/` is the source of truth for managed regions. Edit here, bump the version, tag, then sync consumers.
- The CLI lives in `src/`. Keep the command surface small: `sync` and `check` only.
