# tests/conftest.py
# @ai-rules:
# 1. [Constraint]: Shared fixtures for CLI smoke tests. Isolates store to temp dirs.
# 2. [Pattern]: Monkeypatch REPORTS_DIR in all modules that import it by value.

import pytest

from cursor_schedule.store import add_task


@pytest.fixture
def tmp_store(tmp_path, monkeypatch):
    monkeypatch.setenv("CURSOR_SCHEDULE_DATA", str(tmp_path))
    import cursor_schedule.store as store_mod
    import cursor_schedule.cli_extra as extra_mod
    import cursor_schedule.runner as runner_mod
    import cursor_schedule.store_sync as sync_mod

    monkeypatch.setattr(store_mod, "STORE_DIR", tmp_path)
    monkeypatch.setattr(store_mod, "STORE_FILE", tmp_path / "tasks.json")
    monkeypatch.setattr(store_mod, "REPORTS_DIR", tmp_path / "reports")
    monkeypatch.setattr(extra_mod, "REPORTS_DIR", tmp_path / "reports")
    monkeypatch.setattr(runner_mod, "REPORTS_DIR", tmp_path / "reports")
    monkeypatch.setattr(sync_mod, "REPORTS_DIR", tmp_path / "reports")
    yield tmp_path


@pytest.fixture
def sample_task(tmp_store):
    return add_task("test-smoke", "test-smoke", "2099-01-01 00:00",
                    "echo hi", "/tmp", guardrails=["Only modify src/"])
