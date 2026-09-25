# Standards
<!-- standards:begin 1.4.0 bun-ts -->
## Working in this repo

- Managed `standards:begin`/`standards:end` in `AGENTS.md`/`DESIGN.md` is owned by `@dino/standards`; never edit by hand. Change the rule in `Hypermaker2/standards`, release a tag, then `bun remove @dino/standards && bun add -d github:Hypermaker2/standards#vX.Y.Z && bunx standards sync`. Edit only the project layer below.
- `AGENTS.md` is the only agent instruction file; never add `CLAUDE.md`, `.cursorrules`, or similar (they shadow it and split the rules).
- Project layers and budgets: `AGENTS.md` (<100 lines) = product (2-3 sentences), domain invariants an agent could break, repo-specific commands beyond the contract, architecture map, dependency deviations, and `standards.json` exceptions (one-line reasons); never behavior descriptions, inventories/changelogs/plans/benchmarks, or anything already in code/tests/`package.json`. `DESIGN.md` (<40 lines) = design rules omitted from the shared set (color roles, density, component constraints); never tokens, screens, or component catalogs. Over budget: move into code, a test, an ADR, or the shared standard.
- Fix the code to pass `bunx standards check` (first in `lint`); never rename, alias, wrap, exempt, or spread the forbidden thing (a forwarding wrapper is the forbidden call). Legitimate new patterns change the check in the standards repo in the same work. Declare exceptions only in `standards.json` (`configModules`, `effectWrappers`, `envReadExempt`, `commentExempt`, `extraRoles`, `tscAllowed`, `fallbackExempt`) with a one-line project-layer reason; never launder.
- Before reporting done, run root `check` (lint, typecheck, tests, format:check, audit) and make it pass; if the brief allows a subset, name skips. Never commit or push unless asked.

## Code rules

- Repository invariants are executable checks inside `lint` (`scripts/check-*.ts` + colocated test), never review conventions. Legitimate exceptions change the check in the same change; never disable it.
- Optimize for readability and skimmability. Avoid cleverness; prefer early returns.
- No comments in code. Names and structure say what code does; a test says why a non-obvious behavior must hold. Facts that only a comment used to carry go into a name, a test, or the commit body (that order); history and external refs go there or in docs. `bun run lint` fails on any comment.
- No backward compatibility: one app, one codebase. Evolve types/interfaces and update all callers together; no shims or fallbacks.
- Fail fast on broken invariants: throw instead of returning null/empty placeholders from typed paths. Never swallow errors; recover deliberately or rethrow with context.
- Write the happy path. Guard only untrusted external data (network, user input, localStorage). No defensive `?.`/`??`/`if (!x) return` for own typed values.
- Parse all runtime config through a typed schema at boot in one config module per runtime; app code reads that object, never the environment. Config modules export parsed typed values only, never the environment object (no return/alias/spread of `process.env`/`import.meta.env`); reading keys to parse is fine; misconfiguration fails at startup.
- Keep it simple. Handle the important cases; no enterprise-style code. Prefer 80% of the value with less code. If materially ambiguous, ask a structured multiple-choice question; else assume a low-risk default, state it, and continue.
- Throw typed errors from one errors module. Never `res.status(4xx).json({ error })` in a route handler. Frontend: `toaster.error` for user-facing errors, `console.error` for debug. Let errors bubble to boundaries or middleware.

## TypeScript

- Strict mode; avoid `any`, never `as any` to silence an error, use `!` sparingly. Explicit return types on exported functions; union types for status enums; always async/await, never callbacks. Naming: `camelCase` vars/functions, `PascalCase` types/interfaces/components, `SCREAMING_SNAKE_CASE` constants. Files: `PascalCase.tsx` components, `useCamelCase.ts` hooks, `camelCase.ts` services/routes/utils; utilities/validation/business logic/API schemas always `.ts`. One clear purpose per file.

## Docs

- `docs/` holds only what code cannot show: setup, operations, external constraints. Behavior lives in code and tests; review and test reports are not docs. `docs/decisions/` holds numbered ADRs (Status/Context/Decision/Rationale/Consequences/Rejected alternative). `plans/` holds finite work; delete when done. Never put inventories, versions, routes, env values, or benchmarks in docs.

## Build, verification, and scope

- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`. Bodies carry the why (external refs, exception reasons). Dependency hygiene: remove unused deps and their build config immediately; audit bundle impact before adding.
- Complete the agreed outcome only. Record adjacent ideas separately; do not implement them unless scope expands. Verify, then wait for acceptance before more work.

## Bun / TypeScript stack

- Bun for everything (`bun install`, `bun run`). oxlint lint, oxfmt format, tsgo (`@typescript/native-preview`) typecheck, Vitest tests. knip for unused deps/exports/files; `bun audit` fails on high or critical. Both run in `lint`/`check`.
- One TypeScript: `tsgo` (`@typescript/native-preview`) only. No `tsc` in scripts or CI; no `typescript@5` or `@6` in the lockfile. Emit via `tsgo` or `bun build`. Root scripts: `dev`, `build`, `test`, `typecheck`, `lint`, `format`, `format:check`, `check`, `knip`, `audit`. Monorepo when applicable: `shared/`, `frontend/`, `backend/`; shared types in `shared/src`; never duplicate across the boundary. Frontend: React 19 functional components with typed props; Vite; Tailwind v4 with tokens in one `tokens.css` `@theme` file.
- Never call `useEffect` directly. Only two wrappers may: `useMountEffect(effect)` (no deps; one-time external sync on mount) and `useSyncedEffect(effect, deps)` (required `deps`; sync DOM, subscriptions, timers, or storage with state). Never use either for state derivation, data fetching, user-action reactions, or prop-change resets (`key` on the component). An optional-deps or arbitrary-forwarding wrapper is a rename and fails the rule.
- Features import queries and services, never the HTTP client; parse responses once at the client boundary against shared schemas. `cn` from the `cn` package for class composition; `cva` only as a recorded deviation. Base UI via `@base-ui/react` (shadcn `base-nova`); own components under `shared/components/ui`. TanStack Query for server state; Express 5; SQLite; zod at untrusted boundaries. Icons from a local icons module; no icon packages in feature files.

## Approved dependencies

Approved: `bun`, `react`/`react-dom`, `vite`, `tailwindcss`, `@base-ui/react`, `@tanstack/react-query`, `express`, `zod`, `oxlint`/`oxfmt`, `@typescript/native-preview`, `vitest`, `knip`, `concurrently`. Anything else: project layer of `AGENTS.md` with a one-line reason.
<!-- standards:end -->
Shared agent rules, design vocabulary, and lint configs for Dino Bun and Python projects.

## Project

- This repository is the source of `@dino/standards`. Consumers install it as a git dependency and run the `standards` CLI.
- Rule markdown under `agents/` and `design/` is the source of truth for managed regions. Edit here, bump the version, tag, then sync consumers.
- The CLI lives in `src/`. Keep the command surface small: `sync` and `check` only.
