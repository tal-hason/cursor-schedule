// gnome-extension/cursor-schedule@thason.github.io/logViewer.js
// @ai-rules:
// 1. [Constraint]: Owns the log/report display area below the task list.
// 2. [Pattern]: GObject-registered St.BoxLayout with Logs/Report tab toggle.
// 3. [Gotcha]: St.Label has no markdown renderer -- report content displays as plain text.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

export const LogViewer = GObject.registerClass(
class LogViewer extends St.BoxLayout {
    _init(store) {
        super._init({vertical: true});
        this._store = store;
        this._selectedId = null;
        this._activeTab = 'logs';
        this._logsText = '';
        this._reportText = '(Report content will appear here)';
        this._build();
    }

    _build() {
        const header = new St.BoxLayout({style_class: 'cs-log-header'});

        this._logsTab = new St.Button({label: 'Logs', style_class: 'cs-tab cs-tab-active'});
        this._reportTab = new St.Button({label: 'Report', style_class: 'cs-tab cs-tab-inactive'});
        this._logsTab.connect('clicked', () => { this._switchTab('logs'); return Clutter.EVENT_STOP; });
        this._reportTab.connect('clicked', () => { this._switchTab('report'); return Clutter.EVENT_STOP; });
        header.add_child(this._logsTab);
        header.add_child(this._reportTab);

        header.add_child(new St.Widget({x_expand: true}));

        this._termBtn = new St.Button({style_class: 'cs-header-btn', child:
            new St.Icon({icon_name: 'utilities-terminal-symbolic', icon_size: 14})});
        this._termBtn.connect('clicked', () => {
            if (this._selectedId) this._store.openTerminal(this._selectedId);
        });
        this._termBtn.visible = false;
        header.add_child(this._termBtn);
        this.add_child(header);

        this._label = new St.Label({style_class: 'cs-log-viewer', text: ''});
        const box = new St.BoxLayout({vertical: true});
        box.add_child(this._label);
        const scroll = new St.ScrollView({style_class: 'cs-log-scroll'});
        scroll.set_child(box);
        this.add_child(scroll);
    }

    _switchTab(tab) {
        this._activeTab = tab;
        if (tab === 'logs') {
            this._logsTab.style_class = 'cs-tab cs-tab-active';
            this._reportTab.style_class = 'cs-tab cs-tab-inactive';
            this._label.set_text(this._logsText || '');
        } else {
            this._logsTab.style_class = 'cs-tab cs-tab-inactive';
            this._reportTab.style_class = 'cs-tab cs-tab-active';
            this._label.set_text(this._reportText);
        }
    }

    get selectedId() { return this._selectedId; }

    async loadLogs(taskId) {
        this._selectedId = taskId;
        this._termBtn.visible = true;
        this._activeTab = 'logs';
        this._logsTab.style_class = 'cs-tab cs-tab-active';
        this._reportTab.style_class = 'cs-tab cs-tab-inactive';
        this._label.set_text('Loading\u2026');
        try {
            const logs = await this._store.fetchLogs(taskId);
            this._logsText = logs || '(no output yet)';
            if (this._selectedId === taskId && this._activeTab === 'logs')
                this._label.set_text(this._logsText);
        } catch (e) {
            this._logsText = `Error: ${e.message}`;
            this._label.set_text(this._logsText);
        }
    }

    setReportText(text) {
        this._reportText = text || '(Report content will appear here)';
        if (this._activeTab === 'report')
            this._label.set_text(this._reportText);
    }
});
