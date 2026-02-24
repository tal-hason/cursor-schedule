# tests/test_runner.py
# @ai-rules:
# 1. [Constraint]: Tests runner.py prompt building and agent discovery.
# 2. [Pattern]: No subprocess calls -- tests _build_prompt and _find_agent only.

from unittest.mock import patch

from cursor_schedule.runner import _build_prompt, _find_agent


def test_build_prompt_with_guardrails():
    task = {
        "prompt": "Run lint",
        "guardrails": ["Only modify src/", "No new dependencies"],
        "summary_template": None,
    }
    result = _build_prompt(task, "/tmp/report.md")
    assert "CONSTRAINTS" in result
    assert "- Only modify src/" in result
    assert "- No new dependencies" in result
    assert "Run lint" in result
    assert "/tmp/report.md" in result


def test_build_prompt_without_guardrails():
    task = {"prompt": "Run lint", "guardrails": [], "summary_template": None}
    result = _build_prompt(task, "/tmp/report.md")
    assert "CONSTRAINTS" not in result
    assert "Run lint" in result
    assert "/tmp/report.md" in result


def test_build_prompt_custom_template():
    custom = "Write report to {report_path} with outcome."
    task = {"prompt": "Run lint", "guardrails": [], "summary_template": custom}
    result = _build_prompt(task, "/tmp/report.md")
    assert "Write report to /tmp/report.md with outcome." in result
    assert "Post-Execution Report" not in result


def test_find_agent_prefers_cursor_agent():
    with patch("cursor_schedule.runner.shutil.which") as mock_which:
        mock_which.side_effect = lambda name: (
            "/usr/bin/cursor-agent" if name == "cursor-agent" else None
        )
        assert _find_agent() == "/usr/bin/cursor-agent"
        mock_which.assert_called_with("cursor-agent")


def test_find_agent_falls_back_to_agent():
    with patch("cursor_schedule.runner.shutil.which") as mock_which:
        mock_which.side_effect = lambda name: "/usr/bin/agent" if name == "agent" else None
        assert _find_agent() == "/usr/bin/agent"


def test_find_agent_returns_none():
    with patch("cursor_schedule.runner.shutil.which", return_value=None):
        assert _find_agent() is None
