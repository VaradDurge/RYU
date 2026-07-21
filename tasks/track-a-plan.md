# Track A plan — harden verify contracts (S1–S8)

**Status:** implemented — `npm run verify:track-a` S1–S8 PASS (2026-07-20)  
**Out of scope:** S9–S12 (Track B), H1–H3 (home-only live)

## Goal

Make Phase 0–1 **bridge + hook contracts** measurable: each success case has a named assert, expected output, and a single command that fails loudly if broken. No live Claude/Cursor required.

## Success cases (locked for Track A)

| ID | Case | Expected |
| --- | --- | --- |
| S1 | Bridge Attention | Event on `GET /pending` (correct `agent`) after `POST /event` or hook register |
| S2 | Decide Allow | Hook stdout = Claude allow shape (`PermissionRequest.decision.behavior=allow` and/or PreToolUse `permissionDecision=allow`) |
| S3 | Decide Deny | Deny stdout correct; optional status → error/red if we already set it |
| S4 | Fail-open | Bad/missing bridge → exit 0, **empty** stdout (no silent allow) |
| S5 | Status rings contract | `POST /status` + `GET /agents`: running / idle / approval / error as asserted |
| S6 | Cursor status hook | `ryu-cursor-status.mjs` argv+stdin → running then idle; **no** permission-gate path |
| S7 | Claude status + resume | `verify:claude-status` + `verify:claude-resume` green |
| S8 | No regressions | All Track A verifies green in one run; memory/tasks updated |

**Not success:** H1–H3 live laptop paths. Scripts may print home checklist; must not mark them done.

## Current coverage (gap analysis)

| ID | Today | Gap |
| --- | --- | --- |
| S1 | `verify-phase1` roundtrip; resume waitPending | Weak: no shared named case labels; pending agent assert inconsistent across scripts |
| S2 | `verify-claude-resume` allow + dual waiter | OK — needs stable case IDs in output |
| S3 | resume deny; phase1 hook deny | Missing: assert status `error` after deny (if product sets it) |
| S4 | resume + phase1 fail-open | OK — unify expected: exit 0 + empty stdout |
| S5 | cursor: running/idle; claude: running/approval/idle | Missing: **error** status for both; cursor **approval** via POST |
| S6 | `verify-cursor-status` | OK — assert Cursor permission hook stays off / not invoked |
| S7 | two separate npm scripts | Need one orchestrator + clearer logs |
| S8 | manual | Add `verify:track-a` that runs the suite |

**Blocker for cloud exec:** all verifies require `npm run dev` (Electron). Plan includes a **headless bridge harness** so Track A can run without a display (xvfb or pure Node bridge entry).

## Execution steps

1. **Plan lock** — this file; tick in `tasks/to-do.md` when user says go.
2. **Headless bridge runner** — small script (or export) that starts `RyuBridge` (or equivalent HTTP surface) on `127.0.0.1:41999` without BrowserWindow IPC. Enough for `/health` `/event` `/decision` `/pending` `/status` `/agents`.
3. **Named case helper** — shared tiny assert util: `case(id, label, fn)` prints `[S#] PASS|FAIL` and aggregates.
4. **Harden scripts (minimal diffs)**  
   - Tag existing checks with S1–S7 IDs.  
   - Fill S5 gaps: `error` (+ cursor `approval` via POST).  
   - S3: after deny, assert agents status if bridge sets it; if not set today, document “N/A” and only assert stdout (no fake product change unless trivial).  
   - S6: confirm `.cursor/hooks.json` wires status-only (read/assert config or skip permission hook file).
5. **Add `npm run verify:track-a`** — start headless bridge → run cursor-status, claude-status, claude-resume, phase1 (or merged) → exit non-zero on any fail → tear down bridge.
6. **Run + iterate** until green in this environment.
7. **Docs/memory** — update `memory/status.md`, `tasks/to-do.md`, one lesson if anything surprising; keep home checklist explicit.
8. **Commit / PR** on feature branch.

## Done when

- `npm run verify:track-a` exits 0 without Electron UI / without human agent sessions.
- Log shows `[S1]…[S8]` (or S1–S7 + suite = S8) all PASS.
- Home-only items remain unchecked in `tasks/to-do.md`.

## Explicit non-goals

- Queue, Codex parity, stale dismiss, ring watchdog (Track B).
- Live WSL/Windows Claude or Cursor proof.
- Re-enabling Cursor approve-every-tool.
