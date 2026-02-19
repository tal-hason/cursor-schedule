// gnome-extension/cursor-schedule@thason.github.io/taskStore.js
// @ai-rules:
// 1. [Constraint]: Sole module that reads tasks.json and calls CLI subprocesses.
// 2. [Pattern]: All subprocess calls are async with try/catch. FileMonitor has 200ms debounce.
// 3. [Gotcha]: os.replace() fires two FileMonitor events -- debounce prevents double-refresh.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const TASKS_PATH = GLib.build_filenamev([
    GLib.get_home_dir(), '.local', 'share', 'cursor-schedule', 'tasks.json',
]);

export class TaskStore {
    constructor(settings) {
        this._settings = settings;
        this._monitor = null;
        this._debounceId = 0;
        this._onChange = null;
    }

    _getBin() {
        const custom = this._settings?.get_string('binary-path');
        if (custom && custom.length > 0)
            return custom;
        const fromPath = GLib.find_program_in_path('cursor-schedule');
        if (fromPath)
            return fromPath;
        const localBin = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'cursor-schedule']);
        if (GLib.file_test(localBin, GLib.FileTest.IS_EXECUTABLE))
            return localBin;
        return 'cursor-schedule';
    }

    _getLogLines() {
        return this._settings?.get_int('log-lines') ?? 50;
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
                [this._getBin(), ...args],
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

    async runTask(taskId) {
        await this.runCli(['run', taskId]);
    }

    async cancelTask(taskId) {
        await this.runCli(['cancel', taskId]);
    }

    async removeTask(taskId) {
        await this.runCli(['remove', taskId]);
    }

    async rerunTask(taskId) {
        await this.runCli(['run', taskId]);
    }

    async rescheduleTask(taskId, schedule) {
        await this.runCli(['reschedule', taskId, '--schedule', schedule]);
    }

    openTerminal(taskId) {
        try {
            const unit = `cursor-task-${taskId}.service`;
            Gio.Subprocess.new(
                ['gnome-terminal', '--', 'journalctl', '--user', '-u', unit, '-f', '--no-pager'],
                Gio.SubprocessFlags.NONE,
            );
        } catch (e) {
            console.error(`[cursor-schedule] terminal error: ${e.message}`);
        }
    }

    async fetchLogs(taskId) {
        const n = this._getLogLines();
        try {
            const proc = Gio.Subprocess.new(
                ['journalctl', '--user', '-u', `cursor-task-${taskId}.service`,
                 '--no-pager', `-n${n}`],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            );
            const [, stdout] = await new Promise((resolve, reject) => {
                proc.communicate_utf8_async(null, null, (src, res) => {
                    try { resolve(src.communicate_utf8_finish(res)); }
                    catch (e) { reject(e); }
                });
            });
            return stdout ?? '';
        } catch (e) {
            console.error(`[cursor-schedule] logs error: ${e.message}`);
            return `Error: ${e.message}`;
        }
    }
}
