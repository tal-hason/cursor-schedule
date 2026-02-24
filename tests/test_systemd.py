# tests/test_systemd.py
# @ai-rules:
# 1. [Constraint]: Tests systemd.py unit generation with ALL subprocess calls mocked.
# 2. [Pattern]: Patches subprocess.run in cursor_schedule.systemd and UNIT_DIR to tmp.
# 3. [Gotcha]: Must mock _daemon_reload, enable, disable, start -- not just create.

from unittest.mock import MagicMock, patch

from cursor_schedule.systemd import (
    _runtime_path,
    create_units,
    enable_timer,
    remove_units,
)

MOCK_SUBPROCESS = "cursor_schedule.systemd.subprocess.run"


def test_create_units_content(tmp_path):
    with (
        patch(MOCK_SUBPROCESS) as mock_run,
        patch("cursor_schedule.systemd.UNIT_DIR", tmp_path),
    ):
        mock_run.return_value = MagicMock(returncode=0)
        create_units("my-task", "*-*-* 03:00:00", "/home/user/proj", "run tests")

    service = tmp_path / "cursor-task-my-task.service"
    timer = tmp_path / "cursor-task-my-task.timer"
    assert service.exists()
    assert timer.exists()
    svc_text = service.read_text()
    assert "ExecStart=" in svc_text
    assert "_exec my-task" in svc_text
    assert "Type=oneshot" in svc_text
    tmr_text = timer.read_text()
    assert "OnCalendar=*-*-* 03:00:00" in tmr_text
    assert "Persistent=true" in tmr_text


def test_remove_units_cleans_files(tmp_path):
    svc = tmp_path / "cursor-task-rm-test.service"
    tmr = tmp_path / "cursor-task-rm-test.timer"
    svc.write_text("[Unit]\n")
    tmr.write_text("[Unit]\n")

    with (
        patch(MOCK_SUBPROCESS) as mock_run,
        patch("cursor_schedule.systemd.UNIT_DIR", tmp_path),
    ):
        mock_run.return_value = MagicMock(returncode=0)
        remove_units("rm-test")

    assert not svc.exists()
    assert not tmr.exists()
    assert mock_run.call_count >= 2


def test_enable_timer_calls_systemctl():
    with patch(MOCK_SUBPROCESS) as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        enable_timer("my-task")

    args = mock_run.call_args[0][0]
    assert args == ["systemctl", "--user", "enable", "--now", "cursor-task-my-task.timer"]


def test_runtime_path_includes_local_bin():
    path = _runtime_path()
    assert ".local/bin" in path
    assert "/usr/bin" in path
