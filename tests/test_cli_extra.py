# tests/test_cli_extra.py
# @ai-rules:
# 1. [Constraint]: Tests cli_extra.py subcommands. All require mock_systemctl.
# 2. [Pattern]: CliRunner + tmp_store + mock_systemctl for isolation.
# 3. [Gotcha]: uninstall requires --yes to pass confirmation gate.

from unittest.mock import patch

from click.testing import CliRunner

from cursor_schedule.cli import cli
from cursor_schedule.store import add_task, get_task, update_task

runner = CliRunner()


def test_sync_updates_status(tmp_store):
    add_task("t1", "t1", "daily", "a", "/tmp")
    with patch("cursor_schedule.store_sync.subprocess.run") as mock_run:
        mock_run.return_value = type(
            "R",
            (),
            {
                "stdout": (
                    "ActiveState=inactive\nSubState=dead\n"
                    "ExecMainExitTimestamp=Mon 2026-01-01\nExecMainStatus=0\n"
                )
            },
        )()
        result = runner.invoke(cli, ["sync"])
    assert result.exit_code == 0
    assert "updated" in result.output


def test_purge_completed(tmp_store, mock_systemctl):
    add_task("t1", "t1", "daily", "a", "/tmp")
    update_task("t1", status="completed")
    add_task("t2", "t2", "daily", "b", "/tmp")
    result = runner.invoke(cli, ["purge", "--completed"])
    assert result.exit_code == 0
    assert "t1" in result.output
    assert get_task("t1") is None
    assert get_task("t2") is not None


def test_purge_all(tmp_store, mock_systemctl):
    add_task("t1", "t1", "daily", "a", "/tmp")
    update_task("t1", status="completed")
    add_task("t2", "t2", "daily", "b", "/tmp")
    update_task("t2", status="failed")
    result = runner.invoke(cli, ["purge", "--all"])
    assert result.exit_code == 0
    assert "Purged 2" in result.output


def test_purge_nothing(tmp_store):
    result = runner.invoke(cli, ["purge", "--completed"])
    assert result.exit_code == 0
    assert "Nothing to purge." in result.output


def test_remove_existing_task(tmp_store, mock_systemctl):
    add_task("t1", "t1", "daily", "a", "/tmp")
    result = runner.invoke(cli, ["remove", "t1"])
    assert result.exit_code == 0
    assert "removed" in result.output.lower()
    assert get_task("t1") is None


def test_remove_nonexistent(tmp_store):
    result = runner.invoke(cli, ["remove", "ghost"])
    assert result.exit_code != 0
    assert "not found" in result.output


def test_reschedule_existing(tmp_store, mock_systemctl):
    add_task("t1", "t1", "daily", "a", "/tmp")
    result = runner.invoke(cli, ["reschedule", "t1", "--schedule=weekly"])
    assert result.exit_code == 0
    assert "rescheduled" in result.output
    assert get_task("t1")["schedule"] == "weekly"


def test_reschedule_nonexistent(tmp_store):
    result = runner.invoke(cli, ["reschedule", "ghost", "--schedule=weekly"])
    assert result.exit_code != 0
    assert "not found" in result.output


def test_uninstall_mocked(tmp_store, mock_systemctl, monkeypatch):
    monkeypatch.setattr("cursor_schedule.cli_extra.EXT_DIR", tmp_store / "ext")
    monkeypatch.setattr("cursor_schedule.cli_extra.SLASH_CMD", tmp_store / "cmd.md")
    with patch("cursor_schedule.cli_extra._run_quiet"):
        result = runner.invoke(cli, ["uninstall", "--yes"])
    assert result.exit_code == 0
    assert "Uninstall complete" in result.output
