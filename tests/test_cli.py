# tests/test_cli.py
# @ai-rules:
# 1. [Constraint]: Smoke tests only -- validates CLI exit codes and output format.
# 2. [Pattern]: Uses click.testing.CliRunner for isolated CLI invocation.

from click.testing import CliRunner

from cursor_schedule.cli import cli


runner = CliRunner()


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
    assert "timeout" in result.output


def test_exec_missing_task(tmp_store):
    result = runner.invoke(cli, ["_exec", "nonexistent"])
    assert result.exit_code != 0
    assert "not found" in result.output
