# tests/test_store_sync.py
# @ai-rules:
# 1. [Constraint]: Tests reconciliation in store_sync.py. Mocks subprocess for systemctl show.
# 2. [Pattern]: Accepted coupling -- store_sync imports _read_store/_atomic_write (private).
# 3. [Gotcha]: auto_remove covers BOTH completed AND failed tasks.

from unittest.mock import MagicMock, patch

from cursor_schedule.store import add_task, get_task, update_task
from cursor_schedule.store_sync import sync_from_systemd

MOCK_SUBPROCESS = "cursor_schedule.store_sync.subprocess.run"


def _mock_systemctl_show(active="inactive", exit_status="0", timestamp=""):
    mock = MagicMock()
    mock.stdout = (
        f"ActiveState={active}\n"
        f"SubState=dead\n"
        f"ExecMainExitTimestamp={timestamp}\n"
        f"ExecMainStatus={exit_status}\n"
    )
    return mock


def test_sync_marks_running(tmp_store):
    add_task("t1", "t1", "daily", "a", "/tmp")
    with patch(MOCK_SUBPROCESS, return_value=_mock_systemctl_show(active="activating")):
        changed = sync_from_systemd()
    assert changed is True
    assert get_task("t1")["status"] == "running"


def test_sync_marks_completed(tmp_store):
    add_task("t1", "t1", "daily", "a", "/tmp")
    result = _mock_systemctl_show(active="inactive", exit_status="0", timestamp="Mon 2026-01-01")
    with patch(MOCK_SUBPROCESS, return_value=result):
        changed = sync_from_systemd()
    assert changed is True
    task = get_task("t1")
    assert task["status"] == "completed"
    assert task["exit_code"] == 0


def test_sync_marks_failed(tmp_store):
    add_task("t1", "t1", "daily", "a", "/tmp")
    result = _mock_systemctl_show(active="inactive", exit_status="1", timestamp="Mon 2026-01-01")
    with patch(MOCK_SUBPROCESS, return_value=result):
        changed = sync_from_systemd()
    assert changed is True
    task = get_task("t1")
    assert task["status"] == "failed"
    assert task["exit_code"] == 1


def test_sync_auto_remove_completed(tmp_store):
    add_task("t1", "t1", "daily", "a", "/tmp", auto_remove=True)
    result = _mock_systemctl_show(active="inactive", exit_status="0", timestamp="Mon 2026-01-01")
    with patch(MOCK_SUBPROCESS, return_value=result):
        sync_from_systemd()
    assert get_task("t1") is None


def test_sync_auto_remove_failed(tmp_store):
    add_task("t1", "t1", "daily", "a", "/tmp", auto_remove=True)
    result = _mock_systemctl_show(active="inactive", exit_status="1", timestamp="Mon 2026-01-01")
    with patch(MOCK_SUBPROCESS, return_value=result):
        sync_from_systemd()
    assert get_task("t1") is None


def test_sync_skips_terminal_states(tmp_store):
    add_task("t1", "t1", "daily", "a", "/tmp")
    update_task("t1", status="completed")
    add_task("t2", "t2", "daily", "b", "/tmp")
    update_task("t2", status="cancelled")
    with patch(MOCK_SUBPROCESS) as mock_run:
        changed = sync_from_systemd()
    assert changed is False
    mock_run.assert_not_called()


def test_sync_no_change_returns_false(tmp_store):
    add_task("t1", "t1", "daily", "a", "/tmp")
    result = _mock_systemctl_show(active="inactive", exit_status="0", timestamp="")
    with patch(MOCK_SUBPROCESS, return_value=result):
        changed = sync_from_systemd()
    assert changed is False
    assert get_task("t1")["status"] == "waiting"
