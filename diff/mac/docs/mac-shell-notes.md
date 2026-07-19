# Mac shell quirks (Track B / diff/mac)

## Window geometry

- Overlay uses primary display **`bounds`**, not `workArea`, so the mouse can enter the menubar / notch region.
- Primary display only in v1. External monitors: island stays on the main laptop display.

## Always-on-top / Spaces

- `setAlwaysOnTop(true, 'screen-saver')` + `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`.
- In Mission Control the transparent overlay can look odd; expected for always-on-top Electron.
- Fullscreen IDE: window should remain visible; if a specific app goes exclusive fullscreen and hides it, note the app name for a follow-up.

## Click-through

- Default: `setIgnoreMouseEvents(true, { forward: true })` so the desktop / IDE stay usable.
- Renderer sends `ryu:setInteractive(true)` while the cursor is over the notch hit zone, dock, or permission card.
- Grace delay (~200ms) on leave avoids flicker when moving from notch → dock → card.

## Vibrancy

- v1 uses CSS glass (`backdrop-filter` + translucent fills) rather than `setVibrancy`.
- Native vibrancy can fight custom glass and hit-testing; revisit later if needed.

## Hover model

| State | Behavior |
| --- | --- |
| Idle, not hovering | Minimal notch glow only |
| Hover notch / dock | Agent dock springs open |
| Pending permission, not hovering | Glow + tiny attention cue stays (not a vanishing toast) |
| Expanded | Dock + dashed connector + permission card |
| Leave UI | Collapse after grace; click-through restored |

## Bridge

Unchanged: HTTP on `127.0.0.1` (default port 41999). No Unix socket in this pass.
