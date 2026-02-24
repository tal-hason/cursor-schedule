# src/cursor_schedule/runner.py
# @ai-rules:
# 1. [Constraint]: Template Method -- fixed execution skeleton with injectable guardrails and template.
# 2. [Pattern]: Guardrails injected as prompt-prepended text (probe FAIL path, no .mdc files).
# 3. [Gotcha]: Must exit with cursor-agent's exit code, not its own.

import shutil
import subprocess
import sys
from datetime import datetime, timezone

import click

from cursor_schedule.store import REPORTS_DIR, get_task
from cursor_schedule.store_sync import set_report_status


DEFAULT_SUMMARY = (
    "## Post-Execution Report\n"
    "When done, create a summary at {report_path}:\n"
    "- **Outcome**: success | partial | failed\n"
    "- **Changes Made**: files modified and what changed\n"
    "- **Blockers**: anything that prevented completion\n"
    "- **Next Steps**: what remains (empty if fully complete)"
)


def _build_prompt(task, report_path):
    parts = []
    if task.get("guardrails"):
        rules = "\n".join(f"- {g}" for g in task["guardrails"])
        parts.append(f"CONSTRAINTS (you MUST follow these):\n{rules}\n")
    parts.append(task["prompt"])
    template = task.get("summary_template") or DEFAULT_SUMMARY
    parts.append("\n\n" + template.format(report_path=report_path))
    return "\n".join(parts)


def _find_agent():
    for name in ("cursor-agent", "agent"):
        path = shutil.which(name)
        if path:
            return path
    return None


def _run_agent(task, prompt):
    agent = _find_agent()
    if not agent:
        click.secho("Error: cursor-agent not found on PATH.", fg="red")
        sys.exit(1)
    cmd = [agent, "--print", "--trust", f"--workspace={task['workspace']}"]
    if task.get("model"):
        cmd.append(f"--model={task['model']}")
    cmd.append(prompt)
    result = subprocess.run(cmd)
    return result.returncode


@click.command("_exec", hidden=True)
@click.argument("task_id")
def exec_cmd(task_id):
    """Internal: execute a scheduled task with guardrails and report generation."""
    task = get_task(task_id)
    if not task:
        click.secho(f"Error: task '{task_id}' not found.", fg="red")
        sys.exit(1)

    report_dir = REPORTS_DIR / task_id
    report_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%S")
    report_path = report_dir / f"{ts}.md"

    prompt = _build_prompt(task, report_path)
    exit_code = _run_agent(task, prompt)

    status = "present" if report_path.exists() and report_path.stat().st_size > 0 else "missing"
    set_report_status(task_id, report_path if status == "present" else None, status)

    sys.exit(exit_code)
