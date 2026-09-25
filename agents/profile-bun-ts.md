## Bun / TypeScript stack

- Bun for everything (`bun install`, `bun run`). oxlint lint, oxfmt format, tsgo (`@typescript/native-preview`) typecheck, Vitest tests. knip for unused deps/exports/files; `bun audit` fails on high or critical. Both run in `lint`/`check`.
- One TypeScript: `tsgo` (`@typescript/native-preview`) only. No `tsc` in scripts or CI; no `typescript@5` or `@6` in the lockfile. Emit via `tsgo` or `bun build`. Root scripts: `dev`, `build`, `test`, `typecheck`, `lint`, `format`, `format:check`, `check`, `knip`, `audit`. Monorepo when applicable: `shared/`, `frontend/`, `backend/`; shared types in `shared/src`; never duplicate across the boundary. Frontend: React 19 functional components with typed props; Vite; Tailwind v4 with tokens in one `tokens.css` `@theme` file.
- Never call `useEffect` directly. Only two wrappers may: `useMountEffect(effect)` (no deps; one-time external sync on mount) and `useSyncedEffect(effect, deps)` (required `deps`; sync DOM, subscriptions, timers, or storage with state). Never use either for state derivation, data fetching, user-action reactions, or prop-change resets (`key` on the component). An optional-deps or arbitrary-forwarding wrapper is a rename and fails the rule.
- Features import queries and services, never the HTTP client; parse responses once at the client boundary against shared schemas. `cn` from the `cn` package for class composition; `cva` only as a recorded deviation. Base UI via `@base-ui/react` (shadcn `base-nova`); own components under `shared/components/ui`. TanStack Query for server state; Express 5; SQLite; zod at untrusted boundaries. Icons from a local icons module; no icon packages in feature files.

## Approved dependencies

Approved: `bun`, `react`/`react-dom`, `vite`, `tailwindcss`, `@base-ui/react`, `@tanstack/react-query`, `express`, `zod`, `oxlint`/`oxfmt`, `@typescript/native-preview`, `vitest`, `knip`, `concurrently`. Anything else: project layer of `AGENTS.md` with a one-line reason.
