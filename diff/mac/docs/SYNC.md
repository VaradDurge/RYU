# Teammate sync — Mac dock UI

**For:** Track A (Windows) owner of `src/island/*` and `electron/window.ts`

## Agreements for this branch

1. Mac UI / shell lives under **`diff/mac/`** on branch **`diff/mac`** (mirrors a Windows `diff/windows` layout if you use one).
2. Do **not** rewrite `electron/window.ts` from this track.
3. `shared/types.ts` stays frozen for hook/bridge fields. Dock-only ids live in `diff/mac/types.ts`.
4. On darwin, `src/App.tsx` mounts `IslandMac`; Windows keeps the Phase 0 single-pill in `src/island/*` until you choose to adopt the dock.
5. Visual target for Mac: multi-agent glass dock hanging from the notch + permission card (mockup). Permission card copy still matches parallel-work-split §6.2 (Approve/Deny, Waiting, Local mode).

## Merge notes

- Prefer merging `diff/mac` after Windows shell is stable.
- Conflict risk is low if Windows only touches `electron/window.ts` + `src/island/*` and Mac only adds `diff/mac/**` plus the thin darwin branches in `main` / `preload` / `App`.
