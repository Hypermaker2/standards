## Python stack

- `uv` for environment and package management. Prefer `uv run` over activating a venv by hand.
- Declare project metadata in root `pyproject.toml`. That file is the source of truth for name, version, dependencies, and tool config.
- Ruff for lint and format. `@dino/standards` ships `ruff.base.toml`. Project-specific rules go in root `ruff.toml`, which must contain `extend = "ruff.base.toml"`. Remove `[tool.ruff]` from `pyproject.toml` once `ruff.toml` exists: Ruff ignores pyproject tool config when a `ruff.toml` is present.
- Run `uv run ruff check` and `uv run ruff format` from the repo root. Do not maintain a second formatter.
- pytest for tests. Keep fixtures close to the tests that need them. Prefer explicit asserts over heavy fixture magic.
- Name test files `test_*.py` or `*_test.py` and keep one clear behavior per test function.
- pyright (or basedpyright) for type checking. Strict settings; avoid `Any` to silence errors. Annotate public function returns.
- Prefer `pathlib.Path` over raw string paths. Use context managers for files and network resources.
- Fail fast on broken invariants; never swallow exceptions with bare `except`. Recover deliberately or rethrow with context.
- Write the happy path. Guard only untrusted external data. No defensive defaults for values your own typed code produced.
- No comments in code. Names and structure say what code does; a test says why a non-obvious behavior must hold.
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`.
- Dependency hygiene: remove unused packages immediately; prefer the standard library when it is enough.
- After a task, run ruff, pyright, and pytest before considering it done. Never commit or push unless asked.
