// gnome-extension/cursor-schedule@thason.github.io/taskStore.js
// @ai-rules:
// 1. [Constraint]: Sole module that reads tasks.json and calls CLI subprocesses.
// 2. [Pattern]: All subprocess calls are async with try/catch. FileMonitor has 200ms debounce.
// 3. [Gotcha]: os.replace() fires two FileMonitor events -- debounce prevents double-refresh.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const CURSOR_SCHEDULE_BIN = '/home/thason/.local/bin/cursor-schedule';
const TASKS_PATH = GLib.build_filenamev([
    GLib.get_home_dir(), '.local', 'share', 'cursor-schedule', 'tasks.json',
]);

export class TaskStore {
    constructor() {
        this._monitor = null;
        this._debounceId = 0;
        this._onChange = null;
    }

    startMonitor(callback) {
        this._onChange = callback;
        const file = Gio.File.new_for_path(TASKS_PATH);
        try {
            this._monitor = file.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', () => this._debounce());
        } catch (e) {
            console.error(`[cursor-schedule] monitor error: ${e.message}`);
        }
    }

    stopMonitor() {
        if (this._debounceId) {
            GLib.source_remove(this._debounceId);
            this._debounceId = 0;
        }
        this._monitor?.cancel();
        this._monitor = null;
        this._onChange = null;
    }

    _debounce() {
        if (this._debounceId)
            GLib.source_remove(this._debounceId);
        this._debounceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            this._debounceId = 0;
            this._onChange?.();
            return GLib.SOURCE_REMOVE;
        });
    }

    async runCli(args) {
        try {
            const proc = Gio.Subprocess.new(
                [CURSOR_SCHEDULE_BIN, ...args],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            );
            const [, stdout, stderr] = await new Promise((resolve, reject) => {
                proc.communicate_utf8_async(null, null, (src, res) => {
                    try { resolve(src.communicate_utf8_finish(res)); }
                    catch (e) { reject(e); }
                });
            });
            return {stdout: stdout ?? '', stderr: stderr ?? '', ok: proc.get_successful()};
        } catch (e) {
            console.error(`[cursor-schedule] cli error: ${e.message}`);
            return {stdout: '', stderr: e.message, ok: false};
        }
    }

    async listTasks() {
        const {stdout, ok} = await this.runCli(['list', '--json']);
        if (!ok || !stdout.trim())
            return [];
        try {
            return JSON.parse(stdout).tasks ?? [];
        } catch (e) {
            console.error(`[cursor-schedule] parse error: ${e.message}`);
            return [];
        }
    }

    async syncTasks() {
        await this.runCli(['sync']);
    }

    async fetchLogs(taskId) {
        const {stdout} = await this.runCli([
            'logs', taskId,
        ]);
        return stdout;
    }
}
