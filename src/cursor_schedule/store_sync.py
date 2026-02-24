# src/cursor_schedule/store_sync.py
# @ai-rules:
# 1. [Constraint]: Owns systemd state reconciliation. Imports store.py for data access.
# 2. [Pattern]: Read-reconcile-write cycle with atomic writes.
# 3. [Gotcha]: ExecMainStatus=0 with empty timestamp means the service never ran.

import subprocess

from cursor_schedule.store import UNIT_PREFIX, _read_store, _atomic_write, REPORTS_DIR


def sync_from_systemd():
    data = _read_store()
    changed = False
    for task in data["tasks"]:
        if task["status"] not in ("waiting", "running"):
            continue
        unit = f"{UNIT_PREFIX}{task['id']}.service"
        try:
            result = subprocess.run(
                ["systemctl", "--user", "show", unit,
                 "--property=ActiveState,SubState,ExecMainExitTimestamp,ExecMainStatus"],
                capture_output=True, text=True, timeout=5,
            )
        except (subprocess.TimeoutExpired, FileNotFoundError):
            continue
        props = dict(
            line.split("=", 1) for line in result.stdout.strip().splitlines() if "=" in line
        )
        active = props.get("ActiveState", "")
        exit_code = props.get("ExecMainStatus", "")
        timestamp = props.get("ExecMainExitTimestamp", "")

        has_run = bool(timestamp and timestamp.strip())

        if active == "activating" and task["status"] != "running":
            task["status"] = "running"
            changed = True
        elif active == "inactive" and has_run and exit_code != "0" and task["status"] != "failed":
            task["status"] = "failed"
            task["exit_code"] = int(exit_code)
            task["completed_at"] = timestamp
            changed = True
        elif active == "inactive" and has_run and exit_code == "0" and task["status"] != "completed":
            task["status"] = "completed"
            task["exit_code"] = 0
            task["completed_at"] = timestamp
            changed = True

    auto_rm = [t["id"] for t in data["tasks"]
               if t.get("auto_remove") and t["status"] in ("completed", "failed")]
    if auto_rm:
        data["tasks"] = [t for t in data["tasks"] if t["id"] not in auto_rm]
        changed = True

    if changed:
        _atomic_write(data)
    return changed


def set_report_status(task_id, report_path, status):
    data = _read_store()
    for task in data["tasks"]:
        if task["id"] == task_id:
            task["report_path"] = str(report_path) if report_path else None
            task["report_status"] = status
            break
    _atomic_write(data)
