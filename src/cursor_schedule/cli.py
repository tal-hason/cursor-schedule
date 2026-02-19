# src/cursor_schedule/cli.py
# @ai-rules:
# 1. [Constraint]: This is the sole entry point for user mutations. Orchestrates store + systemd.
# 2. [Pattern]: Click group with subcommands. Exit 0=success, 1=user error, 2=system error.
# 3. [Gotcha]: list --json outputs to stdout; human table also to stdout (no --json).

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import click

from cursor_schedule import __version__
from cursor_schedule.store import (
    add_task, get_task, list_tasks, remove_task, sync_from_systemd, update_task,
)
from cursor_schedule.systemd import (
    create_units, enable_timer, remove_units, start_service,
)


@click.group()
@click.version_option(__version__, prog_name="cursor-schedule")
def cli():
    """Scheduled task execution for Cursor Agent."""


from cursor_schedule.cli_extra import sync, purge, remove, reschedule, uninstall  # noqa: E402
cli.add_command(sync)
cli.add_command(purge)
cli.add_command(remove)
cli.add_command(reschedule)
cli.add_command(uninstall)


@cli.command()
@click.option("--name", required=True, help="Unique task ID (lowercase, hyphens).")
@click.option("--workspace", required=True, type=click.Path(exists=True), help="Workspace path.")
@click.option("--prompt", required=True, help="Prompt text for cursor-agent.")
@click.option("--schedule", required=True, help="systemd OnCalendar expression.")
@click.option("--model", default=None, help="Model to pass to cursor-agent.")
@click.option("--plan", "plan_path", default=None, type=click.Path(), help="Plan file path.")
@click.option("--force", is_flag=True, help="Overwrite existing task with same name.")
@click.option("--rm", "auto_remove", is_flag=True, help="Auto-remove task after completion.")
def add(name, workspace, prompt, schedule, model, plan_path, force, auto_remove):
    """Register a new scheduled task."""
    if not shutil.which("cursor-agent"):
        click.secho("Error: cursor-agent not found on PATH.", fg="red")
        sys.exit(1)
    existing = get_task(name)
    if existing and not force:
        click.secho(f"Error: task '{name}' already exists. Use --force to overwrite.", fg="red")
        sys.exit(1)
    if existing and force:
        remove_units(name)
        remove_task(name)
    try:
        create_units(name, schedule, workspace, prompt, model)
        enable_timer(name)
    except Exception as e:
        click.secho(f"Error creating systemd units: {e}", fg="red")
        sys.exit(2)
    add_task(name, name, schedule, prompt, workspace, model, plan_path, auto_remove)
    rm_note = " (auto-remove on completion)" if auto_remove else ""
    click.secho(f"Task '{name}' scheduled: {schedule}{rm_note}", fg="green")


@cli.command("list")
@click.option("--json", "as_json", is_flag=True, help="Output as JSON.")
@click.option("--status", "status_filter", default=None, help="Filter by status.")
def list_cmd(as_json, status_filter):
    """List all scheduled tasks."""
    sync_from_systemd()
    tasks = list_tasks(status_filter)
    if as_json:
        click.echo(json.dumps({"version": 1, "tasks": tasks}, indent=2))
        return
    if not tasks:
        click.echo("No tasks.")
        return
    click.echo(f"{'NAME':<24} {'SCHEDULE':<22} {'STATUS':<12}")
    click.echo("-" * 58)
    for t in tasks:
        color = {"waiting": "blue", "running": "yellow", "completed": "green",
                 "failed": "red", "cancelled": "white"}.get(t["status"], "white")
        click.echo(f"{t['id']:<24} {t['schedule']:<22} ", nl=False)
        click.secho(t["status"], fg=color)


@cli.command()
@click.argument("task_id")
def cancel(task_id):
    """Cancel a scheduled task."""
    task = get_task(task_id)
    if not task:
        click.secho(f"Error: task '{task_id}' not found.", fg="red")
        sys.exit(1)
    remove_units(task_id)
    update_task(task_id, status="cancelled")
    click.secho(f"Task '{task_id}' cancelled.", fg="yellow")


@cli.command()
@click.argument("task_id")
@click.option("--follow", "-f", is_flag=True, help="Follow log output.")
def logs(task_id, follow):
    """View logs for a task."""
    task = get_task(task_id)
    if not task:
        click.secho(f"Error: task '{task_id}' not found.", fg="red")
        sys.exit(1)
    cmd = ["journalctl", "--user", "-u", f"cursor-task-{task_id}.service", "--no-pager"]
    if follow:
        cmd.append("--follow")
    os.execvp(cmd[0], cmd)


@cli.command()
@click.argument("task_id")
def run(task_id):
    """Manually trigger a task now."""
    task = get_task(task_id)
    if not task:
        click.secho(f"Error: task '{task_id}' not found.", fg="red")
        sys.exit(1)
    try:
        start_service(task_id)
        click.secho(f"Task '{task_id}' started.", fg="green")
    except subprocess.CalledProcessError as e:
        click.secho(f"Error starting task: {e}", fg="red")
        sys.exit(2)
