# tests/conftest.py
# @ai-rules:
# 1. [Constraint]: Shared fixtures. Isolates store to temp dirs, subprocess to mocks.
# 2. [Pattern]: tmp_store = filesystem isolation, mock_systemctl = subprocess isolation.
# 3. [Gotcha]: mock_systemctl patches cursor_schedule.systemd -- not store_sync.

from unittest.mock import MagicMock, patch

import pytest

from cursor_schedule.store import add_task


@pytest.fixture
def tmp_store(tmp_path, monkeypatch):
    monkeypatch.setenv("CURSOR_SCHEDULE_DATA", str(tmp_path))
    import cursor_schedule.cli_extra as extra_mod
    import cursor_schedule.runner as runner_mod
    import cursor_schedule.store as store_mod

    monkeypatch.setattr(store_mod, "STORE_DIR", tmp_path)
    monkeypatch.setattr(store_mod, "STORE_FILE", tmp_path / "tasks.json")
    monkeypatch.setattr(store_mod, "REPORTS_DIR", tmp_path / "reports")
    monkeypatch.setattr(extra_mod, "REPORTS_DIR", tmp_path / "reports")
    monkeypatch.setattr(runner_mod, "REPORTS_DIR", tmp_path / "reports")
    yield tmp_path


@pytest.fixture
def sample_task(tmp_store):
    return add_task(
        "test-smoke",
        "test-smoke",
        "2099-01-01 00:00",
        "echo hi",
        "/tmp",
        guardrails=["Only modify src/"],
    )


@pytest.fixture
def mock_systemctl():
    with patch("cursor_schedule.systemd.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        yield mock_run


@pytest.fixture
def mock_agent(monkeypatch):
    monkeypatch.setattr(
        "cursor_schedule.cli.shutil.which",
        lambda name: "/usr/bin/cursor-agent" if name == "cursor-agent" else None,
    )
