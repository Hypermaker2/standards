# Standards
<!-- standards:begin 1.2.1 bun-ts -->
## Working in this repo

- The block between `standards:begin` and `standards:end` in `AGENTS.md` and `DESIGN.md` is written by `@dino/standards` and is never edited by hand. Change the rule in the standards repository (`Hypermaker2/standards`), release a tag, then bump every consumer: `bun remove @dino/standards && bun add -d github:Hypermaker2/standards#vX.Y.Z && bunx standards sync`. The project layer below the block is the only part edited in this repository.
- `AGENTS.md` is the only agent instruction file; never add `CLAUDE.md`, `.cursorrules` or similar, they shadow it for one runtime and split the rules.
- The project layer of `AGENTS.md` holds only: what the product is (two or three sentences), domain invariants an agent could break, repo-specific commands beyond the standard contract, the architecture map, recorded dependency deviations and standards.json exceptions with one line of reason each. It never holds behavior descriptions, screen or feature inventories, changelogs, plans, benchmarks, or anything package.json, the code or a test already states. Under 100 lines.
- The project layer of `DESIGN.md` holds only product-specific design rules that the shared rules do not cover (domain color roles, density rules, product components' non-obvious constraints). It never holds token values, screen descriptions or component catalogs. Under 40 lines.
- When either layer needs to grow past its budget, something in it belongs in code, a test, an ADR, or the shared standard. Move it there instead.
- `bunx standards check` runs first in `lint`. When it fails, fix the code so it meets the rule. Never satisfy a check by renaming, aliasing, wrapping, exempting or spreading the thing it forbids; a wrapper that forwards to the forbidden call is the forbidden call. If a pattern is legitimately new, change the check in the standards repository in the same piece of work and record the exception in the project layer.
- Configuration keys in `standards.json` (`configModules`, `effectWrappers`, `envReadExempt`, `commentExempt`, `extraRoles`, `tscAllowed`, `fallbackExempt`) declare where a rule's one legitimate exception lives. Every entry needs one line in the project layer saying why. Application code is never exempted.
- Before reporting a task done, run the repository's `check` command (lint, typecheck, tests, format check, audit) from the root and make it pass; run only a subset when the task brief says so and name what was skipped. Never commit or push unless asked.
- Facts that only a comment used to carry go into a name, a test, or the commit message body, in that order of preference.

## Code rules

- Repository invariants are executable checks that run inside `lint` (a `scripts/check-*.ts` with a colocated test), never review conventions. When a legitimate new pattern needs an exception, change the check in the same change; do not disable it.
- Optimize for readability and skimmability. Avoid cleverness; prefer early returns.
- No comments in code. Names and structure say what code does; a test says why a non-obvious behavior must hold. Put history and external references in commit messages or docs. `bun run lint` fails on any comment.
- No backward compatibility: one app, one codebase. Evolve types and interfaces and update all callers together, no shims or fallbacks.
- Fail fast on broken invariants: throw instead of returning null or empty placeholders from typed paths. Never swallow errors: recover deliberately or rethrow with context.
- Write the happy path. Guard only untrusted external data (network responses, user input, localStorage). No defensive `?.`, `??`, or `if (!x) return` for values your own typed code produced.
- All runtime configuration is parsed through a typed schema at boot, in one config module per runtime. Application code reads the parsed config object, never the environment directly. Misconfiguration fails at startup.
- Keep it simple. Handle the important cases, no enterprise-style code. Ask whether 80% of the value can ship with less code.
- Ask a structured multiple-choice question when a request is materially ambiguous; otherwise assume a low-risk default, state it, and continue.

## TypeScript

- Strict mode; avoid `any`, never `as any` to silence an error, use `!` sparingly.
- Explicit return types on exported functions. Union types for status enums. Always async/await, never callbacks.
- Naming: `camelCase` variables/functions, `PascalCase` types/interfaces/components, `SCREAMING_SNAKE_CASE` constants.
- Files: components `PascalCase.tsx`; hooks `useCamelCase.ts`; services/routes/utils `camelCase.ts`; utilities, validation, business logic, API schemas always `.ts`. One clear purpose per file.

## Error handling

- Throw typed errors from one errors module. Never `res.status(4xx).json({ error })` in a route handler.
- Frontend: `toaster.error` for user-facing errors, `console.error` for debug context. Let errors bubble to error boundaries or middleware.

## Docs

- `docs/` holds only what code cannot show: setup and operations, external constraints. Behavior lives in code and tests; review and test reports are not kept as docs.
- `docs/decisions/` holds numbered architecture decision records (Status, Context, Decision, Rationale, Consequences, Rejected alternative) for durable decisions the code cannot show. `plans/` holds finite work; delete a plan when its acceptance criteria are met. Docs never hold file inventories, versions, route lists, environment values or benchmark snapshots.

## Build and verification

- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`.
- Dependency hygiene: remove unused dependencies and their build config immediately; audit bundle impact before adding one.
- Conventional commit bodies carry the why: facts removed from comments, external references, and the reason for any exception.

## Scope

- Complete the agreed outcome only. Record adjacent ideas separately; do not implement them unless scope is explicitly expanded.
- Verify the result, then wait for acceptance before taking on additional work.

## Bun / TypeScript stack

- Bun for everything (`bun install`, `bun run`). oxlint for lint, oxfmt for format, tsgo (`@typescript/native-preview`) for typecheck, Vitest for tests. knip for unused dependencies, exports, and files. `bun audit` fails on high or critical advisories. Both knip and audit run in `lint` / `check`.
- One TypeScript: `tsgo` from `@typescript/native-preview` is the only TypeScript. No `tsc` in scripts or CI, no `typescript@5` or `@6` in the lockfile. Emit through `tsgo` or `bun build`.
- Root `package.json` scripts: `dev`, `build`, `test`, `typecheck`, `lint`, `format`, `format:check`, `check`, `knip`, `audit`.
- When applicable, monorepo shape: `shared/`, `frontend/`, `backend/`. Shared types in `shared/src`; never duplicate a type across the boundary.
- Frontend: React 19 functional components with typed props; Vite; Tailwind v4 with tokens in a single `tokens.css` `@theme` file.
- Never call `useEffect` directly. Exactly two wrapper hooks are allowed as the only callers of `useEffect`: `useMountEffect(effect)` with no dependency parameter, for one-time external sync on mount; and `useSyncedEffect(effect, deps)` with a required `deps` array, for keeping an external system (DOM, subscriptions, timers, storage) in sync with state. State derivation, data fetching, and reacting to user actions never use either. A wrapper that accepts an optional deps array or forwards arbitrary arguments is a rename of `useEffect` and violates the rule.

| Instead of useEffect for            | Use                    |
| ----------------------------------- | ---------------------- |
| Deriving state from props or state  | Compute inline         |
| Fetching data                       | TanStack Query         |
| Responding to user actions          | Event handlers         |
| One-time external sync on mount     | `useMountEffect`       |
| External sync with dependencies     | `useSyncedEffect`      |
| Resetting state when a prop changes | `key` on the component |

- Features import queries and services, never the HTTP client. Responses are parsed once, at the client boundary, against the shared schemas.
- Config modules listed in `configModules` export parsed typed values only, never the environment object. Reading individual keys to parse is fine; returning, aliasing, or spreading `process.env` / `import.meta.env` is not.
- Class composition: `cn` from the `cn` package; `cva` only as a recorded deviation.
- Base UI via `@base-ui/react` (shadcn `base-nova` style). Components are owned in the repo under `shared/components/ui`, not a dependency to work around.
- TanStack Query for server state. Express 5 backend. SQLite persistence. zod at untrusted boundaries.
- Icons from a local icons module; no icon packages in feature files.

## Approved dependencies

| Package                      | Reason                                |
| ---------------------------- | ------------------------------------- |
| `bun`                        | Runtime, package manager, and scripts |
| `react` / `react-dom`        | UI                                    |
| `vite`                       | Frontend bundler                      |
| `tailwindcss`                | Utility CSS                           |
| `@base-ui/react`             | Accessible primitives                 |
| `@tanstack/react-query`      | Server state                          |
| `express`                    | HTTP API                              |
| `zod`                        | Untrusted input validation            |
| `oxlint` / `oxfmt`           | Lint and format                       |
| `@typescript/native-preview` | Typecheck (`tsgo`)                    |
| `vitest`                     | Tests                                 |
| `knip`                       | Unused dependencies, exports, files   |
| `concurrently`               | Run multiple dev servers together     |

Anything outside this list is recorded in the project layer of `AGENTS.md` with a one-line reason.
<!-- standards:end -->
Shared agent rules, design vocabulary, and lint configs for Dino Bun and Python projects.

## Project

- This repository is the source of `@dino/standards`. Consumers install it as a git dependency and run the `standards` CLI.
- Rule markdown under `agents/` and `design/` is the source of truth for managed regions. Edit here, bump the version, tag, then sync consumers.
- The CLI lives in `src/`. Keep the command surface small: `sync` and `check` only.
