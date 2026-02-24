// gnome-extension/cursor-schedule@thason.github.io/extension.js
// @ai-rules:
// 1. [Constraint]: GNOME 45+ ESM only. Lifecycle orchestrator -- no visual logic here.
// 2. [Pattern]: Extension class with enable()/disable() that wires components together.
// 3. [Gotcha]: disable() must clean up ALL resources -- indicator, store, panel, chrome.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {TaskStore} from './taskStore.js';
import {TaskPanel} from './taskPanel.js';
import {CursorIndicator} from './indicator.js';

export default class CursorScheduleExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._store = new TaskStore(this._settings);

        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        this._ci = new CursorIndicator(this.metadata.dir, this._settings, this._store);

        this._indicator.add_child(this._ci.buildPill());
        this._logPopup = this._ci.buildLogPopup();
        Main.layoutManager.addTopChrome(this._logPopup);

        this._panel = new TaskPanel(this._store);
        this._indicator.menu.box.add_child(this._panel);
        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open) this._panel.refresh().then(() => this._ci.update());
        });

        this._store.startMonitor(() => {
            this._ci.update();
            if (this._indicator?.menu?.isOpen) this._panel.refresh();
        });

        this._ci.update();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        console.log('[cursor-schedule] extension enabled');
    }

    disable() {
        this._ci?.hideLogPopup();
        this._store?.stopMonitor();
        if (this._logPopup) {
            Main.layoutManager.removeChrome(this._logPopup);
            this._logPopup.destroy();
            this._logPopup = null;
        }
        this._ci?.destroy();
        this._ci = null;
        this._store = null;
        this._settings = null;
        this._panel = null;
        this._indicator?.destroy();
        this._indicator = null;
        console.log('[cursor-schedule] extension disabled');
    }
}
