// gnome-extension/cursor-schedule@thason.github.io/taskPanel.js
// @ai-rules:
// 1. [Constraint]: St widgets only. No Gtk imports. Delegates log display to LogViewer.
// 2. [Pattern]: Header + scrollable task list with per-row action buttons.
// 3. [Gotcha]: All async calls wrapped in try/catch to prevent shell crash.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import {DateTimePicker} from './datePicker.js';
import {LogViewer} from './logViewer.js';

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
        this._buildHeader();
        this._taskBox = new St.BoxLayout({vertical: true, style_class: 'cs-task-list'});
        const scroll = new St.ScrollView({style_class: 'cs-scroll', y_expand: true});
        scroll.set_child(this._taskBox);
        this.add_child(scroll);
        this._logViewer = new LogViewer(store);
        this.add_child(this._logViewer);
    }

    _buildHeader() {
        const header = new St.BoxLayout({style_class: 'cs-header'});
        header.add_child(new St.Label({text: 'Cursor Schedule', x_expand: true, style_class: 'cs-title'}));
        const syncBtn = new St.Button({style_class: 'cs-header-btn', child:
            new St.Icon({icon_name: 'emblem-synchronizing-symbolic', icon_size: 14})});
        syncBtn.connect('clicked', () => this.refresh().catch(e =>
            console.error(`[cursor-schedule] sync: ${e.message}`)));
        header.add_child(syncBtn);
        this.add_child(header);
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
            for (const t of tasks) this._taskBox.add_child(this._buildRow(t));
        } catch (e) {
            console.error(`[cursor-schedule] refresh error: ${e.message}`);
        }
    }

    _buildRow(task) {
        const row = new St.BoxLayout({style_class: `cs-row cs-status-${task.status}`});
        row.add_child(new St.Icon({
            icon_name: STATUS_ICONS[task.status] ?? 'dialog-question-symbolic',
            style_class: 'cs-status-icon',
        }));
        const labels = new St.BoxLayout({vertical: true, x_expand: true, reactive: true});
        labels.add_child(new St.Label({text: task.name ?? task.id, style_class: 'cs-task-name'}));
        labels.add_child(new St.Label({text: `${task.schedule}  \u00b7  ${task.status}`, style_class: 'cs-task-meta'}));
        labels.connect('button-press-event', () => {
            this._logViewer.loadLogs(task.id).catch(e =>
                console.error(`[cursor-schedule] row click: ${e.message}`));
            return Clutter.EVENT_STOP;
        });
        row.add_child(labels);

        if (task.status === 'waiting') {
            row.add_child(this._actionBtn('media-playback-start-symbolic', 'Run Now', task.id, 'run'));
            row.add_child(this._actionBtn('appointment-new-symbolic', 'Reschedule', task.id, 'reschedule'));
            row.add_child(this._actionBtn('process-stop-symbolic', 'Cancel', task.id, 'cancel'));
        } else if (task.status === 'running') {
            row.add_child(this._actionBtn('process-stop-symbolic', 'Cancel', task.id, 'cancel'));
        } else {
            row.add_child(this._actionBtn('view-refresh-symbolic', 'Rerun', task.id, 'rerun'));
            row.add_child(this._actionBtn('appointment-new-symbolic', 'Reschedule', task.id, 'reschedule'));
            row.add_child(this._actionBtn('edit-delete-symbolic', 'Remove', task.id, 'remove'));
        }
        row.add_child(this._actionBtn('utilities-terminal-symbolic', 'Open Terminal', task.id, 'terminal'));
        return row;
    }

    _actionBtn(iconName, tooltip, taskId, action) {
        const btn = new St.Button({
            style_class: 'cs-action-btn',
            child: new St.Icon({icon_name: iconName, icon_size: 14}),
        });
        btn.set_accessible_name(tooltip);
        btn.connect('clicked', () => {
            this._handleAction(action, taskId).catch(e =>
                console.error(`[cursor-schedule] ${action} error: ${e.message}`));
            return Clutter.EVENT_STOP;
        });
        return btn;
    }

    async _handleAction(action, taskId) {
        if (action === 'run' || action === 'rerun') {
            await this._store.rerunTask(taskId);
        } else if (action === 'cancel') {
            await this._store.cancelTask(taskId);
        } else if (action === 'remove') {
            await this._store.removeTask(taskId);
        } else if (action === 'reschedule') {
            return this._showRescheduleInput(taskId);
        } else if (action === 'terminal') {
            return this._store.openTerminal(taskId);
        }
        await this.refresh();
    }

    _showRescheduleInput(taskId) {
        this._rescheduleBox?.destroy();
        const box = new St.BoxLayout({vertical: true, style_class: 'cs-reschedule-box'});
        const header = new St.BoxLayout({style_class: 'cs-reschedule-header'});
        header.add_child(new St.Label({
            text: `Reschedule: ${taskId}`, x_expand: true, style_class: 'cs-reschedule-label',
        }));
        const cancelBtn = new St.Button({style_class: 'cs-action-btn', child:
            new St.Icon({icon_name: 'window-close-symbolic', icon_size: 14})});
        cancelBtn.connect('clicked', () => {
            this._rescheduleBox?.destroy();
            this._rescheduleBox = null;
            return Clutter.EVENT_STOP;
        });
        header.add_child(cancelBtn);
        box.add_child(header);
        const picker = new DateTimePicker();
        picker.connect('picked', (_src, schedule) => {
            this._store.rescheduleTask(taskId, schedule)
                .then(() => { this._rescheduleBox?.destroy(); this._rescheduleBox = null; return this.refresh(); })
                .catch(e => console.error(`[cursor-schedule] reschedule: ${e.message}`));
        });
        box.add_child(picker);
        this._rescheduleBox = box;
        this.insert_child_below(box, this._taskBox.get_parent());
    }
});
