// gnome-extension/cursor-schedule@thason.github.io/datePicker.js
// @ai-rules:
// 1. [Constraint]: St widgets only. No Gtk imports.
// 2. [Pattern]: Compact calendar grid + hour/minute spinners.
// 3. [Gotcha]: GLib.DateTime months are 1-based, JS Date months are 0-based.

import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const DateTimePicker = GObject.registerClass({
    Signals: {'picked': {param_types: [GObject.TYPE_STRING]}},
}, class DateTimePicker extends St.BoxLayout {
    _init() {
        super._init({vertical: true, style_class: 'cs-picker'});
        const now = GLib.DateTime.new_now_local();
        this._year = now.get_year();
        this._month = now.get_month();
        this._day = now.get_day_of_month();
        this._hour = now.get_hour();
        this._minute = 0;

        this._buildMonthNav();
        this._buildDayHeaders();
        this._dayGrid = new St.BoxLayout({vertical: true, style_class: 'cs-day-grid'});
        this.add_child(this._dayGrid);
        this._buildTimePicker();
        this._buildConfirm();
        this._renderDays();
    }

    _buildMonthNav() {
        const nav = new St.BoxLayout({style_class: 'cs-month-nav'});
        const prev = new St.Button({style_class: 'cs-nav-btn', label: '<'});
        this._monthLabel = new St.Label({x_expand: true, x_align: Clutter.ActorAlign.CENTER, style_class: 'cs-month-label'});
        const next = new St.Button({style_class: 'cs-nav-btn', label: '>'});
        prev.connect('clicked', () => { this._changeMonth(-1); return Clutter.EVENT_STOP; });
        next.connect('clicked', () => { this._changeMonth(1); return Clutter.EVENT_STOP; });
        nav.add_child(prev);
        nav.add_child(this._monthLabel);
        nav.add_child(next);
        this.add_child(nav);
    }

    _buildDayHeaders() {
        const row = new St.BoxLayout({style_class: 'cs-day-header'});
        for (const d of DAYS)
            row.add_child(new St.Label({text: d, style_class: 'cs-day-label', x_expand: true, x_align: Clutter.ActorAlign.CENTER}));
        this.add_child(row);
    }

    _buildTimePicker() {
        const box = new St.BoxLayout({style_class: 'cs-time-picker'});
        box.add_child(new St.Label({text: 'Time:', style_class: 'cs-time-label'}));

        this._hourLabel = new St.Label({text: `${this._hour}`.padStart(2, '0'), style_class: 'cs-time-value'});
        box.add_child(this._spinBtn('-', () => this._adjustTime('hour', -1)));
        box.add_child(this._hourLabel);
        box.add_child(this._spinBtn('+', () => this._adjustTime('hour', 1)));

        box.add_child(new St.Label({text: ':', style_class: 'cs-time-colon'}));

        this._minLabel = new St.Label({text: `${this._minute}`.padStart(2, '0'), style_class: 'cs-time-value'});
        box.add_child(this._spinBtn('-', () => this._adjustTime('min', -10)));
        box.add_child(this._minLabel);
        box.add_child(this._spinBtn('+', () => this._adjustTime('min', 10)));

        this.add_child(box);
    }

    _buildConfirm() {
        const box = new St.BoxLayout({style_class: 'cs-picker-confirm'});
        this._previewLabel = new St.Label({x_expand: true, style_class: 'cs-picker-preview'});
        const okBtn = new St.Button({style_class: 'cs-picker-ok', label: 'Apply'});
        okBtn.connect('clicked', () => {
            this.emit('picked', this._getScheduleString());
            return Clutter.EVENT_STOP;
        });
        box.add_child(this._previewLabel);
        box.add_child(okBtn);
        this.add_child(box);
        this._updatePreview();
    }

    _spinBtn(label, callback) {
        const btn = new St.Button({style_class: 'cs-spin-btn', label});
        btn.connect('clicked', () => { callback(); return Clutter.EVENT_STOP; });
        return btn;
    }

    _changeMonth(delta) {
        this._month += delta;
        if (this._month > 12) { this._month = 1; this._year++; }
        if (this._month < 1) { this._month = 12; this._year--; }
        this._day = Math.min(this._day, this._daysInMonth());
        this._renderDays();
        this._updatePreview();
    }

    _adjustTime(field, delta) {
        if (field === 'hour') {
            this._hour = (this._hour + delta + 24) % 24;
            this._hourLabel.set_text(`${this._hour}`.padStart(2, '0'));
        } else {
            this._minute = (this._minute + delta + 60) % 60;
            this._minLabel.set_text(`${this._minute}`.padStart(2, '0'));
        }
        this._updatePreview();
    }

    _daysInMonth() {
        return new Date(this._year, this._month, 0).getDate();
    }

    _renderDays() {
        this._dayGrid.destroy_all_children();
        this._monthLabel.set_text(`${this._year}-${String(this._month).padStart(2, '0')}`);
        const firstDay = new Date(this._year, this._month - 1, 1).getDay();
        const offset = (firstDay + 6) % 7;
        const total = this._daysInMonth();
        let row = new St.BoxLayout({style_class: 'cs-day-row'});

        for (let i = 0; i < offset; i++)
            row.add_child(new St.Label({text: '', x_expand: true}));

        for (let d = 1; d <= total; d++) {
            const dayNum = d;
            const btn = new St.Button({
                label: `${d}`, style_class: d === this._day ? 'cs-day-btn cs-day-selected' : 'cs-day-btn',
            });
            btn.connect('clicked', () => {
                this._day = dayNum;
                this._renderDays();
                this._updatePreview();
                return Clutter.EVENT_STOP;
            });
            row.add_child(btn);
            if ((offset + d) % 7 === 0) {
                this._dayGrid.add_child(row);
                row = new St.BoxLayout({style_class: 'cs-day-row'});
            }
        }
        const remaining = (offset + total) % 7;
        if (remaining > 0) {
            for (let i = remaining; i < 7; i++)
                row.add_child(new St.Label({text: '', x_expand: true}));
            this._dayGrid.add_child(row);
        }
    }

    _getScheduleString() {
        const m = String(this._month).padStart(2, '0');
        const d = String(this._day).padStart(2, '0');
        const h = String(this._hour).padStart(2, '0');
        const min = String(this._minute).padStart(2, '0');
        return `${this._year}-${m}-${d} ${h}:${min}`;
    }

    _updatePreview() {
        this._previewLabel?.set_text(this._getScheduleString());
    }
});
