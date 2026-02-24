# cursor-schedule

Scheduled task execution for [Cursor Agent](https://docs.cursor.com/agent) via systemd timers.

Schedule one-shot or recurring tasks that run `cursor-agent` headlessly at specified times. Add guardrails to constrain agent behavior and get post-execution reports. Manage tasks through a CLI and monitor them from the GNOME Shell top bar.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/tal-hason/cursor-schedule/main/install.sh | bash
```

Requires: Python 3.10+, [cursor-agent](https://docs.cursor.com/agent), systemd, docker/podman, GNOME Shell 45-49.

> **Wayland Note**: After installation, log out and back in for the GNOME Shell extension to activate. On X11, press `Alt+F2` then type `r` to restart the shell.

## Quick Start

```bash
# Schedule a recurring task with guardrails
cursor-schedule add \
  --name weekly-lint \
  --workspace ~/projects/my-app \
  --schedule "Mon *-*-* 09:00" \
  --prompt "Run linting and fix all auto-fixable issues." \
  --guardrails "Only modify files in src/" \
  --guardrails "Do not install new dependencies"

# Schedule a one-shot task (auto-removed after completion)
cursor-schedule add \
  --name deploy-prep \
  --workspace ~/projects/api \
  --schedule "2026-03-01 09:00" \
  --prompt "Run all tests and prepare the release changelog." \
  --rm

# List tasks
cursor-schedule list

# View execution report
cursor-schedule report weekly-lint

# View logs
cursor-schedule logs weekly-lint

# Manually trigger a task
cursor-schedule run weekly-lint
```

Or use the `/schedule-task` slash command in Cursor chat for guided task creation.

## CLI Reference

| Command | Description |
|---|---|
| `add` | Register a new scheduled task |
| `list` | List all tasks (`--json`, `--status`) |
| `cancel <id>` | Cancel a task and disable its timer |
| `logs <id>` | View task output (`--follow`) |
| `run <id>` | Manually trigger a task |
| `report <id>` | View the execution report (`--all`, `--one-line`) |
| `remove <id>` | Remove a task and its systemd units |
| `reschedule <id>` | Change schedule (`--schedule`) |
| `sync` | Reconcile task statuses with systemd |
| `purge` | Remove finished tasks (`--completed`, `--failed`, `--all`) |
| `uninstall` | Remove cursor-schedule from the system (`--purge`) |

### Key Flags for `add`

| Flag | Description |
|---|---|
| `--name` | Unique task ID (required) |
| `--workspace` | Target workspace path (required) |
| `--prompt` | Prompt text for cursor-agent (required) |
| `--schedule` | systemd OnCalendar expression (required) |
| `-g, --guardrails` | Constraint rule, repeatable (e.g., "Only modify src/") |
| `--guardrails-file` | File with guardrail rules, one per line |
| `--summary-template` | Custom summary template file |
| `--rm` | Auto-remove task after completion |
| `--model` | Model to pass to cursor-agent |
| `--force` | Overwrite existing task |

### Schedule Expressions

The `--schedule` flag accepts any systemd [OnCalendar](https://www.freedesktop.org/software/systemd/man/systemd.time.html) expression:

| Expression | Meaning |
|---|---|
| `2026-03-01 09:00` | One-shot: March 1, 2026 at 9am |
| `Mon *-*-* 09:00` | Every Monday at 9am |
| `*-*-* 02:00` | Daily at 2am |
| `Mon..Fri *-*-* 18:00` | Weekdays at 6pm |

## Guardrails and Reports

Tasks can include guardrails -- constraints injected into the agent's prompt to prevent scope creep.

After execution, the agent generates a summary report at `~/.local/share/cursor-schedule/reports/<task-id>/`. View it with:

```bash
cursor-schedule report <id>          # Full report
cursor-schedule report <id> --one-line  # Single outcome line (used in notifications)
```

Desktop notifications automatically include the report outcome when available.

## GNOME Extension

The top-bar indicator shows a popover panel with:

- **Task list** with color-coded status icons (waiting, running, completed, failed)
- **Action buttons** per task: run, cancel, rerun, remove, reschedule, open terminal
- **Logs/Report toggle** showing journal output or agent summary report
- **Live updates** via file monitoring on `tasks.json`
- **Date/time picker** for rescheduling tasks
- **Configurable preferences**: binary path, log lines, popup timeout

## Uninstall

```bash
cursor-schedule uninstall         # Remove CLI, extension, slash command
cursor-schedule uninstall --purge # Also remove task data and container image
```

## License

MIT
