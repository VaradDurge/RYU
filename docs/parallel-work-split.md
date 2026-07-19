# RYU — Parallel Work Split + UI Reference

**Date:** 2026-07-20  
**Audience:** You (Windows) + teammate (Mac)  
**Related:** [technical-execution-plan.md](./technical-execution-plan.md) · [product-and-feature-loops.md](./product-and-feature-loops.md)

This doc is the **handoff plan** for working in parallel, plus the **locked Phase 0 UI target** (glassmorphic island that was signed off as “looks good”).

---

## 1. Roles

| Role | Person | Machine | Owns |
| --- | --- | --- | --- |
| **Track A — Windows shell + UX + Phase 1 verify** | You | Windows | Floating island polish, Windows Electron shell, Claude live verify |
| **Track B — Mac shell + notch placement** | Teammate | Mac | Mac Electron shell, notch / top-center positioning, Mac screenshots |
| **Track C — Agent wiring** | Prefer You (primary); Teammate reviews on Mac | Either | Hook + bridge hardening (one owner to avoid merge fights) |

**Product rule (unchanged):** Perfect the core loop first — Idle → Attention → Understand → Decide → Resume. Permissions only in v1. Questions / queue / batch are later phases.

---

## 2. What’s already in the repo (shared base)

Both start from current `main` / latest pull:

| Area | Status |
| --- | --- |
| Phase 0 glass island UI (`src/island/*`) | Implemented — **UI reference below is the target** |
| Demo harness (`src/demo/harness.tsx`) | Implemented |
| Bridge (`electron/bridge.ts`) | Implemented (localhost long-poll) |
| Claude hook (`hooks/ryu-hook.mjs` + installer) | Implemented — needs live verify per OS |
| Shared types (`shared/types.ts`) | **Freeze** — change only with a sync |

---

## 3. File ownership (avoid merge pain)

| Path | Owner | Notes |
| --- | --- | --- |
| `shared/types.ts` | **Frozen / both agree** | Contract for harness + hook + UI |
| `src/island/**`, `src/theme.ts`, `src/demo/**` | **You (Track A)** | UX source of truth |
| `electron/window.ts` | **You** | Windows floating overlay |
| `electron/window.mac.ts` (new) or `electron/platform/mac.ts` | **Teammate** | Mac shell — do not rewrite Windows window in place |
| `electron/main.ts` | Shared carefully | Teammate only adds `darwin` branch to call Mac window factory |
| `electron/bridge.ts`, `hooks/**`, `scripts/install-claude-hook.mjs` | **You primary** | Teammate can PR small Mac-path fixes |
| `docs/**` | Either | Prefer new files over rewriting each other’s docs |

### Branches

- `you/windows-shell-ux` — Track A  
- `them/mac-shell` — Track B (legacy name)  
- `diff/mac` — Mac implementation branch; code under [`diff/mac/`](../diff/mac/)  
- Merge to `main` often; keep `shared/types.ts` stable  

**Mac code location:** all Mac shell + dock UI lives in `diff/mac/` (see [`diff/mac/README.md`](../diff/mac/README.md)). Thin wiring only in `electron/main.ts`, `electron/preload.ts`, and `src/App.tsx`.

---

## 4. Track A — You (Windows)

### Goals

1. Phase 0 UX signed off on Windows (single instance, no double pill, glass card readable).  
2. Single-instance lock so multiple `npm run dev` can’t stack overlays.  
3. Phase 1: real Claude Code Bash permission → island → Approve/Deny → agent continues; fail-open if RYU down.  
4. Windows demo README / pitch script.

### Own tasks (checklist)

- [ ] Enforce one Electron window (second launch focuses existing).  
- [ ] Click-through only when not hovering pill/card/harness.  
- [ ] Card stays near-opaque (no IDE text bleed-through).  
- [ ] `npm run verify:phase1` green with RYU running.  
- [ ] Live Claude: `npm run hook:install` + Approve/Deny end-to-end.  
- [ ] Keep UI aligned with **§6 UI reference** (don’t regress).

### Out of scope for Track A (for now)

- Mac notch APIs / vibrancy  
- Questions / multi-agent queue / mobile  
- Cursor IDE Multitask external approve  

