# Pre-Flight Review: Agent Observability and Guardrails (C+A)

**Plan:** `agent_observability_guardrails_94f8befe.plan.md`
**Date:** 2026-02-21 14:00
**Prior context:** [Plan review and evolution](832f67b8-8d6a-47bf-aad1-25b58e411866)

---

## 1. Developer and Technical Summary

| Metric | Value |
|:---|:---|
| **Overall Confidence Score** | **80%** |
| **Status** | **Caution** |
| **Critical Blockers** | 1. cursor-agent rule-loading in headless mode is unconfirmed (guardrails feature depends on it) |
| | 2. Extension Step 6 is Complex domain with no probe step -- GNOME Shell crash risk on Wayland |

**Host Validation:**
- GNOME Shell 49.4 -- confirmed
- `cursor-agent` flags confirmed: `--workspace`, `--trust`, `--print`, `--output-format`, `--approve-mcps`
- systemd user session active
- Python 3, click, fcntl -- available
- All 9 AI shebangs present and valid across Python/JS source files

---

## 2. Task-by-Task Analysis

| Step # | Task Summary | Cynefin Domain | Confidence | Risk / Missing Context |
|:---|:---|:---|:---|:---|
| 1 | Schema v2 -- `store.py` additions | Clear | 92% | `store.py` already at 140 lines; adding ~20 pushes to ~160 (violates <=100 convention). Low functional risk. |
| 2 | Runner module -- `runner.py` (NEW) | Complicated | 78% | **Unknown**: does `cursor-agent --workspace <path>` read `.cursor/rules/` in headless mode? Plan acknowledges this (line 136). Guardrails injection depends entirely on this assumption. |
| 3 | Wire runner into systemd -- `systemd.py` | Clear | 90% | PATH env must now include `cursor-schedule` binary dir, not just cursor-agent. `_agent_path()` naming is misleading if it also serves the runner. Minor. |
| 4 | CLI flags -- `cli.py` + `cli_extra.py` | Clear | 90% | `cli.py` at 134 lines + ~15 = ~149. `cli_extra.py` at 115 + ~25 = ~140. Both well over <=100 limit. Functional risk low -- standard Click patterns. |
| 5 | ExecStartPost notification upgrade | Complicated | 72% | **Underspecified**: Plan says "reads the first line of the report's Outcome section" but doesn't define the mechanism. Shell one-liner parsing markdown is fragile. Recommend: add a `cursor-schedule report <id> --one-line` CLI subcommand and call that from ExecStartPost. |
| 6 | Extension -- Report viewing (taskStore + taskPanel + extension + CSS) | Complex | 65% | **No probe step defined.** taskPanel.js (187 lines) gains ~40 more. New UI pattern ([Logs]/[Report] toggle) is untested in St widgets. St.Label does NOT render markdown -- plan's verification says "structured markdown renders in the log pane" but it will be **plain text**. GNOME Shell crash = Wayland logout. |
| 7 | Slash command -- `schedule-task.md` | Clear | 98% | Trivial text addition. No risk. |

---

## 3. Gap Analysis

### Step 2 -- Runner: cursor-agent rule loading (Confidence: 78%)

- **Ambiguity:** The plan's "Unknowns" section (line 136) states: "cursor-agent behavior with `.cursor/rules/` in headless mode: Confirmed that `cursor-agent --workspace <path>` reads workspace rules. Need to verify `--print --trust` does not skip rule loading." This is flagged but **not resolved**. The entire guardrails feature depends on cursor-agent reading the injected `_cs-<task_id>.mdc` file.
- **Context:** The prompt augmentation approach (appending summary directive to the prompt string) is a safe fallback -- that path does NOT depend on rule loading. The guardrails-as-mdc path does.
- **Safety:** No automated test exists to verify rule loading. Manual test case #1 covers it, but post-hoc.
- **Recommendation:** Run a probe BEFORE implementing the full runner: `cursor-agent --print --trust --workspace /tmp/test-ws "Read the file .cursor/rules/test.mdc and print its contents"` with a pre-placed test rule. If the agent acknowledges the rule, green-light. If not, the guardrails design must change to prompt-only injection.

### Step 5 -- ExecStartPost report parsing (Confidence: 72%)

- **Ambiguity:** "New post-execution command reads the first line of the report's Outcome section and includes it in `notify-send`" -- how? The report is a markdown file at an ISO-timestamped path. The ExecStartPost is a shell one-liner.
- **Context:** systemd ExecStartPost runs AFTER the runner exits. The runner has already written `report_path` to `tasks.json`. So the post-exec script needs to: (1) read tasks.json, (2) extract report_path for this task_id, (3) grep the Outcome line from the report. This is 3 operations in a shell one-liner.
- **Safety:** If any step fails (no report, parse error, malformed markdown), the notification should fall back to the current format ("Task X finished (exit $EXIT_STATUS)").
- **Recommendation:** Add a `cursor-schedule report <task-id> --one-line` subcommand that encapsulates report parsing. ExecStartPost becomes: `notify-send "cursor-schedule" "$(cursor-schedule report <task-id> --one-line 2>/dev/null || echo 'Task <task-id> finished (exit $EXIT_STATUS)')"`.

