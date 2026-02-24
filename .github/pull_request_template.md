## Description

<!-- What does this PR do? Why is it needed? -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / code cleanup
- [ ] Documentation
- [ ] CI / tooling

## Checklist

- [ ] Tests pass (`pytest`)
- [ ] Python lint clean (`ruff check src/ tests/` and `ruff format --check src/ tests/`)
- [ ] JS lint clean (`npx eslint gnome-extension/`)
- [ ] `python -m build` succeeds
- [ ] Module boundaries respected (store owns tasks.json, systemd owns units, cli orchestrates)
- [ ] Files stay under 100 lines where practical
- [ ] AI shebang headers updated if logic changed
