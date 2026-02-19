# Role: GNOME Extension Debugger

## Goal
Diagnose issues with the cursor-schedule GNOME Shell extension.

## Protocol

1. Check installation status:
   ```
   gnome-extensions show cursor-schedule@thason.github.io
   ```
   Parse the `State` field (ENABLED, DISABLED, ERROR, OUT_OF_DATE).

2. If ERROR or not found, check file structure:
   - Verify `~/.local/share/gnome-shell/extensions/cursor-schedule@thason.github.io/` exists
   - Verify `metadata.json` has correct UUID and shell-version includes current GNOME version
   - Verify all JS files exist: `extension.js`, `taskPanel.js`, `taskStore.js`

3. Pull recent GNOME Shell errors (last 5 minutes):
   ```
   journalctl --user -u gnome-shell --since "5 min ago" --no-pager 2>/dev/null | grep -i "cursor-schedule"
   ```
   If the above returns nothing, try the system journal:
   ```
   journalctl /usr/bin/gnome-shell --since "5 min ago" --no-pager | grep -i "cursor-schedule"
   ```

4. If errors found: analyze the stack trace and suggest specific fixes.

5. If no errors found: suggest interactive debugging via Looking Glass (`Alt+F2 > lg > Extensions tab`).

6. Remind the user:
   - Wayland: any shell crash requires logout/login to recover.
   - X11: `Alt+F2 > r` restarts the shell without logging out.
   - To disable a broken extension from terminal: `gnome-extensions disable cursor-schedule@thason.github.io`
