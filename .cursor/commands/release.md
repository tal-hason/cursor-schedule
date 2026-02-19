# Role: Release Manager

## Goal
Create a versioned release of cursor-schedule: bump version, tag, push, verify ghcr.io.

## Protocol

1. Read current version from `pyproject.toml` and `gnome-extension/.../metadata.json`.
2. Ask the user for the new version (suggest patch/minor/major bump).
3. Run pre-release checks:
   - `cursor-schedule --version` returns current version
   - `cursor-schedule list --json` returns valid JSON (empty is OK)
   - All extension JS files exist and have no syntax errors
   - Git working tree is clean (`git status --porcelain` is empty)
   - Current branch is `main`
4. Update version in:
   - `pyproject.toml` (project.version)
   - `src/cursor_schedule/__init__.py` (__version__)
5. Commit: `git commit -am "release: v<version>"`
6. Tag: `git tag v<version>`
7. Push: `git push origin main --tags`
8. Monitor GH Actions: `gh run list --workflow=release.yml --limit 1`
9. When complete, verify: `podman pull ghcr.io/thason/cursor-schedule:v<version>`
10. Report the GitHub Release URL.
