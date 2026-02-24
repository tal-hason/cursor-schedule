# src/cursor_schedule/cli_extra.py
# @ai-rules:
# 1. [Constraint]: Extension of cli.py. Registers additional subcommands on the same Click group.
# 2. [Pattern]: Imported and registered in cli.py via cli.add_command().
# 3. [Gotcha]: uninstall removes system-wide artifacts -- prompt for confirmation.

import re
import shutil
import subprocess
from pathlib import Path

import click

from cursor_schedule.store import REPORTS_DIR, list_tasks, remove_task
from cursor_schedule.store_sync import sync_from_systemd
from cursor_schedule.systemd import remove_units

EXT_UUID = "cursor-schedule@thason.github.io"
EXT_DIR = Path.home() / ".local/share/gnome-shell/extensions" / EXT_UUID
SLASH_CMD = Path.home() / ".cursor/commands/schedule-task.md"


@click.command()
def sync():
    """Reconcile task statuses with systemd."""
    changed = sync_from_systemd()
    if changed:
        click.secho("Task statuses updated from systemd.", fg="green")
    else:
        click.echo("All task statuses are current.")


@click.command()
@click.argument("task_id")
@click.option("--all", "show_all", is_flag=True, help="List all reports with timestamps.")
@click.option("--one-line", is_flag=True, help="Print single outcome line (for notifications).")
def report(task_id, show_all, one_line):
    """View the execution report for a task."""
    from cursor_schedule.store import get_task
    task = get_task(task_id)
    if not task:
        click.secho(f"Error: task '{task_id}' not found.", fg="red")
        raise SystemExit(1)
    report_dir = REPORTS_DIR / task_id
    if not report_dir.exists():
        if one_line:
            click.echo(f"Task {task_id} finished")
            return
        click.secho("No reports found.", fg="yellow")
        return
    reports = sorted(report_dir.glob("*.md"), reverse=True)
    if not reports:
        if one_line:
            click.echo(f"Task {task_id} finished")
            return
        click.secho("No reports found.", fg="yellow")
        return
    if show_all:
        for r in reports:
            click.echo(f"  {r.stem}  {r}")
        return
    latest = reports[0]
    content = latest.read_text()
    if one_line:
        match = re.search(r"\*\*Outcome\*\*:\s*(.+)", content)
        outcome = match.group(1).strip() if match else "completed"
        click.echo(f"{task_id}: {outcome}")
        return
    click.echo(content)


@click.command()
@click.argument("task_id")
def remove(task_id):
    """Remove a single task and its systemd units."""
    from cursor_schedule.store import get_task
    task = get_task(task_id)
    if not task:
        click.secho(f"Error: task '{task_id}' not found.", fg="red")
        raise SystemExit(1)
    remove_units(task_id)
    remove_task(task_id)
    click.secho(f"Task '{task_id}' removed.", fg="green")


@click.command()
@click.argument("task_id")
@click.option("--schedule", required=True, help="New systemd OnCalendar expression.")
def reschedule(task_id, schedule):
    """Change the schedule of an existing task."""
    from cursor_schedule.store import get_task, update_task
    from cursor_schedule.systemd import remove_units, create_units, enable_timer
    task = get_task(task_id)
    if not task:
        click.secho(f"Error: task '{task_id}' not found.", fg="red")
        raise SystemExit(1)
    remove_units(task_id)
    create_units(task_id, schedule, task["workspace"], task["prompt"], task.get("model"))
    enable_timer(task_id)
    update_task(task_id, schedule=schedule, status="waiting", completed_at=None, exit_code=None)
    click.secho(f"Task '{task_id}' rescheduled: {schedule}", fg="green")


@click.command()
@click.option("--completed", is_flag=True, help="Remove completed tasks.")
@click.option("--failed", is_flag=True, help="Remove failed tasks.")
@click.option("--all", "purge_all", is_flag=True, help="Remove all finished tasks.")
def purge(completed, failed, purge_all):
    """Remove finished tasks and their systemd units."""
    targets = []
    for task in list_tasks():
        if purge_all and task["status"] in ("completed", "failed", "cancelled"):
            targets.append(task)
        elif completed and task["status"] == "completed":
            targets.append(task)
        elif failed and task["status"] == "failed":
            targets.append(task)
    if not targets:
        click.echo("Nothing to purge.")
        return
    for task in targets:
        remove_units(task["id"])
        remove_task(task["id"])
        click.echo(f"  Removed: {task['id']} ({task['status']})")
    click.secho(f"Purged {len(targets)} task(s).", fg="green")


@click.command()
@click.option("--purge", "full_purge", is_flag=True, help="Also remove task data and container image.")
@click.confirmation_option(prompt="This will uninstall cursor-schedule. Continue?")
def uninstall(full_purge):
    """Uninstall cursor-schedule from this system."""
    _run_quiet(["gnome-extensions", "disable", EXT_UUID])
    if EXT_DIR.exists():
        shutil.rmtree(EXT_DIR)
        click.echo(f"  Removed GNOME extension: {EXT_DIR}")
    if SLASH_CMD.exists():
        SLASH_CMD.unlink()
        click.echo(f"  Removed slash command: {SLASH_CMD}")
    if full_purge:
        from cursor_schedule.store import STORE_DIR
        if STORE_DIR.exists():
            shutil.rmtree(STORE_DIR)
            click.echo(f"  Removed task data: {STORE_DIR}")
        for task in list_tasks():
            remove_units(task["id"])
        _run_quiet(["podman", "rmi", "ghcr.io/thason/cursor-schedule"])
        _run_quiet(["docker", "rmi", "ghcr.io/thason/cursor-schedule"])
    click.secho("Uninstall complete. Run: pip uninstall cursor-schedule", fg="yellow")


def _run_quiet(cmd):
    try:
        subprocess.run(cmd, capture_output=True, timeout=15)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
