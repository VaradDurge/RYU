# Home live execution plan — Claude (WSL) ↔ RYU (Windows)

**Status:** plan only — execute on the user’s Windows laptop (or a local agent with WSL + Windows shell).  
**Not runnable from Cursor cloud VMs** that lack the user’s Claude, WSL home, and floating dock.  
**Repo path (this machine):** `C:\Users\Sara\Desktop\Buildathons\RYU`  
**Branch:** `cursor/memory-zone-57c5` (pull latest before starting)

## User goal

> Start RYU on Windows, wire Claude-in-WSL hooks correctly, and prove the live loop: Claude needs permission → dock Attention → Approve → Claude continues and the file exists. Then record Phase 1–3 home evidence.

## Architecture constraint (do not violate)

| Process | Where it must run |
| --- | --- |
| `npm run dev` (Electron + bridge `:41999`) | **Windows** |
| `npm run hook:install` | **Windows** |
| Claude Code | **WSL** (OK) |
| Hook runtime | Windows `node.exe` + **Windows path** script args (`C:\...\hooks\*.mjs`) |

Never run RYU’s bridge only inside WSL Linux Node and expect Claude-in-WSL hooks to “just work.”  
Known fix already in repo: `scripts/install-claude-hook-wsl.mjs` must pass `C:\...` args to `node.exe` (see `lessons/2026-07-21-wsl-hook-windows-paths.md`).

## Success contract

| ID | Outcome | Must not happen |
| --- | --- | --- |
| H0 | Branch pulled; hooks reinstalled; RYU bridge listening on Windows `127.0.0.1:41999` | SessionStart `modules/cjs/loader` error; RYU only in WSL |
| H1 | Claude Write → yellow Attention → Approve → `ryu-live-test.txt` exists | Terminal Yes/No only with empty dock |
| H2 | Claude Deny / Dismiss / RYU-down fail-open behave correctly | Silent auto-allow |
| H3 | Claude rings update (green/yellow/blue/stale) like Cursor status path | No ring motion while Claude works |
| H4 | Phase 1 trust home checks recorded | Claiming success from scripts alone |
| H5 | Phase 2 Attention/Understand/stale home checks recorded | Auto-expand treated as OK |
| H6 | Phase 3 ledger rows filled for Claude (+ Cursor rings; Codex category) | Marking adapters live-proven without notes |
| H7 | Optional: only after H0–H6, write P3.7 expansion decision | Starting Questions/batch before evidence |

## Out of scope

- Cloud-agent execution of live Claude
- Questions / batch / Cursor approve-every-tool
- Packaging/signing
- Redesigning the dock

---

## Execution order

### Step 0 — Prep (Windows PowerShell)

```powershell
cd C:\Users\Sara\Desktop\Buildathons\RYU
git status -sb
git pull
git log -1 --oneline
```

**Expect:** latest commit includes WSL Windows-path hook fix (`toWindowsPath` / lesson `2026-07-21`).

Stop leftover RYU/Electron:

```powershell
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force
# also Ctrl+C any old npm run dev terminals
```

---

### Step 1 — Install hooks (Windows)

```powershell
npm install
npm run hook:install
```

**Expect in install output:**
- WSL install reaches `~/.claude/settings.json`
- Permission/status paths look like `C:\Users\Sara\Desktop\Buildathons\RYU\hooks\...`
- **Not** `/mnt/c/.../ryu-claude-status.mjs` as the script arg to Windows node
- Optional: `Status hook loads under Windows node (SessionStart smoke OK)`
- Bridge warning is OK if RYU is not started yet

**Verify in WSL:**

```bash
grep -n "ryu-claude-status\|ryu-hook\|SessionStart\|PermissionRequest" ~/.claude/settings.json | head -40
```

**Pass criteria:** SessionStart command uses `/mnt/c/.../node.exe` (or equivalent) and args use `C:\\...\\ryu-claude-status.mjs`.

---

### Step 2 — Start RYU (Windows only)

```powershell
npm run dev
```

**Expect:**
- `bridge listening on 127.0.0.1:41999`
- Floating dock visible
- Chromium disk-cache errors may appear; ignore if bridge line is present

Keep this terminal open for the whole session.

**Quick health (second Windows shell):**

```powershell
Invoke-RestMethod http://127.0.0.1:41999/health
```

**Expect:** `ok: True` / `bridge: started`.

Confirm token file exists: `%USERPROFILE%\.ryu\token`

---

### Step 3 — Restart Claude (WSL)

1. Fully quit Claude Code.
2. Start Claude again in the RYU folder (or any project).
3. **Expect:** no `SessionStart:startup hook error`.

If SessionStart still errors: stop and capture full error + the SessionStart block from `~/.claude/settings.json` before continuing.

---

### Step 4 — H1 live Claude Allow (primary proof)

In Claude:

> Create a file `ryu-live-test.txt` with the text `hello`

