// gnome-extension/cursor-schedule@thason.github.io/taskPanel.js
// @ai-rules:
// 1. [Constraint]: St widgets only. No Gtk imports.
// 2. [Pattern]: Header + task list (with action buttons) + log viewer.
// 3. [Gotcha]: All async calls wrapped in try/catch to prevent shell crash.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

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

        this._buildHeader();
        this._taskBox = new St.BoxLayout({vertical: true, style_class: 'cs-task-list'});
        const scroll = new St.ScrollView({style_class: 'cs-scroll', y_expand: true});
        scroll.set_child(this._taskBox);
        this.add_child(scroll);
        this._buildLogArea();
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

    _buildLogArea() {
        const logHeader = new St.BoxLayout({style_class: 'cs-log-header'});
        this._logTitle = new St.Label({text: 'Logs', x_expand: true, style_class: 'cs-log-title'});
        logHeader.add_child(this._logTitle);
        this._termBtn = new St.Button({style_class: 'cs-header-btn', child:
            new St.Icon({icon_name: 'utilities-terminal-symbolic', icon_size: 14})});
        this._termBtn.connect('clicked', () => {
            if (this._selectedId) this._store.openTerminal(this._selectedId);
        });
        this._termBtn.visible = false;
        logHeader.add_child(this._termBtn);
        this.add_child(logHeader);

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
        const row = new St.BoxLayout({style_class: `cs-row cs-status-${task.status}`});
        row.add_child(new St.Icon({
            icon_name: STATUS_ICONS[task.status] ?? 'dialog-question-symbolic',
            style_class: 'cs-status-icon',
        }));

        const labels = new St.BoxLayout({vertical: true, x_expand: true, reactive: true});
        labels.add_child(new St.Label({text: task.name ?? task.id, style_class: 'cs-task-name'}));
        labels.add_child(new St.Label({text: `${task.schedule}  ·  ${task.status}`, style_class: 'cs-task-meta'}));
        labels.connect('button-press-event', () => {
            this._onRowClick(task.id).catch(e =>
                console.error(`[cursor-schedule] row click: ${e.message}`));
            return Clutter.EVENT_STOP;
        });
        row.add_child(labels);

        if (task.status === 'waiting') {
            row.add_child(this._actionBtn('media-playback-start-symbolic', 'Run Now', task.id, 'run'));
            row.add_child(this._actionBtn('process-stop-symbolic', 'Cancel', task.id, 'cancel'));
        } else if (task.status === 'running') {
            row.add_child(this._actionBtn('process-stop-symbolic', 'Cancel', task.id, 'cancel'));
        } else {
            row.add_child(this._actionBtn('view-refresh-symbolic', 'Rerun', task.id, 'rerun'));
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
            console.log(`[cursor-schedule] action: ${action} ${taskId}`);
            this._handleAction(action, taskId).catch(e =>
                console.error(`[cursor-schedule] ${action} error: ${e.message}`));
            return Clutter.EVENT_STOP;
        });
        return btn;
    }

    async _handleAction(action, taskId) {
        if (action === 'run' || action === 'rerun') {
            await this._store.rerunTask(taskId);
            await this.refresh();
        } else if (action === 'cancel') {
            await this._store.cancelTask(taskId);
            await this.refresh();
        } else if (action === 'remove') {
            await this._store.removeTask(taskId);
            await this.refresh();
        } else if (action === 'terminal') {
            this._store.openTerminal(taskId);
        }
    }

    async _onRowClick(taskId) {
        this._selectedId = taskId;
        this._logTitle.set_text(`Logs: ${taskId}`);
        this._termBtn.visible = true;
        this._logLabel.set_text('Loading…');
        try {
            const logs = await this._store.fetchLogs(taskId);
            if (this._selectedId === taskId)
                this._logLabel.set_text(logs || '(no output yet)');
        } catch (e) {
            this._logLabel.set_text(`Error: ${e.message}`);
        }
    }
});
