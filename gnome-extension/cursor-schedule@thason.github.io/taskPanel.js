// gnome-extension/cursor-schedule@thason.github.io/taskPanel.js
// @ai-rules:
// 1. [Constraint]: St widgets only. No Gtk imports.
// 2. [Pattern]: Popover content with task list (top) + log viewer (bottom).
// 3. [Gotcha]: All async calls wrapped in try/catch to prevent shell crash.

import St from 'gi://St';
import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const STATUS_ICONS = {
    waiting: 'content-loading-symbolic',
    running: 'media-playback-start-symbolic',
    completed: 'emblem-ok-symbolic',
    failed: 'dialog-error-symbolic',
    cancelled: 'process-stop-symbolic',
};

export const TaskPanel = GObject.registerClass(
class TaskPanel extends St.BoxLayout {
    _init(store) {
        super._init({vertical: true, style_class: 'cs-panel'});
        this._store = store;
        this._selectedId = null;

        this._taskBox = new St.BoxLayout({vertical: true, style_class: 'cs-task-list'});
        const scroll = new St.ScrollView({style_class: 'cs-scroll', y_expand: true});
        scroll.set_child(this._taskBox);
        this.add_child(scroll);

        this._logLabel = new St.Label({style_class: 'cs-log-viewer', text: ''});
        const logBox = new St.BoxLayout({vertical: true});
        logBox.add_child(this._logLabel);
        const logScroll = new St.ScrollView({style_class: 'cs-log-scroll'});
        logScroll.set_child(logBox);
        this.add_child(logScroll);
    }

    async refresh() {
        try {
            await this._store.syncTasks();
            const tasks = await this._store.listTasks();
            this._taskBox.destroy_all_children();
            if (tasks.length === 0) {
                this._taskBox.add_child(new St.Label({text: 'No tasks', style_class: 'cs-empty'}));
                return;
            }
            for (const t of tasks)
                this._taskBox.add_child(this._buildRow(t));
        } catch (e) {
            console.error(`[cursor-schedule] refresh error: ${e.message}`);
        }
    }

    _buildRow(task) {
        const row = new St.BoxLayout({style_class: `cs-row cs-status-${task.status}`, reactive: true});
        row.add_child(new St.Icon({
            icon_name: STATUS_ICONS[task.status] ?? 'dialog-question-symbolic',
            style_class: 'cs-status-icon',
        }));
        const labels = new St.BoxLayout({vertical: true, x_expand: true});
        labels.add_child(new St.Label({text: task.name ?? task.id, style_class: 'cs-task-name'}));
        labels.add_child(new St.Label({text: `${task.schedule}  ·  ${task.status}`, style_class: 'cs-task-meta'}));
        row.add_child(labels);
        row.connect('button-press-event', () => this._onRowClick(task.id));
        return row;
    }

    async _onRowClick(taskId) {
        this._selectedId = taskId;
        this._logLabel.set_text('Loading logs…');
        try {
            const logs = await this._store.fetchLogs(taskId);
            if (this._selectedId === taskId)
                this._logLabel.set_text(logs || '(no output yet)');
        } catch (e) {
            this._logLabel.set_text(`Error: ${e.message}`);
        }
    }
});
