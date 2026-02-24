# src/cursor_schedule/store.py
# @ai-rules:
# 1. [Constraint]: This module is the sole owner of tasks.json. No other module reads/writes it.
# 2. [Pattern]: All reads use LOCK_SH, all writes use LOCK_EX + atomic rename.
# 3. [Gotcha]: Never hold the file lock across subprocess calls.

import fcntl
import json
import os
from datetime import datetime, timezone
from pathlib import Path

STORE_DIR = Path(os.environ.get(
    "CURSOR_SCHEDULE_DATA", Path.home() / ".local/share/cursor-schedule"
))
STORE_FILE = STORE_DIR / "tasks.json"
REPORTS_DIR = STORE_DIR / "reports"
SCHEMA_VERSION = 2
UNIT_PREFIX = "cursor-task-"

_V2_DEFAULTS = {"guardrails": [], "summary_template": None, "report_path": None, "report_status": None}


def _ensure_store():
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    if not STORE_FILE.exists():
        _atomic_write({"version": SCHEMA_VERSION, "tasks": []})


def _atomic_write(data):
    tmp = STORE_FILE.with_suffix(".json.tmp")
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        os.write(fd, json.dumps(data, indent=2).encode() + b"\n")
        os.fsync(fd)
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)
    os.replace(str(tmp), str(STORE_FILE))


def _read_store():
    _ensure_store()
    fd = os.open(str(STORE_FILE), os.O_RDONLY)
    try:
        fcntl.flock(fd, fcntl.LOCK_SH)
        raw = os.read(fd, 1_000_000)
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)
    data = json.loads(raw)
    for task in data.get("tasks", []):
        for key, default in _V2_DEFAULTS.items():
            task.setdefault(key, default)
    return data


def list_tasks(status_filter=None):
    data = _read_store()
    tasks = data.get("tasks", [])
    if status_filter:
        tasks = [t for t in tasks if t["status"] == status_filter]
    return tasks


def add_task(task_id, name, schedule, prompt, workspace, model=None,
             plan_path=None, auto_remove=False, guardrails=None, summary_template=None):
    data = _read_store()
    task = {
        "id": task_id, "name": name, "schedule": schedule, "prompt": prompt,
        "plan_path": plan_path, "workspace": workspace, "model": model,
        "status": "waiting", "auto_remove": auto_remove,
        "guardrails": guardrails or [], "summary_template": summary_template,
        "report_path": None, "report_status": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None, "exit_code": None,
    }
    data["tasks"].append(task)
    _atomic_write(data)
    return task


def get_task(task_id):
    return next((t for t in list_tasks() if t["id"] == task_id), None)


def remove_task(task_id):
    data = _read_store()
    data["tasks"] = [t for t in data["tasks"] if t["id"] != task_id]
    _atomic_write(data)


def update_task(task_id, **fields):
    data = _read_store()
    for task in data["tasks"]:
        if task["id"] == task_id:
            task.update(fields)
            break
    _atomic_write(data)
