# RYU

Dynamic Island–style desktop notch for AI coding agent **permission** approvals.  
Windows-first · Electron + React + Framer Motion · Claude Code first.

## Quick start (Phase 0 UX demo)

```bash
npm install
npm run dev
```

A floating pill appears at the **top-center** of your screen.

**Demo harness** (bottom-left, dev only):

1. **Inject permission** — Attention state (icon + glow). Click the island to expand → Allow / Deny.
2. **Inject scary rm** — Destructive-styled permission.
3. **Run pitch timeline** — Scripted events for a short demo.

Desktop stays click-through except when hovering the island (or harness).

## Agent monitoring (Cursor + Claude)

Keep RYU running (`npm run dev`). Dock rings:

| Color | Meaning |
| --- | --- |
| Blue | Idle / finished |
| Green | Agent working |
| Yellow | Needs permission |
| Red | Error / denied |

**Cursor** — project hooks in `.cursor/hooks.json` (this repo). Green while the agent works; blue on stop.

**Claude Code** — install once:

```bash
npm run hook:install
```

Then run Claude in a terminal. Status appears on the Mac dock without opening Claude. Permissions still use Approve/Deny on the island.

If RYU is down, hooks **fail-open** (agents keep working). Bridge: `127.0.0.1:41999` · `~/.ryu/port` · logs in `~/.ryu/*-hook.log`.

## Docs

See [`docs/README.md`](./docs/README.md) — especially [`docs/technical-execution-plan.md`](./docs/technical-execution-plan.md) and [`docs/product-and-feature-loops.md`](./docs/product-and-feature-loops.md).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run unpackaged Electron demo |
| `npm run build` | Production build |
| `npm run hook:install` | Wire Claude Code permission + status hooks |
| `npm run verify:phase1` | Automated bridge + hook checks (RYU must be running) |
