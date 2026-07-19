# Mac diff — `diff/mac` branch + folder

**Branch:** `diff/mac`  
**Folder:** all Mac-specific product code lives here so Windows Track A can keep a parallel `diff/windows` tree without merge fights.

## What’s in here

| Path | Role |
| --- | --- |
| `electron/window.ts` | Darwin BrowserWindow (full display `bounds`, notch hit area) |
| `island/*` | Legacy Mac copies / `IslandMac` re-exports shared `src/island` dock |
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

## Screenshots

Regenerate with `npm run capture:mac` (dev server on `:5173`):

- `docs/demo-shots/mac-01-idle.png`
- `docs/demo-shots/mac-02-attention-expanded.png`
- `docs/demo-shots/mac-03-expanded.png`
- `docs/demo-shots/mac-04-resolved.png`
