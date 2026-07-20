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
| 5 | `references/index.md` | Pointers into long docs/code |

Catch-up narrative (human): `UPDATES.md`. Long product plan: `docs/product-and-feature-loops.md`.

## Agent protocol

1. **Plan default** — update `tasks/to-do.md` before implementing. No skip.
2. **Before code** — skim memory + relevant lessons.
3. **During / after** — if a product/feature loop changes, or something works / fails / goes amiss → update `memory/*` and add `lessons/YYYY-MM-DD-slug.md` + row in `lessons/index.md`.
4. **Keep memory cheap** — bullets and links only; never paste whole docs into memory.
5. **Home-only items** stay marked home-only (live Claude/Cursor). Do not claim them done from scripts alone.

## Hard product rules

- Cursor IDE hooks → **status rings only**. Do **not** re-enable approve-every-tool (see lessons).
- Dock Approve/Deny → **Claude Resume** (optional Cursor ACP spike only).
- Fail-open: bridge down → agent’s normal prompt; never silent auto-allow.
- v1 = permissions only, single pending item. Questions / queue / batch / mobile = later phases (see `memory/product-loops.md`).
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
npm run dev                    # needs display/Electron where available
npm run verify:cursor-status
npm run verify:claude-status
npm run verify:claude-resume   # needs bridge up
npm run verify:phase1
```

Live Claude/Cursor Resume = human laptop checklist in `docs/RESUME.md` / `tasks/to-do.md` (home-only).

## Done means

- Code change + verifies green when applicable
- `tasks/to-do.md` updated
- Memory/lessons updated if status or a lesson changed
