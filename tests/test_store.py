# tests/test_store.py
# @ai-rules:
# 1. [Constraint]: Tests store.py CRUD, atomicity, and schema backfill.
# 2. [Pattern]: Uses tmp_store fixture for filesystem isolation.

import json

from cursor_schedule.store import (
    add_task,
    get_task,
    list_tasks,
    remove_task,
    update_task,
)


def test_ensure_store_creates_file(tmp_store):
    tasks = list_tasks()
    assert tasks == []
    assert (tmp_store / "tasks.json").exists()
    data = json.loads((tmp_store / "tasks.json").read_text())
    assert data["version"] == 2


def test_add_and_get_task(tmp_store):
    task = add_task("t1", "t1", "daily", "do stuff", "/tmp")
    assert task["id"] == "t1"
    assert task["status"] == "waiting"
    fetched = get_task("t1")
    assert fetched["prompt"] == "do stuff"


def test_remove_task(tmp_store):
    add_task("t1", "t1", "daily", "do stuff", "/tmp")
    remove_task("t1")
    assert get_task("t1") is None


def test_update_task(tmp_store):
    add_task("t1", "t1", "daily", "do stuff", "/tmp")
    update_task("t1", status="completed", exit_code=0)
    task = get_task("t1")
    assert task["status"] == "completed"
    assert task["exit_code"] == 0


def test_list_with_status_filter(tmp_store):
    add_task("t1", "t1", "daily", "a", "/tmp")
    add_task("t2", "t2", "daily", "b", "/tmp")
    update_task("t1", status="completed")
    assert len(list_tasks("completed")) == 1
    assert len(list_tasks("waiting")) == 1
    assert len(list_tasks("failed")) == 0


def test_schema_v2_defaults(tmp_store):
    store_file = tmp_store / "tasks.json"
    v1_task = {
        "id": "old",
        "name": "old",
        "schedule": "daily",
        "prompt": "hi",
        "workspace": "/tmp",
        "model": None,
        "status": "waiting",
        "auto_remove": False,
        "created_at": "2025-01-01T00:00:00",
        "completed_at": None,
        "exit_code": None,
        "plan_path": None,
    }
    store_file.write_text(json.dumps({"version": 2, "tasks": [v1_task]}))
    task = get_task("old")
    assert task["guardrails"] == []
    assert task["summary_template"] is None
    assert task["report_path"] is None
    assert task["report_status"] is None
