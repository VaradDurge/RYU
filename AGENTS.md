# AGENTS.md — how to work in RYU

Coding agents: read this, then `memory/index.md`. Prefer memory over re-scanning the repo.

## Product in one line

Floating dock for AI coding-agent **attention + permissions**. Spine: **Idle → Attention → Understand → Decide → Resume**.

## Always start here

| Order | File | Why |
| --- | --- | --- |
| 1 | `memory/index.md` | Router + update protocol |
| 2 | `tasks/to-do.md` | Plan first (default). Log work here before coding |
| 3 | `memory/status.md` + `memory/product-loops.md` | What works / which loops |
| 4 | `lessons/index.md` | Past failures — do not repeat |
| 5 | `references/index.md` | External research (web/API/UX/competitors) |

Catch-up narrative (human): `UPDATES.md`. Long product plan: `docs/product-and-feature-loops.md`.

## Agent protocol

1. **Plan default** — update `tasks/to-do.md` before implementing. No skip.
2. **Before code** — skim memory + relevant lessons.
3. **During / after** — if a product/feature loop changes, or something works / fails / goes amiss → update `memory/*` and add `lessons/YYYY-MM-DD-slug.md` + row in `lessons/index.md`.
4. **External research** — useful web/API findings go in `references/` (short note + index row), not in memory essays.
5. **Keep memory cheap** — bullets and links only; never paste whole docs into memory.
6. **Home-only items** stay marked home-only (live Claude/Cursor). Do not claim them done from scripts alone.

## Hard product rules

- Cursor IDE hooks → **status rings only**. Do **not** re-enable approve-every-tool (see lessons).
- Dock Approve/Deny → **Claude Resume** (optional Cursor ACP spike only).
- Fail-open: bridge down or dismiss → agent’s normal prompt; never silent auto-allow. Dismiss = `cancelled`, not allow.
- Bridge is authenticated (`~/.ryu/token`, `x-ryu-token`); hooks must stay loopback-only.
- Permissions-first. Queue + dismiss shipped (Track B); Phase 1 trust remediation shipped (remote). Questions / batch / mobile = later.
- UI source of truth: `docs/parallel-work-split.md` §6 · live code `src/island/*`, `src/theme.ts`. Do not redesign the island before implementing ahead.
- Mac notch chrome lives under `diff/mac/`; Windows dock is the daily path.

## How to code

- Stack: Electron + React + TypeScript + Vite (electron-vite) + Framer Motion.
- Bridge: `electron/bridge.ts` on `127.0.0.1:41999`. Hooks talk here, not the internet.
- Shared event shapes: `shared/types.ts`.
- Claude permission: `hooks/ryu-hook.mjs`. Claude status: `hooks/ryu-claude-status.mjs`. Cursor status: `hooks/ryu-cursor-status.mjs`.
- Prefer extending existing `scripts/verify-*.mjs` over one-off manual checks.
- Match existing style; minimal diffs; no drive-by refactors.
- Do not commit secrets. Do not edit unrelated markdown.

## Verify (remote-safe)

```bash
npm install
npm run verify:track-a         # S1–S8 headless
npm run verify:track-b         # S9–S12 + Track A gate
npm run verify:phase1-remediation  # P1.1–P1.5 trust/recovery
npm run verify:phase2-surface      # P2.1–P2.6 surface + Phase1/Track B gates
npm run verify:phase3-proof        # P3.1–P3.6 Electron proof gate (preferred when Electron/display available)
npm run verify:phase3-remote       # Phase 3 remote contracts only (not full Phase 3)
npm run bridge:headless        # bridge only, no Electron
npm run dev                    # needs display/Electron where available
npm run verify:cursor-status   # needs bridge up
npm run verify:claude-status
npm run verify:claude-resume
npm run verify:phase1
```

Live Claude/Cursor Resume = human laptop checklist in `docs/RESUME.md` / `tasks/to-do.md` (home-only).  
Phase 2 home UX: `docs/HOME-PHASE2.md`. Phase 3 live ledger: `docs/HOME-PHASE3.md`.  
**Home live runbook:** `docs/home-live-execution-plan.md` (WSL Claude ↔ Windows RYU).

## Done means

- Code change + verifies green when applicable
- `tasks/to-do.md` updated
- Memory/lessons updated if status or a lesson changed
