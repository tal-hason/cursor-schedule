// gnome-extension/cursor-schedule@thason.github.io/extension.js
// @ai-rules:
// 1. [Constraint]: GNOME 45+ ESM only. No CommonJS or legacy GJS imports.
// 2. [Pattern]: Extension class extends Extension; enable()/disable() are instance methods.
// 3. [Gotcha]: disable() must clean up ALL resources -- FileMonitor, timeouts, widgets.

import St from 'gi://St';
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
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        this._icon = new St.Icon({icon_name: ICONS.idle, style_class: 'system-status-icon'});
        this._badge = new St.Label({style_class: 'cs-badge', text: '', y_align: 2});
        const box = new St.BoxLayout({style_class: 'panel-status-indicators-box'});
        box.add_child(this._icon);
        box.add_child(this._badge);
        this._indicator.add_child(box);

        this._panel = new TaskPanel(this._store);
        this._indicator.menu.box.add_child(this._panel);

        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._panel.refresh().then(() => this._updateIndicator());
        });

        this._store.startMonitor(() => {
            this._updateIndicator();
            if (this._indicator?.menu?.isOpen)
                this._panel.refresh();
        });

        this._updateIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        console.log('[cursor-schedule] extension enabled');
    }

    disable() {
        this._store?.stopMonitor();
        this._store = null;
        this._settings = null;
        this._panel = null;
        this._icon = null;
        this._badge = null;
        this._indicator?.destroy();
        this._indicator = null;
        console.log('[cursor-schedule] extension disabled');
    }

    async _updateIndicator() {
        try {
            const tasks = await this._store.listTasks();
            const running = tasks.filter(t => t.status === 'running').length;
            const failed = tasks.filter(t => t.status === 'failed').length;
            const waiting = tasks.filter(t => t.status === 'waiting').length;
            const active = running + waiting;

            if (failed > 0) {
                this._icon?.set_icon_name(ICONS.failed);
                this._icon?.remove_style_class_name('cs-indicator-running');
                this._icon?.remove_style_class_name('cs-indicator-waiting');
                this._icon?.add_style_class_name('cs-indicator-failed');
            } else if (running > 0) {
                this._icon?.set_icon_name(ICONS.running);
                this._icon?.remove_style_class_name('cs-indicator-failed');
                this._icon?.remove_style_class_name('cs-indicator-waiting');
                this._icon?.add_style_class_name('cs-indicator-running');
            } else if (waiting > 0) {
                this._icon?.set_icon_name(ICONS.waiting);
                this._icon?.remove_style_class_name('cs-indicator-failed');
                this._icon?.remove_style_class_name('cs-indicator-running');
                this._icon?.add_style_class_name('cs-indicator-waiting');
            } else {
                this._icon?.set_icon_name(ICONS.idle);
                this._icon?.remove_style_class_name('cs-indicator-failed');
                this._icon?.remove_style_class_name('cs-indicator-running');
                this._icon?.remove_style_class_name('cs-indicator-waiting');
            }

            this._badge?.set_text(active > 0 ? `${active}` : '');
        } catch (e) {
            console.error(`[cursor-schedule] indicator update: ${e.message}`);
        }
    }
}
