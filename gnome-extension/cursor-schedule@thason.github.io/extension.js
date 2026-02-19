// gnome-extension/cursor-schedule@thason.github.io/extension.js
// @ai-rules:
// 1. [Constraint]: GNOME 45+ ESM only. No CommonJS or legacy GJS imports.
// 2. [Pattern]: Extension class extends Extension; enable()/disable() are instance methods.
// 3. [Gotcha]: disable() must clean up ALL resources -- FileMonitor, timeouts, widgets.

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {TaskStore} from './taskStore.js';
import {TaskPanel} from './taskPanel.js';

const ICONS = {
    idle: 'appointment-soon-symbolic',
    waiting: 'content-loading-symbolic',
    running: 'media-playback-start-symbolic',
    failed: 'dialog-error-symbolic',
};

export default class CursorScheduleExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._store = new TaskStore(this._settings);
        this._runningTaskId = null;
        this._hoverPollId = 0;

        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        const pill = new St.BoxLayout({style_class: 'cs-pill'});

        const logoPath = this.metadata.dir.get_child('icons').get_child('cursor-logo-32.png').get_path();
        const logoGicon = Gio.icon_new_for_string(logoPath);
        this._logo = new St.Icon({gicon: logoGicon, style_class: 'cs-logo-icon'});
        pill.add_child(this._logo);

        this._icon = new St.Icon({icon_name: ICONS.idle, style_class: 'cs-status-indicator'});
        pill.add_child(this._icon);

        this._badge = new St.Label({style_class: 'cs-badge', text: ''});
        pill.add_child(this._badge);

        this._termIcon = new St.Icon({
            icon_name: 'utilities-terminal-symbolic',
            style_class: 'cs-term-icon',
            reactive: true, track_hover: true, visible: false,
        });
        this._termIcon.connect('enter-event', () => this._showLogPopup());
        this._termIcon.connect('leave-event', () => this._scheduleHidePopup());
        pill.add_child(this._termIcon);

        this._indicator.add_child(pill);

        this._logPopup = this._buildLogPopup();
        Main.layoutManager.addTopChrome(this._logPopup);

        this._panel = new TaskPanel(this._store);
        this._indicator.menu.box.add_child(this._panel);
        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open) this._panel.refresh().then(() => this._updateIndicator());
        });

        this._store.startMonitor(() => {
            this._updateIndicator();
            if (this._indicator?.menu?.isOpen) this._panel.refresh();
        });

        this._updateIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        console.log('[cursor-schedule] extension enabled');
    }

    disable() {
        this._hideLogPopup();
        this._store?.stopMonitor();
        if (this._logPopup) {
            Main.layoutManager.removeChrome(this._logPopup);
            this._logPopup.destroy();
        }
        this._store = null;
        this._settings = null;
        this._panel = null;
        this._logo = null;
        this._icon = null;
        this._badge = null;
        this._termIcon = null;
        this._logPopup = null;
        this._indicator?.destroy();
        this._indicator = null;
        console.log('[cursor-schedule] extension disabled');
    }

    _buildLogPopup() {
        const popup = new St.BoxLayout({
            vertical: true, style_class: 'cs-log-popup',
            visible: false, reactive: true, track_hover: true,
        });
        this._logPopupTitle = new St.Label({style_class: 'cs-log-popup-title', text: 'Running...'});
        popup.add_child(this._logPopupTitle);
        this._logPopupLabel = new St.Label({style_class: 'cs-log-popup-text', text: ''});
        const scrollBox = new St.BoxLayout({vertical: true});
        scrollBox.add_child(this._logPopupLabel);
        const scroll = new St.ScrollView({style_class: 'cs-log-popup-scroll'});
        scroll.set_child(scrollBox);
        popup.add_child(scroll);
        popup.connect('enter-event', () => this._cancelHidePopup());
        popup.connect('leave-event', () => this._scheduleHidePopup());
        return popup;
    }

    async _showLogPopup() {
        this._cancelHidePopup();
        if (!this._runningTaskId || !this._logPopup) return;

        const [x, y] = this._termIcon.get_transformed_position();
        this._logPopup.set_position(Math.max(0, x - 150), y + 30);
        this._logPopup.visible = true;
        this._logPopupTitle.set_text(`Running: ${this._runningTaskId}`);
        await this._refreshPopupLogs();
        this._startLogPolling();
    }

    _scheduleHidePopup() {
        this._cancelHidePopup();
        const seconds = this._settings?.get_int('popup-timeout') ?? 15;
        this._hideTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, seconds * 1000, () => {
            this._hideTimeoutId = 0;
            if (!this._logPopup?.hover && !this._termIcon?.hover)
                this._hideLogPopup();
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelHidePopup() {
        if (this._hideTimeoutId) {
            GLib.source_remove(this._hideTimeoutId);
            this._hideTimeoutId = 0;
        }
    }

    _hideLogPopup() {
        this._cancelHidePopup();
        this._stopLogPolling();
        if (this._logPopup) this._logPopup.visible = false;
    }

    _startLogPolling() {
        this._stopLogPolling();
        this._hoverPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            if (this._logPopup?.visible)
                this._refreshPopupLogs();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopLogPolling() {
        if (this._hoverPollId) {
            GLib.source_remove(this._hoverPollId);
            this._hoverPollId = 0;
        }
    }

    async _refreshPopupLogs() {
        if (!this._runningTaskId) return;
        try {
            const logs = await this._store.fetchLogs(this._runningTaskId);
            const lines = (logs || '').trim().split('\n');
            const last20 = lines.slice(-20).join('\n');
            this._logPopupLabel?.set_text(last20 || '(waiting for output...)');
        } catch (e) {
            console.error(`[cursor-schedule] popup logs: ${e.message}`);
        }
    }

    async _updateIndicator() {
        try {
            const tasks = await this._store.listTasks();
            const running = tasks.filter(t => t.status === 'running');
            const failed = tasks.filter(t => t.status === 'failed').length;
            const waiting = tasks.filter(t => t.status === 'waiting').length;
            const active = running.length + waiting;

            this._runningTaskId = running.length > 0 ? running[0].id : null;
            if (this._termIcon) this._termIcon.visible = running.length > 0;

            this._setIndicatorState(
                failed > 0 ? 'failed' : running.length > 0 ? 'running' : waiting > 0 ? 'waiting' : 'idle'
            );
            this._badge?.set_text(active > 0 ? `${active}` : '');
        } catch (e) {
            console.error(`[cursor-schedule] indicator update: ${e.message}`);
        }
    }

    _setIndicatorState(state) {
        this._icon?.set_icon_name(ICONS[state] ?? ICONS.idle);
        for (const s of ['waiting', 'running', 'failed'])
            this._icon?.remove_style_class_name(`cs-indicator-${s}`);
        if (state !== 'idle')
            this._icon?.add_style_class_name(`cs-indicator-${state}`);
    }
}
