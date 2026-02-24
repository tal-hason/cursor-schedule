# Contributing to cursor-schedule

## Quick Start

```bash
git clone https://github.com/thason/cursor-schedule.git
cd cursor-schedule
pip install -e '.[dev]'
npm install
```

## Code Style

### Python

- Enforced by [ruff](https://docs.astral.sh/ruff/) (`ruff check` + `ruff format`)
- Line length: 100 characters
- Target: Python 3.10+
- Rules: PEP8, pyflakes, import sort, modernize, simplify

### JavaScript (GJS)

- Enforced by [ESLint 9](https://eslint.org/) flat config
- Scope: `gnome-extension/**/*.js` only
- ESM modules (`import ... from 'gi://...'`)

### General

- Files should stay under **100 lines** where practical
- Every source file starts with a relative path comment and `@ai-rules` header
- No relative imports in Python -- use `from cursor_schedule.xxx import yyy`

## Testing

```bash
pytest                          # run all tests with coverage
ruff check src/ tests/          # lint Python
ruff format --check src/ tests/ # check Python formatting
npx eslint gnome-extension/     # lint GJS
python -m build                 # verify wheel builds
```

## Module Boundaries

| Module | Owns | Rule |
| :--- | :--- | :--- |
| `store.py` | `tasks.json` | No other module reads/writes it |
| `systemd.py` | Unit files | No other module calls `systemctl` |
| `cli.py` | Orchestration | Sole entry point for mutations |
| `taskStore.js` | CLI bridge | Only GJS module that calls CLI or reads tasks.json |

## PR Process

1. Branch from `main`
2. Make changes, add tests
3. Verify all checks pass locally (see Testing above)
4. Open a PR -- CI must pass before merge
5. Squash-merge into `main`
