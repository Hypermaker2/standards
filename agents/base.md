## Code rules

- Optimize for readability and skimmability. Avoid cleverness; prefer early returns.
- No comments in code. Names and structure say what code does; a test says why a non-obvious behavior must hold. Put history and external references in commit messages or docs. `bun run lint` fails on any comment.
- No backward compatibility: one app, one codebase. Evolve types and interfaces and update all callers together, no shims or fallbacks.
- Fail fast on broken invariants: throw instead of returning null or empty placeholders from typed paths. Never swallow errors: recover deliberately or rethrow with context.
- Write the happy path. Guard only untrusted external data (network responses, user input, localStorage). No defensive `?.`, `??`, or `if (!x) return` for values your own typed code produced.
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

## Build and verification

- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`.
- Dependency hygiene: remove unused dependencies and their build config immediately; audit bundle impact before adding one.
- After a task, run lint, typecheck, and test before considering it done. Never commit or push unless asked.

## Scope

- Complete the agreed outcome only. Record adjacent ideas separately; do not implement them unless scope is explicitly expanded.
- Verify the result, then wait for acceptance before taking on additional work.
