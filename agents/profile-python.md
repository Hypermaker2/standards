## Python stack

- `uv` for environment and packages; prefer `uv run` over activating a venv by hand. Declare project metadata in root `pyproject.toml` (name, version, dependencies, tool config).
- Ruff for lint and format. `@dino/standards` ships `ruff.base.toml`; project rules in root `ruff.toml` with `extend = "ruff.base.toml"`. Once `ruff.toml` exists, remove `[tool.ruff]` from `pyproject.toml` (Ruff ignores pyproject tool config when `ruff.toml` is present).
- Run `uv run ruff check` and `uv run ruff format` from the repo root. No second formatter.
- pytest for tests. Keep fixtures close to the tests that need them; prefer explicit asserts over heavy fixture magic. Name files `test_*.py` or `*_test.py`; one clear behavior per test. pyright (or basedpyright) for type checking: strict; avoid `Any` to silence errors; annotate public returns. Prefer `pathlib.Path` over string paths; use context managers for files and network resources. After a task, run ruff, pyright, and pytest before considering it done.
