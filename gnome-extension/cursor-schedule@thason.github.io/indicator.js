// gnome-extension/cursor-schedule@thason.github.io/indicator.js
// @ai-rules:
// 1. [Constraint]: Owns all top-bar visual state: pill, icons, badge, hover popup, log polling.
// 2. [Pattern]: Constructor-injected deps (metadataDir, settings, store). No Main.panel access.
// 3. [Gotcha]: All GLib.timeout_add handles MUST be cleaned in destroy(). Leaked timers crash shell.

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const ICONS = {
    idle: 'appointment-soon-symbolic',
    waiting: 'content-loading-symbolic',
    running: 'media-playback-start-symbolic',
    failed: 'dialog-error-symbolic',
};

export class CursorIndicator {
    constructor(metadataDir, settings, store) {
        this._dir = metadataDir;
        this._settings = settings;
        this._store = store;
        this._runningTaskId = null;
        this._hoverPollId = 0;
        this._hideTimeoutId = 0;
        this._logPopup = null;
    }

    buildPill() {
        const pill = new St.BoxLayout({style_class: 'cs-pill'});
        const logoPath = this._dir.get_child('icons').get_child('cursor-logo-32.png').get_path();
        this._logo = new St.Icon({gicon: Gio.icon_new_for_string(logoPath), style_class: 'cs-logo-icon'});
        pill.add_child(this._logo);

        this._icon = new St.Icon({icon_name: ICONS.idle, style_class: 'cs-status-indicator'});
        pill.add_child(this._icon);

        this._badge = new St.Label({style_class: 'cs-badge', text: ''});
        pill.add_child(this._badge);

        this._termIcon = new St.Icon({
            icon_name: 'utilities-terminal-symbolic', style_class: 'cs-term-icon',
            reactive: true, track_hover: true, visible: false,
        });
        this._termIcon.connect('enter-event', () => this._showLogPopup());
        this._termIcon.connect('leave-event', () => this._scheduleHidePopup());
        pill.add_child(this._termIcon);
        return pill;
    }

    buildLogPopup() {
        const popup = new St.BoxLayout({
            vertical: true, style_class: 'cs-log-popup',
            visible: false, reactive: true, track_hover: true,
        });
        this._popupTitle = new St.Label({style_class: 'cs-log-popup-title', text: 'Running...'});
        popup.add_child(this._popupTitle);
        this._popupLabel = new St.Label({style_class: 'cs-log-popup-text', text: ''});
        const box = new St.BoxLayout({vertical: true});
        box.add_child(this._popupLabel);
        const scroll = new St.ScrollView({style_class: 'cs-log-popup-scroll'});
        scroll.set_child(box);
        popup.add_child(scroll);
        popup.connect('enter-event', () => this._cancelHidePopup());
        popup.connect('leave-event', () => this._scheduleHidePopup());
        this._logPopup = popup;
        return popup;
    }

    async update() {
        try {
            const tasks = await this._store.listTasks();
            const running = tasks.filter(t => t.status === 'running');
            const failed = tasks.filter(t => t.status === 'failed').length;
            const waiting = tasks.filter(t => t.status === 'waiting').length;
            const active = running.length + waiting;

            this._runningTaskId = running.length > 0 ? running[0].id : null;
            if (this._termIcon) this._termIcon.visible = running.length > 0;
            this._setState(
                failed > 0 ? 'failed' : running.length > 0 ? 'running' : waiting > 0 ? 'waiting' : 'idle'
            );
            this._badge?.set_text(active > 0 ? `${active}` : '');
        } catch (e) {
            console.error(`[cursor-schedule] indicator update: ${e.message}`);
        }
    }

    _setState(state) {
        this._icon?.set_icon_name(ICONS[state] ?? ICONS.idle);
        for (const s of ['waiting', 'running', 'failed'])
            this._icon?.remove_style_class_name(`cs-indicator-${s}`);
        if (state !== 'idle')
            this._icon?.add_style_class_name(`cs-indicator-${state}`);
    }

    async _showLogPopup() {
        this._cancelHidePopup();
        if (!this._runningTaskId || !this._logPopup) return;
        const [x, y] = this._termIcon.get_transformed_position();
        this._logPopup.set_position(Math.max(0, x - 150), y + 30);
        this._logPopup.visible = true;
        this._popupTitle.set_text(`Running: ${this._runningTaskId}`);
        await this._refreshLogs();
        this._startPolling();
    }

    _scheduleHidePopup() {
        this._cancelHidePopup();
        const seconds = this._settings?.get_int('popup-timeout') ?? 15;
        this._hideTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, seconds * 1000, () => {
            this._hideTimeoutId = 0;
            if (!this._logPopup?.hover && !this._termIcon?.hover) this.hideLogPopup();
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelHidePopup() {
        if (this._hideTimeoutId) { GLib.source_remove(this._hideTimeoutId); this._hideTimeoutId = 0; }
    }

    hideLogPopup() {
        this._cancelHidePopup();
        this._stopPolling();
        if (this._logPopup) this._logPopup.visible = false;
    }

    _startPolling() {
        this._stopPolling();
        this._hoverPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
            if (this._logPopup?.visible) this._refreshLogs();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopPolling() {
        if (this._hoverPollId) { GLib.source_remove(this._hoverPollId); this._hoverPollId = 0; }
    }

    async _refreshLogs() {
        if (!this._runningTaskId) return;
        try {
            const logs = await this._store.fetchLogs(this._runningTaskId);
            const last20 = (logs || '').trim().split('\n').slice(-20).join('\n');
            this._popupLabel?.set_text(last20 || '(waiting for output...)');
        } catch (e) {
            console.error(`[cursor-schedule] popup logs: ${e.message}`);
        }
    }

    destroy() {
        this._cancelHidePopup();
        this._stopPolling();
        this._logo = null;
        this._icon = null;
        this._badge = null;
        this._termIcon = null;
        this._popupTitle = null;
        this._popupLabel = null;
        this._logPopup = null;
    }
}
