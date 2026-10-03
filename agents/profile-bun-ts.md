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
