# Mac diff — `diff/mac` branch + folder

**Branch:** `diff/mac`  
**Folder:** all Mac-specific product code lives here so Windows Track A can keep a parallel `diff/windows` tree without merge fights.

## What’s in here

| Path | Role |
| --- | --- |
| `electron/window.ts` | Darwin BrowserWindow (full display `bounds`, notch hit area) |
| `island/*` | Multi-agent dock + notch hover UI (mockup) |
| `types.ts` | Additive dock slot ids (does not break `shared/types.ts`) |
| `docs/mac-shell-notes.md` | Spaces / fullscreen / click-through quirks |
| `docs/SYNC.md` | Teammate sync notes for Track A |

## Wiring (thin, shared)

Only these shared files import Mac code:

- `electron/main.ts` — `process.platform === 'darwin'` → `diff/mac/electron/window`
- `electron/preload.ts` — exposes `ryu.platform`
- `src/App.tsx` — on darwin renders `IslandMac` from this folder

Windows continues to use `electron/window.ts` + `src/island/*`.

## Run

```bash
git checkout diff/mac
npm install
npm run dev
```

Hover the top-center / notch strip to reveal the dock. Use the demo harness to inject permissions.

### Dock agents (real only)

Shows **Cursor · Claude · Codex** — no mock icons.

| Ring | Meaning |
| --- | --- |
| Blue | Idle or finished |
| Green | Running (after Approve, while agent continues) |
| Yellow | Permission needed |
| Red | Error / Deny |

### Reliable monitoring (Cursor + Claude)

| Agent | Setup | Rings |
| --- | --- | --- |
| **Cursor** | Project [`.cursor/hooks.json`](../../.cursor/hooks.json) (already in repo) | Green while working; blue on `stop` |
| **Claude** | One-time: `npm run hook:install` | Green while working; yellow on permission; blue on stop |

Keep **RYU running** (`npm run dev`) so hooks can reach `127.0.0.1:41999`.

- Hover notch → dock **pins** until click outside.
- Non-idle agent → dock stays visible (ambient) so you don’t need to open Cursor/Claude.
- Logs: `~/.ryu/cursor-hook.log`, `~/.ryu/claude-hook.log`
- Debug: `curl http://127.0.0.1:41999/agents`

Click an agent icon for its status card (or permission card if pending).

## Screenshots

Regenerate with `npm run capture:mac` (dev server on `:5173`):

- `docs/demo-shots/mac-01-idle.png`
- `docs/demo-shots/mac-02-attention-expanded.png`
- `docs/demo-shots/mac-03-expanded.png`
- `docs/demo-shots/mac-04-resolved.png`
