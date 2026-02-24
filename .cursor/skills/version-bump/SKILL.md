---
name: version-bump
description: Manage semantic versioning and releases for cursor-schedule. Use when the user asks to bump the version, create a release, tag a version, or ship/publish a new version. Handles git tagging and GitHub release creation.
---

# Version Bump & Release

## How Versioning Works

This project uses `setuptools-scm` -- the version is derived from **git tags**, not from any file. There is no hardcoded version string to edit.

- Tag `v1.2.3` on any commit -> wheel builds as `cursor_schedule-1.2.3`
- Between tags, dev installs get `1.2.4.dev5` (next patch + commit count)
- `cursor-schedule --version` always reflects the computed version

## Release Workflow

### 1. Determine the bump type

| Change | Bump | Example |
| :--- | :--- | :--- |
| Breaking API change | major | `v1.0.0` -> `v2.0.0` |
| New feature, no breakage | minor | `v0.2.0` -> `v0.3.0` |
| Bug fix, docs, CI | patch | `v0.2.0` -> `v0.2.1` |

### 2. Check current state

```bash
git fetch --tags origin
git tag -l 'v*' --sort=-v:refname | head -5
git log --oneline $(git describe --tags --abbrev=0)..HEAD
```

### 3. Create the tag

```bash
git tag v<MAJOR>.<MINOR>.<PATCH>
git push origin v<MAJOR>.<MINOR>.<PATCH>
```

This triggers `.github/workflows/release.yml` which:
- Builds the wheel (version from tag via `setuptools-scm`)
- Pushes container to `ghcr.io`
- Creates a GitHub Release with auto-generated notes

### 4. Verify

```bash
gh run list --limit 1
gh run watch <run-id>
gh release view v<MAJOR>.<MINOR>.<PATCH>
```

## Rules

- **Never edit `pyproject.toml` or `__init__.py` to change the version.** The tag is the single source of truth.
- Tags must follow `v<MAJOR>.<MINOR>.<PATCH>` format (e.g., `v0.3.0`).
- Only tag commits on `main` that have passed CI.
- The `local_scheme = "no-local-version"` setting in `pyproject.toml` ensures clean version strings without `+gXXXXXXX` suffixes in wheels.
