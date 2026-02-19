// gnome-extension/cursor-schedule@thason.github.io/taskPanel.js
// @ai-rules:
// 1. [Constraint]: St widgets only. No Gtk imports.
// 2. [Pattern]: Header + task list (with action buttons) + log viewer.
// 3. [Gotcha]: All async calls wrapped in try/catch to prevent shell crash.

import St from 'gi://St';
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
        syncBtn.connect('clicked', () => this.refresh());
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
        const row = new St.BoxLayout({style_class: `cs-row cs-status-${task.status}`, reactive: true});
        row.add_child(new St.Icon({
            icon_name: STATUS_ICONS[task.status] ?? 'dialog-question-symbolic',
            style_class: 'cs-status-icon',
        }));
        const labels = new St.BoxLayout({vertical: true, x_expand: true});
        labels.add_child(new St.Label({text: task.name ?? task.id, style_class: 'cs-task-name'}));
        labels.add_child(new St.Label({text: `${task.schedule}  ·  ${task.status}`, style_class: 'cs-task-meta'}));
        row.add_child(labels);
        row.add_child(this._buildActions(task));
        row.connect('button-press-event', () => this._onRowClick(task.id));
        return row;
    }

    _buildActions(task) {
        const box = new St.BoxLayout({style_class: 'cs-actions'});
        if (task.status === 'waiting') {
            box.add_child(this._actionBtn('media-playback-start-symbolic', 'Run', () => this._onRun(task.id)));
            box.add_child(this._actionBtn('process-stop-symbolic', 'Cancel', () => this._onCancel(task.id)));
        } else if (task.status === 'running') {
            box.add_child(this._actionBtn('process-stop-symbolic', 'Cancel', () => this._onCancel(task.id)));
        }
        box.add_child(this._actionBtn('utilities-terminal-symbolic', 'Logs', () => this._store.openTerminal(task.id)));
        return box;
    }

    _actionBtn(iconName, tooltip, callback) {
        const btn = new St.Button({style_class: 'cs-action-btn', child:
            new St.Icon({icon_name: iconName, icon_size: 14})});
        btn.set_accessible_name(tooltip);
        btn.connect('clicked', () => { try { callback(); } catch (e) { console.error(`[cursor-schedule] ${e.message}`); } });
        return btn;
    }

    async _onRun(taskId) {
        try { await this._store.runTask(taskId); this.refresh(); } catch (e) { console.error(`[cursor-schedule] run: ${e.message}`); }
    }

    async _onCancel(taskId) {
        try { await this._store.cancelTask(taskId); this.refresh(); } catch (e) { console.error(`[cursor-schedule] cancel: ${e.message}`); }
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
