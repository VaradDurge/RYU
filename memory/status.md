# What works / what doesn’t

Last touch: 2026-07-20 · detail: `UPDATES.md`

## Works

- Dock UI + demo Inject (`npm run dev`)
- Bridge `127.0.0.1:41999` (`/event` `/decision` `/status` `/agents`)
- **Track A contracts** — `npm run verify:track-a` (headless) S1–S8 PASS
- **Track B contracts** — `npm run verify:track-b` S9–S12 + Track A gate PASS
- Headless bridge: `npm run bridge:headless` (+ `/dismiss`, status watchdog)
- Cursor **status rings** (live + `verify:cursor-status`)
- Claude status + permission plumbing (`verify:claude-status`, `verify:claude-resume`)
- Codex permission + status parity (scripted; live still home)
- Island FIFO queue + in-dock **Dismiss**
- Fail-open when RYU down / dismiss → cancelled (scripted)
- Deny path awaits status post → `agents.claude=error` before exit
- **Audit:** `docs/core-loop-failure-analysis.md` identifies pending hydration, decision acknowledgment, hook-ID collision, click-through, and local trust boundary as unresolved P0 risks.
- **Phase 1 remediation (remote):** shared `bridge-core`, snapshot hydration, ack decide/dismiss, pairKey coalescing, token/loopback/body limits, hover-only interaction — `npm run verify:phase1-remediation` PASS
- Home Phase 1 checks still open: `docs/HOME-PHASE1.md`

## Does not / deferred

- Claude **live** Write → Approve → file (home checklist; esp. WSL)
- Cursor Approve on every tool — **intentionally off** (spam)
- Cursor Multitask external approve — unsupported
- Live Codex Resume on user machine — not claimed by scripts
- Mac notch track — `diff/mac/` only; not Windows daily path

## Deliberate product rule

Dock Approve/Deny = **Claude Resume** (and optional Cursor ACP spike). Cursor IDE hooks = **rings only**.