---

## 5. Track B — Teammate (Mac)

### Goals

1. Same React island UI runs under a **Mac-native feeling shell** (notch-adjacent or top-center pill).  
2. Document Mac quirks (always-on-top, Spaces, click-through, blur).  
3. Prove the same localhost bridge + hook works on Mac Claude Code.

### Own tasks (checklist)

- [ ] Clone, `npm install`, `npm run dev` — screenshot Idle / Attention / Expanded.  
- [ ] Add `electron/window.mac.ts` (or equivalent); wire from `main` when `process.platform === 'darwin'`.  
- [ ] Position under / near notch on notched MacBooks; top-center fallback on non-notch.  
- [ ] `setVisibleOnAllWorkspaces` / fullscreen behavior sane.  
- [ ] Do **not** fork island React components — reuse `src/island/*` as-is unless You ask for a shared prop.  
- [ ] Optional: note vibrancy / native feel experiments; keep HTTP bridge (`127.0.0.1`), don’t switch to Unix socket yet unless both agree.  
- [ ] Run Claude + hook on Mac once Track C/A bridge is stable; report fail-open.

### Out of scope for Track B (for now)

- Rewriting Windows `window.ts`  
- Changing Approve/Deny payload shape  
- Building questions UI or multi-agent toolbar (Phase 2+)  

### Copy-paste brief for teammate

> Clone RYU, run `npm install && npm run dev`. We’re in Phase 0: glassmorphic Dynamic Island–style permission UI (see `docs/parallel-work-split.md` §6). Your job is the **Mac Electron shell** so that same React UI sits correctly near the notch (or top-center). Add `electron/window.mac.ts` and call it from `main` on `darwin` only — don’t rewrite `src/island/*`. Keep talking to the bridge on `127.0.0.1`. Send screenshots of Idle / Attention / Expanded. Reference: `docs/product-and-feature-loops.md` + `docs/technical-execution-plan.md`.

---

## 6. Locked UI reference (Phase 0 target)

This is the look that was approved. **Aspire to this; don’t invent a second visual language.**

### 6.1 Design language

| Token | Intent |
| --- | --- |
| Style | Minimal Apple **glassmorphic** — frosted dark surfaces, thin light borders, soft single shadow |
| Font | SF Pro / system (`-apple-system`, Segoe UI fallback) |
| Mono | SF Mono / Cascadia for commands |
| Pill radius | Fully rounded (`999`) |
| Card radius | ~22px |
| Primary action | Solid **white** button, dark label — labeled **Approve** (not “Allow”) |
| Secondary action | Ghost / bordered — **Deny** |
| Waiting accent | Yellow `#F5C542` |
| Destructive | Red `#FF453A` (scary commands) |
| Opacity | Near-opaque glass on Windows (`~0.94–0.97`) so IDE text doesn’t bleed through |

**Do not ship:** hanging warning badges below the notch (explicitly rejected), purple AI gradients, multi-layer shadow “double outline,” nested pill-inside-pill, translucent cards that show Cursor chat through them.

### 6.2 States

```text
IDLE → ATTENTION → EXPANDED → RESOLVED → IDLE
```

#### Idle

- Thin frosted **pill** top-center.  
- Empty / quiet; no icon, no glow.  
- Ignorable until something needs you.

#### Attention

- Same glass pill.  
- **Real agent logo** (Claude / Codex / Cursor assets in `src/assets/agents/`).  
- Soft selection **ring** around the icon (inside the pill — not a floating badge under the notch).  
- Small status **dot** (yellow waiting / red if destructive).  
- Click → Expanded.

#### Expanded (permission card)

Layout matches the approved reference:

```text
        [ glass pill with agent icon + ring ]
                        |
                   dashed connector
                        |
        ┌──────── glass permission card ────────┐
        │ ⚠ Tool Permission Required    Waiting │
        │ [logo] Claude wants to run a command. │
        │ ┌─ command inset ───────────────────┐ │
        │ │ bash -lc "…"                      │ │
        │ └───────────────────────────────────┘ │
        │ 📁 ~/Projects/…                       │
        │ [ Deny ]              [ Approve ]     │
        │ 🔒 Local mode — data stays on device  │
        └───────────────────────────────────────┘
```

