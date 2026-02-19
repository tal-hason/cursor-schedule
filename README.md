# cursor-schedule

Scheduled task execution for [Cursor Agent](https://docs.cursor.com/agent) via systemd timers.

Schedule one-shot or recurring tasks that run `cursor-agent` headlessly at specified times. Manage tasks through a CLI and monitor them from the GNOME Shell top bar.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/thason/cursor-schedule/main/install.sh | bash
```

Requires: Python 3.10+, [cursor-agent](https://docs.cursor.com/agent), systemd, docker/podman, GNOME Shell 45-49.

> **Wayland Note**: After installation, log out and back in for the GNOME Shell extension to activate. On X11, press `Alt+F2` then type `r` to restart the shell.

## Quick Start

```bash
# Schedule a recurring task
cursor-schedule add \
  --name weekly-lint \
  --workspace ~/projects/my-app \
  --schedule "Mon *-*-* 09:00" \
  --prompt "Run linting and fix all auto-fixable issues."

# Schedule a one-shot task
cursor-schedule add \
  --name deploy-prep \
  --workspace ~/projects/api \
  --schedule "2026-03-01 09:00" \
  --prompt "Run all tests and prepare the release changelog."

# List tasks
cursor-schedule list

# View logs for a task
cursor-schedule logs weekly-lint

# Manually trigger a task
cursor-schedule run weekly-lint

# Reconcile task statuses with systemd
cursor-schedule sync
```

Or use the `/schedule-task` slash command in Cursor chat for guided task creation.

## CLI Reference

| Command | Description |
|---|---|
| `add` | Register a new scheduled task (`--name`, `--workspace`, `--prompt`, `--schedule`, `--model`, `--force`) |
| `list` | List all tasks (`--json`, `--status`) |
| `cancel <id>` | Cancel a task and disable its timer |
| `logs <id>` | View task output (`--follow`) |
| `run <id>` | Manually trigger a task |
| `sync` | Reconcile task statuses with systemd |
| `purge` | Remove finished tasks (`--completed`, `--failed`, `--all`) |
| `uninstall` | Remove cursor-schedule from the system (`--purge` for full cleanup) |

### Schedule Expressions

The `--schedule` flag accepts any systemd [OnCalendar](https://www.freedesktop.org/software/systemd/man/systemd.time.html) expression:

| Expression | Meaning |
|---|---|
| `2026-03-01 09:00` | One-shot: March 1, 2026 at 9am |
| `Mon *-*-* 09:00` | Every Monday at 9am |
| `*-*-* 02:00` | Daily at 2am |
| `Mon..Fri *-*-* 18:00` | Weekdays at 6pm |

## GNOME Extension

The top-bar indicator shows a popover panel with:

- **Task list** with color-coded status icons (waiting, running, completed, failed)
- **Log viewer** showing the last output of the selected task
- **Live updates** via file monitoring on `tasks.json`
- Click a task row to view its logs

## Uninstall

```bash
cursor-schedule uninstall         # Remove CLI, extension, slash command
cursor-schedule uninstall --purge # Also remove task data and container image
```

## License

MIT
