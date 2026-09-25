## Bun / TypeScript stack

- Bun for everything (`bun install`, `bun run`). oxlint for lint, oxfmt for format, tsgo (`@typescript/native-preview`) for typecheck, Vitest for tests.
- Root `package.json` scripts: `dev`, `build`, `test`, `typecheck`, `lint`, `format`, `format:check`, `check`.
- When applicable, monorepo shape: `shared/`, `frontend/`, `backend/`. Shared types in `shared/src`; never duplicate a type across the boundary.
- Frontend: React 19 functional components with typed props; Vite; Tailwind v4 with tokens in a single `tokens.css` `@theme` file.
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
| `concurrently`               | Run multiple dev servers together     |

Anything outside this list is recorded in the project layer of `AGENTS.md` with a one-line reason.