Content rules:

| Element | Spec |
| --- | --- |
| Title | “Tool Permission Required” |
| Badge | “Waiting” + yellow dot |
| Body | `{Agent} wants to run a command.` with real logo |
| Command | Monospace in dark inset; prefer `bash -lc "…"` style for Bash |
| Path | Optional `event.path` (e.g. `~/Projects/ryu`) |
| Actions | Deny (ghost) · Approve (white primary) |
| Footer | Lock + “Local mode — All data stays on this device” |
| Width | ~380px card |

#### Resolved

- Brief pill state: green “Approved” or red “Denied”.  
- Auto-collapse to Idle (~1s).

### 6.3 Interaction

| Gesture | Behavior |
| --- | --- |
| Hover pill/card | Window accepts mouse (click-through off) |
| Elsewhere | Click-through to desktop / IDE |
| Approve / Deny | Sends `RyuDecision`; UI → Resolved → Idle |
| Demo harness (dev) | Top-left: Inject permission / Codex / scary rm / pitch timeline |

### 6.4 Implementation map (don’t regress)

| Piece | File |
| --- | --- |
| Tokens | `src/theme.ts` |
| Glass helper | `src/island/glass.ts` |
| Shell layout + dashed connector | `src/island/Island.tsx` |
| States | `Idle.tsx`, `Attention.tsx`, `Expanded.tsx`, `Resolved.tsx` |
| Logos | `src/island/AgentIcon.tsx` + `src/assets/agents/*.png` |
| Fake events | `src/demo/harness.tsx` |
| Reference screenshots | `docs/demo-shots/` (regenerate via `node scripts/capture-demo.mjs`) |

### 6.5 Platform note (Mac vs Windows)

| Platform | Shell aspiration |
| --- | --- |
| **Windows** | Always-on-top floating glass island (current Track A) |
| **Mac** | Same UI; shell sits in / under notch when possible, else top-center pill (Track B) |

Same React UI. Different `BrowserWindow` factory only.

---

## 7. Shared contract (frozen)

```ts
type RyuAgent = 'claude' | 'codex' | 'cursor'
interface RyuEvent {
  id: string
  agent: RyuAgent
  sessionLabel: string
  tool: string
  preview: string
  path?: string
  risk?: 'normal' | 'destructive'
  ts: number
}
interface RyuDecision {
  id: string
  decision: 'allow' | 'deny'
  reason?: string
}
```

- UI must not branch on “fake vs real” events.  
- Claude hook decisions must use wrapped `hookSpecificOutput.permissionDecision`.  
- Fail-open: never silent `allow` on error/timeout.

---

## 8. Suggested cadence

| When | You (Windows) | Teammate (Mac) |
| --- | --- | --- |
| Day 1 | Phase 0 UX lock + single-instance | Boot demo + screenshots + Mac shell scaffold |
| Day 2 | Overlay bugs / click-through | Notch positioning + always-on-top |
| Day 3 | Live Claude Phase 1 on Windows | Same hook against Mac shell |
| Day 4 | Demo polish + README | Mac glass/notch polish + notes |

**Sync point:** End of Day 2 — confirm `RyuEvent` unchanged and UI still matches §6.

---

## 9. Definition of done (parallel tracks)

### Track A done when

- One Windows island, no ghost windows.  
- Glass UI matches §6.  
- Claude Approve/Deny works live; fail-open proven.

### Track B done when

- Mac build shows same UI states under notch / top-center.  
- Screenshots attached; known Mac issues listed.  
- Hook + bridge work on Mac (or clear blockers filed).

### Together done when

- `main` has `window` factory for `win32` + `darwin`.  
- Same demo script works on both machines for the pitch.

---

## 10. Later phases (do not pull into parallel v1)

Logged only — see product loops doc:

- Phase 2: multi-pending queue  
- Phase 3: questions  
- Phase 4: jump-back, risk batch  
- Phase 5: more agents, mobile  

Teammate’s Mac shell is the right foundation for Phase 5 notch polish — not a reason to expand scope now.
