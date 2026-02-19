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

export default class CursorScheduleExtension extends Extension {
    enable() {
        this._store = new TaskStore();
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        const icon = new St.Icon({
            icon_name: 'appointment-soon-symbolic',
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(icon);

        this._panel = new TaskPanel(this._store);
        this._indicator.menu.box.add_child(this._panel);

        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._panel.refresh();
        });

        this._store.startMonitor(() => {
            if (this._indicator?.menu?.isOpen)
                this._panel.refresh();
        });

        Main.panel.addToStatusArea(this.uuid, this._indicator);
        console.log('[cursor-schedule] extension enabled');
    }

    disable() {
        this._store?.stopMonitor();
        this._store = null;
        this._panel = null;
        this._indicator?.destroy();
        this._indicator = null;
        console.log('[cursor-schedule] extension disabled');
    }
}
