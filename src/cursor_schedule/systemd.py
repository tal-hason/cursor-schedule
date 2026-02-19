# src/cursor_schedule/systemd.py
# @ai-rules:
# 1. [Constraint]: This module is the sole owner of systemd unit files. No other module calls systemctl.
# 2. [Pattern]: Always daemon-reload after creating/modifying units.
# 3. [Gotcha]: ExecStartPost may not run on SIGKILL -- sync_from_systemd() in store.py handles that.

import shutil
import subprocess
from pathlib import Path

UNIT_DIR = Path.home() / ".config/systemd/user"
UNIT_PREFIX = "cursor-task-"


def _unit_path(task_id, suffix):
    return UNIT_DIR / f"{UNIT_PREFIX}{task_id}{suffix}"


def _daemon_reload():
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True, timeout=10)


def _build_exec_start(workspace, prompt, model=None):
    agent = shutil.which("cursor-agent")
    if not agent:
        raise FileNotFoundError("cursor-agent not found on PATH")
    parts = [agent, "--print", "--trust", f"--workspace={workspace}"]
    if model:
        parts.append(f"--model={model}")
    parts.append(prompt)
    return " ".join(_quote(p) for p in parts)


def _quote(s):
    if " " in s or '"' in s or "'" in s:
        return f'"{s}"'
    return s


def create_units(task_id, schedule, workspace, prompt, model=None):
    UNIT_DIR.mkdir(parents=True, exist_ok=True)
    exec_start = _build_exec_start(workspace, prompt, model)

    service = _unit_path(task_id, ".service")
    service.write_text(
        f"[Unit]\n"
        f"Description=Cursor Agent Task: {task_id}\n\n"
        f"[Service]\n"
        f"Type=oneshot\n"
        f"ExecStart={exec_start}\n"
        f"ExecStartPost=/bin/sh -c '"
        f"notify-send \"cursor-schedule\" \"Task {task_id} finished (exit $EXIT_STATUS)\"'\n"
        f"Environment=HOME={Path.home()}\n"
        f"Environment=PATH={_agent_path()}\n"
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
        ["systemctl", "--user", "enable", "--now", unit], check=True, timeout=10,
    )


def disable_timer(task_id):
    unit = f"{UNIT_PREFIX}{task_id}.timer"
    subprocess.run(
        ["systemctl", "--user", "disable", "--now", unit],
        capture_output=True, timeout=10,
    )


def remove_units(task_id):
    disable_timer(task_id)
    for suffix in (".service", ".timer"):
        path = _unit_path(task_id, suffix)
        path.unlink(missing_ok=True)
    _daemon_reload()


def start_service(task_id):
    unit = f"{UNIT_PREFIX}{task_id}.service"
    subprocess.run(["systemctl", "--user", "start", unit], check=True, timeout=10)


def _agent_path():
    agent = shutil.which("cursor-agent")
    if agent:
        return str(Path(agent).parent) + ":/usr/bin:/bin"
    return "/usr/local/bin:/usr/bin:/bin"
