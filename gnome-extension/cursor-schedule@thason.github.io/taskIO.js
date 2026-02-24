// gnome-extension/cursor-schedule@thason.github.io/taskIO.js
// @ai-rules:
// 1. [Constraint]: Owns all task-specific CLI interactions and log fetching.
// 2. [Pattern]: Receives runCli callback via constructor injection to avoid circular deps.
// 3. [Gotcha]: openTerminal uses fire-and-forget Gio.Subprocess -- no await, no stdout.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class TaskIO {
    constructor(runCli, getLogLines) {
        this._runCli = runCli;
        this._getLogLines = getLogLines;
    }

    async runTask(taskId) { await this._runCli(['run', taskId]); }
    async cancelTask(taskId) { await this._runCli(['cancel', taskId]); }
    async removeTask(taskId) { await this._runCli(['remove', taskId]); }
    async rerunTask(taskId) { await this._runCli(['run', taskId]); }

    async rescheduleTask(taskId, schedule) {
        await this._runCli(['reschedule', taskId, '--schedule', schedule]);
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
