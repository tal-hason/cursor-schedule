# tests/test_cli.py
# @ai-rules:
# 1. [Constraint]: Tests core CLI subcommands via CliRunner.
# 2. [Pattern]: mock_systemctl + mock_agent for add; tmp_store for all.

from click.testing import CliRunner

from cursor_schedule.cli import cli

runner = CliRunner()


def test_version():
    result = runner.invoke(cli, ["--version"])
    assert result.exit_code == 0
    assert "cursor-schedule" in result.output


def test_list_empty(tmp_store):
    result = runner.invoke(cli, ["list"])
    assert result.exit_code == 0
    assert "No tasks." in result.output


def test_list_json_valid(sample_task, tmp_store):
    import json
    from unittest.mock import patch

    with patch("cursor_schedule.cli.sync_from_systemd"):
        result = runner.invoke(cli, ["list", "--json"])
    assert result.exit_code == 0
    data = json.loads(result.output)
    assert "tasks" in data
    assert data["tasks"][0]["id"] == "test-smoke"


def test_cancel_nonexistent(tmp_store):
    result = runner.invoke(cli, ["cancel", "ghost"])
    assert result.exit_code != 0
    assert "not found" in result.output


def test_run_nonexistent(tmp_store):
    result = runner.invoke(cli, ["run", "ghost"])
    assert result.exit_code != 0
    assert "not found" in result.output


def test_add_basic(tmp_store, mock_systemctl, mock_agent):
    result = runner.invoke(
        cli,
        [
            "add",
            "--name=ci-test",
            "--workspace=/tmp",
            "--prompt=run tests",
            "--schedule=daily",
        ],
    )
    assert result.exit_code == 0
    assert "ci-test" in result.output
    assert "scheduled" in result.output


def test_add_force_overwrite(tmp_store, mock_systemctl, mock_agent):
    runner.invoke(
        cli,
        [
            "add",
            "--name=ci-test",
            "--workspace=/tmp",
            "--prompt=run tests",
            "--schedule=daily",
        ],
    )
    result = runner.invoke(
        cli,
        [
            "add",
            "--name=ci-test",
            "--workspace=/tmp",
            "--prompt=run tests v2",
            "--schedule=weekly",
            "--force",
        ],
    )
    assert result.exit_code == 0
    assert "ci-test" in result.output


def test_add_missing_agent(tmp_store, mock_systemctl, monkeypatch):
    monkeypatch.setattr("cursor_schedule.cli.shutil.which", lambda _name: None)
    result = runner.invoke(
        cli,
        [
            "add",
            "--name=ci-test",
            "--workspace=/tmp",
            "--prompt=run tests",
            "--schedule=daily",
        ],
    )
    assert result.exit_code != 0
    assert "cursor-agent not found" in result.output


def test_report_nonexistent_task(tmp_store):
    result = runner.invoke(cli, ["report", "nonexistent"])
    assert result.exit_code != 0
    assert "not found" in result.output


def test_report_one_line_no_report(sample_task, tmp_store):
    result = runner.invoke(cli, ["report", "test-smoke", "--one-line"])
    assert result.exit_code == 0
    assert "test-smoke" in result.output


def test_report_one_line_with_report(sample_task, tmp_store):
    report_dir = tmp_store / "reports" / "test-smoke"
    report_dir.mkdir(parents=True)
    (report_dir / "2026-01-01T000000.md").write_text(
        "## Report\n- **Outcome**: success\n- **Changes Made**: none\n"
    )
    result = runner.invoke(cli, ["report", "test-smoke", "--one-line"])
    assert result.exit_code == 0
    assert "success" in result.output


def test_report_full_content(sample_task, tmp_store):
    report_dir = tmp_store / "reports" / "test-smoke"
    report_dir.mkdir(parents=True)
    content = "## Report\n- **Outcome**: partial\n- **Blockers**: timeout\n"
    (report_dir / "2026-01-01T000000.md").write_text(content)
    result = runner.invoke(cli, ["report", "test-smoke"])
    assert result.exit_code == 0
    assert "Blockers" in result.output


def test_exec_missing_task(tmp_store):
    result = runner.invoke(cli, ["_exec", "nonexistent"])
    assert result.exit_code != 0
    assert "not found" in result.output
