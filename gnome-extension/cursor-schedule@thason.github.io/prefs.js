// gnome-extension/cursor-schedule@thason.github.io/prefs.js
// @ai-rules:
// 1. [Constraint]: GNOME 45+ ESM prefs. Uses Adw widgets, NOT St widgets.
// 2. [Pattern]: ExtensionPreferences subclass with getPreferencesWidget().
// 3. [Gotcha]: prefs.js runs in a separate process, not inside gnome-shell.

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class CursorSchedulePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'General', icon_name: 'preferences-system-symbolic'});

        const cliGroup = new Adw.PreferencesGroup({
            title: 'CLI Configuration',
            description: 'Path to the cursor-schedule binary',
        });

        const pathRow = new Adw.EntryRow({
            title: 'Binary Path',
            text: settings.get_string('binary-path'),
            show_apply_button: true,
        });
        pathRow.connect('apply', () => {
            settings.set_string('binary-path', pathRow.get_text());
        });
        cliGroup.add(pathRow);
        page.add(cliGroup);

        const uiGroup = new Adw.PreferencesGroup({
            title: 'Display',
            description: 'Popover log viewer settings',
        });

        const logAdj = new Gtk.Adjustment({lower: 10, upper: 500, step_increment: 10, value: settings.get_int('log-lines')});
        const logRow = new Adw.SpinRow({
            title: 'Log Lines',
            subtitle: 'Number of journal lines to show in the popover',
            adjustment: logAdj,
        });
        settings.bind('log-lines', logAdj, 'value', Gio.SettingsBindFlags.DEFAULT);
        uiGroup.add(logRow);

        const timeoutAdj = new Gtk.Adjustment({lower: 1, upper: 60, step_increment: 1, value: settings.get_int('popup-timeout')});
        const timeoutRow = new Adw.SpinRow({
            title: 'Popup Timeout',
            subtitle: 'Seconds the hover log popup stays visible after cursor leaves',
            adjustment: timeoutAdj,
        });
        settings.bind('popup-timeout', timeoutAdj, 'value', Gio.SettingsBindFlags.DEFAULT);
        uiGroup.add(timeoutRow);
        page.add(uiGroup);

        window.add(page);
    }
}
