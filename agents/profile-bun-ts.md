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
