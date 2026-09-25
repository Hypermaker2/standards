## Working in this repo

- The block between `standards:begin` and `standards:end` in `AGENTS.md` and `DESIGN.md` is written by `@dino/standards` and is never edited by hand. Change the rule in the standards repository (`Hypermaker2/standards`), release a tag, then bump every consumer: `bun remove @dino/standards && bun add -d github:Hypermaker2/standards#vX.Y.Z && bunx standards sync`. The project layer below the block is the only part edited in this repository.
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
