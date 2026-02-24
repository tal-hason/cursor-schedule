# src/cursor_schedule/systemd.py
# @ai-rules:
# 1. [Constraint]: Sole owner of systemd unit files. No other module calls systemctl.
# 2. [Pattern]: ExecStart delegates to cursor-schedule _exec; runner.py handles agent invocation.
# 3. [Gotcha]: ExecStartPost may not run on SIGKILL -- sync_from_systemd() handles that.

import shutil
import subprocess
from pathlib import Path

UNIT_DIR = Path.home() / ".config/systemd/user"
UNIT_PREFIX = "cursor-task-"


def _unit_path(task_id, suffix):
    return UNIT_DIR / f"{UNIT_PREFIX}{task_id}{suffix}"


def _daemon_reload():
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True, timeout=10)


def _runtime_path():
    paths = set()
    for name in ("cursor-schedule", "cursor-agent"):
        found = shutil.which(name)
        if found:
            paths.add(str(Path(found).parent))
    paths.update(["/usr/local/bin", "/usr/bin", "/bin"])
    home_local = str(Path.home() / ".local/bin")
    paths.add(home_local)
    return ":".join(paths)


def create_units(task_id, schedule, workspace, prompt, model=None):
    UNIT_DIR.mkdir(parents=True, exist_ok=True)
    cs_bin = shutil.which("cursor-schedule") or "cursor-schedule"

    service = _unit_path(task_id, ".service")
    service.write_text(
        f"[Unit]\n"
        f"Description=Cursor Agent Task: {task_id}\n\n"
        f"[Service]\n"
        f"Type=oneshot\n"
        f"ExecStart={cs_bin} _exec {task_id}\n"
        f"ExecStartPost=/bin/sh -c '"
        f"MSG=$({cs_bin} report {task_id} --one-line 2>/dev/null) || "
        f'MSG="Task {task_id} finished (exit $EXIT_STATUS)"; '
        f'notify-send "cursor-schedule" "$MSG"\'\n'
        f"Environment=HOME={Path.home()}\n"
        f"Environment=PATH={_runtime_path()}\n"
    )

    timer = _unit_path(task_id, ".timer")
    timer.write_text(
        f"[Unit]\n"
        f"Description=Timer for Cursor Agent Task: {task_id}\n\n"
        f"[Timer]\n"
        f"OnCalendar={schedule}\n"
        f"Persistent=true\n\n"
        f"[Install]\n"
        f"WantedBy=timers.target\n"
    )
    _daemon_reload()


def enable_timer(task_id):
    unit = f"{UNIT_PREFIX}{task_id}.timer"
    subprocess.run(
        ["systemctl", "--user", "enable", "--now", unit],
        check=True,
        timeout=10,
    )


def disable_timer(task_id):
    unit = f"{UNIT_PREFIX}{task_id}.timer"
    subprocess.run(
        ["systemctl", "--user", "disable", "--now", unit],
        capture_output=True,
        timeout=10,
    )


def remove_units(task_id):
    disable_timer(task_id)
    for suffix in (".service", ".timer"):
        path = _unit_path(task_id, suffix)
        path.unlink(missing_ok=True)
    _daemon_reload()


def start_service(task_id):
    unit = f"{UNIT_PREFIX}{task_id}.service"
    subprocess.run(
        ["systemctl", "--user", "start", "--no-block", unit],
        check=True,
        timeout=10,
    )