**Expect sequence:**
1. Claude ring → green (working)
2. Claude ring → yellow (approval)
3. Compact Attention (card does **not** auto-open)
4. Click Claude icon → Understand card (agent/session/tool/path/preview)
5. Approve once
6. File exists; Claude continues
7. Ring returns toward green then blue/idle (or stale later if quiet)

**Logs (Windows):**
- `%USERPROFILE%\.ryu\hook.log`
- `%USERPROFILE%\.ryu\claude-hook.log`

**Fail patterns:**
- Only terminal Yes/No → hooks not reaching bridge (paths / install / RYU not on Windows)
- No new hook.log lines → Claude not invoking hooks
- Dock yellow but Approve does nothing → IPC/ack issue (rarer; note revision)

Record result in `docs/HOME-PHASE3.md` Claude Allow row.

---

### Step 5 — H2 Deny / Dismiss / fail-open

Repeat similar Write prompts:

| Action | Expect |
| --- | --- |
| Deny | Red ring; write blocked |
| Dismiss | Card clears; Claude falls back (cancelled, not allow) |
| Quit RYU, then ask Claude to write | Terminal/normal fail-open; no silent allow |

Record in HOME-PHASE3 Claude Deny / fail-open rows.

---

### Step 6 — H3 rings + Cursor (status-only)

- While Claude works/approves: confirm green/yellow/blue/stale behavior.
- In Cursor (this repo): tiny edit after reload → Cursor ring green→blue; **no** Approve spam.

Record Cursor rows in HOME-PHASE3.

---

### Step 7 — H4 Phase 1 home checks

Walk `docs/HOME-PHASE1.md` (snapshot during launch, reload pending, expired Approve not success, click-through, two similar writes, token/WSL fail-open). Tick with notes.

---

### Step 8 — H5 Phase 2 home checks

Walk `docs/HOME-PHASE2.md` (no auto-expand, Understand fields, stale≠idle, double-click integrity). Tick with notes.

---

### Step 9 — H6 Phase 3 ledger + release skim

Fill run metadata + remaining rows in `docs/HOME-PHASE3.md`.  
Skim `docs/RELEASE-CHECKLIST.md` (do not invent live proofs).

Codex: mark `not configured` / `unsupported` unless hooks were installed and tested.

---

### Step 10 — H7 expansion decision (only after evidence)

If H0–H6 are recorded, create `docs/phase3-expansion-decision.md` choosing **one** next direction (Questions, jump-to-session, batch/risk, stronger Codex/Cursor, or reliability follow-up). Do not implement the feature in the same step.

---

## Troubleshooting tree

```text
Claude terminal Yes/No only
 ├─ RYU running on Windows with :41999 health ok?
 │   └─ no → start npm run dev on Windows
 ├─ SessionStart error / loader error?
 │   └─ yes → git pull + npm run hook:install; confirm C:\ hook args
 ├─ hook.log empty?
 │   └─ yes → Claude settings missing hooks / wrong Claude home / Claude not restarted
 └─ hook.log has fail-open / unauthorized?
     └─ token missing or RYU_HOME mismatch → restart RYU on Windows; re-install hooks
```

## Evidence labels

| Label | Use when |
| --- | --- |
| Remote contract | `verify:*` scripts |
| Electron smoke | `verify:phase3-proof` on a machine with Electron |
| Home live proof | This plan’s Claude/Cursor observations |
| Unsupported / not configured | Codex or features not wired |

Never promote Remote/Electron evidence to Home live proof.

---

## Model handoff note

Any **local** coding agent executing this plan must:

1. Run commands on the user’s Windows + WSL environment (not a cloud sandbox without Claude/dock).
2. Keep RYU on Windows; Claude may stay in WSL.
3. After `hook:install`, verify settings use Windows path script args.
4. Drive Claude with the Write prompt; do not claim success from `verify:claude-resume` alone.
5. Update `docs/HOME-PHASE1.md`, `HOME-PHASE2.md`, `HOME-PHASE3.md` with real results.
6. Do not implement Questions/batch/Cursor approve-every-tool.
7. Only write P3.7 after home evidence exists.
8. If fixing installer/path bugs, add a lesson and keep fail-open.

**Suggested local-agent prompt**

> Execute `docs/home-live-execution-plan.md` on this Windows laptop. Pull latest `cursor/memory-zone-57c5`, reinstall Claude hooks from Windows, start `npm run dev` on Windows, restart Claude in WSL, prove Write → dock Approve → file exists, then fill HOME-PHASE1/2/3. Do not run RYU only inside WSL. Do not mark live proof from headless verifies. Report failures with hook.log + settings.json excerpts.

---

## Done means

- [ ] H0–H3 observed live
- [ ] HOME-PHASE1/2/3 updated with results (not blank)
- [ ] Cursor status-only confirmed
- [ ] Codex categorized
- [ ] P3.7 written only if user wants the expansion decision now