### Step 6 -- Extension report tab (Confidence: 65%)

- **Ambiguity:** "structured markdown renders in the log pane" (line 283) -- St.Label renders plain text. No markdown support exists in GNOME Shell's St toolkit. The report will display as raw markdown text.
- **Context:** taskPanel.js is already at 187 lines. Adding a toggle tab, report content area, and state management pushes it to ~227 lines. The [Logs]/[Report] toggle is a new interaction pattern with no prior art in this extension.
- **Safety:** GNOME Shell extensions crash the entire shell on unhandled exceptions. On Wayland (Fedora default), recovery requires logout/login. The plan's prior pre-flight (from the transcript) correctly identified this risk for the initial extension build and added a probe step (3a/3b). This new feature gets no such probe.
- **Recommendation:** Either (a) add a probe step: build the toggle UI with static content first, verify no crashes, then wire to live data. Or (b) split taskPanel.js into `taskPanel.js` (list + actions) and `logViewer.js` (logs + reports tab) to isolate the new UI code and keep files under 100 lines.

### Cross-cutting: File size violations

| File | Current Lines | After Plan | Convention |
|:---|:---|:---|:---|
| store.py | 140 | ~160 | <=100 |
| systemd.py | 105 | ~105 | <=100 |
| cli.py | 134 | ~149 | <=100 |
| cli_extra.py | 115 | ~140 | <=100 |
| runner.py (NEW) | 0 | ~90 | <=100 |
| taskPanel.js | 187 | ~227 | <=100 |
| taskStore.js | 157 | ~167 | <=100 |
| extension.js | 205 | ~215 | <=100 |
| stylesheet.css | 297 | ~317 | N/A |

7 of 9 source files exceed the project's <=100 line convention. The plan adds code to all of them without addressing this. `runner.py` is the only new file, and at ~90 lines it's the only one close to compliance.

### Missing from plan

1. **No automated tests** -- manual test cases only (Phase 5). No `tests/` directory exists.
2. **Report directory creation** -- who creates `REPORTS_DIR / task_id/`? Presumably runner.py, but not explicit.
3. **runner.py AI shebang** -- new file needs a shebang per project convention. Not mentioned.
4. **`_agent_path()` naming** -- now serves both runner.py and systemd.py. Name should reflect dual use or be moved to a shared utility.

---

## 4. Path to Green (Remediation)

### Must-fix before execution

- [ ] **Probe Step 2 (guardrails rule loading):** Before implementing runner.py, run a manual experiment: place a `.cursor/rules/test.mdc` in a test workspace, invoke `cursor-agent --print --trust --workspace <path> "What rules are you following from .cursor/rules?"`. If the agent does NOT read the rule, redesign guardrails as prompt-only injection (no .mdc file).

- [ ] **Add probe for Step 6 (extension report tab):** Insert a Step 6a before the full UI build. Build the `[Logs] [Report]` toggle with static placeholder text. Verify GNOME Shell doesn't crash on tab switch. Then wire live data in Step 6b.

- [ ] **Specify ExecStartPost mechanism (Step 5):** Replace the vague "reads the first line" with a concrete implementation. Recommended: `cursor-schedule report <id> --one-line` CLI subcommand with fallback. Update the plan text.

### Should-fix

- [ ] **File splits for compliance:** Consider splitting before adding more code:
  - `store.py` -> `store.py` (CRUD) + `store_sync.py` (sync_from_systemd, report status)
  - `taskPanel.js` -> `taskPanel.js` (list) + `logViewer.js` (logs + reports toggle)
  - `extension.js` -> `extension.js` (lifecycle) + `indicator.js` (pill, badge, icon state logic)

- [ ] **Add runner.py AI shebang to plan** -- document the constraints: sole owner of guardrail file lifecycle, try/finally on all writes.

- [ ] **Clarify report directory creation** -- add explicit `REPORTS_DIR / task_id` mkdir to runner.py Step 2.

- [ ] **Document markdown-as-plain-text** -- update Phase 5 visual check (line 283) to say "plain text markdown displays in the log pane" instead of "structured markdown renders."

### Nice-to-have

- [ ] **Rename `_agent_path()`** to `_runtime_path()` since it now serves cursor-schedule's runner too.
- [ ] **Add `--output-format json`** to the runner's cursor-agent invocation for structured log parsing in future iterations.

---

## 5. Execution Order Recommendation

If proceeding with Caution status:

1. **Probe** -- Validate cursor-agent rule loading (30 min, blocks Step 2)
2. **Step 1** -- Schema v2 in store.py (Clear, safe to start immediately)
3. **Step 2** -- runner.py (gated on probe result)
4. **Step 3** -- Wire systemd (depends on Step 2)
5. **Step 4** -- CLI flags (depends on Steps 1-2)
6. **Step 5** -- ExecStartPost upgrade (depends on Step 4, needs mechanism spec)
7. **Step 6a** -- Extension probe: toggle UI with static content
8. **Step 6b** -- Extension full: wire to live report data
9. **Step 7** -- Slash command update (independent, can run anytime)

Steps 1 and 7 can execute in parallel while the guardrails probe runs.
