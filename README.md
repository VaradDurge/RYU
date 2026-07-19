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

## Phase 1 — Claude Code wiring

1. Keep RYU running (`npm run dev`).
2. Install the hook once:

```bash
npm run hook:install
```

3. In Claude Code, trigger a Bash/Write/Edit permission. The island should light up; **Allow** / **Deny** from the notch.

If RYU is down or times out, Claude falls back to its normal prompt (**fail-open** — never silent auto-allow).

Bridge listens on `127.0.0.1:41999` and writes the port to `~/.ryu/port`.

## Docs

See [`docs/README.md`](./docs/README.md) — especially [`docs/technical-execution-plan.md`](./docs/technical-execution-plan.md) and [`docs/product-and-feature-loops.md`](./docs/product-and-feature-loops.md).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run unpackaged Electron demo |
| `npm run build` | Production build |
| `npm run hook:install` | Wire Claude Code PreToolUse hook |
| `npm run verify:phase1` | Automated bridge + hook checks (RYU must be running) |
