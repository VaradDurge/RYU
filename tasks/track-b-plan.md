# Track B plan — queue, dismiss, Codex parity, watchdog (S9–S12)

**Status:** plan only — await go to implement  
**Depends on:** Track A green (`npm run verify:track-a`)  
**Out of scope:** H1–H3 home-only live; Phase 3+ questions/batch/mobile; Cursor approve-every-tool

## Goal

Extend the **permission spine** for parallel reality + polish, with the same headless contract style as Track A. Each case gets a named assert in `verify:track-b` (and Track A must stay green).

## Success cases (proposed)

| ID | Case | Success looks like |
| --- | --- | --- |
| S9 | Multi-pending queue | Two distinct pending events → decide first → second still on `/pending` (and/or becomes “current”); decide second → clear. No lost ids. |
| S10 | Stale dismiss | Explicit dismiss/cancel of a pending id → removed from `/pending`, waiter gets fail-open/`cancelled` (not silent allow), UI can clear without restart |
| S11 | Codex parity | Codex hook allow/deny/fail-open + status running/idle/approval/error via POST/hook — same shapes as Claude, `agent: 'codex'` |
| S12 | Ring watchdog (contract) | After `running` (or approval) with no refresh for N ms → status returns to `idle` (bridge and/or documented UI constant tested via extractable logic) |
| S8′ | No Track A regression | `verify:track-a` still PASS after B lands |

**Not success:** live Codex/Claude/Cursor on your laptop; full queue UX polish (badge art); Cursor Resume product path (ACP note optional, not a gate).

## Current state (gap analysis)

| ID | Today | Gap |
| --- | --- | --- |
| S9 | Bridge can hold multiple pending ids; UI `useIsland` is **single** `current` (new event overwrites) | Need ordered queue in island state + bridge behavior when 2nd arrives while 1st open; fixture tests |
| S10 | Waiter disconnect → `ryu:cancel` IPC; no user/API dismiss; restart RYU workaround | Add `POST /dismiss` (or `/cancel`) + renderer action; headless assert |
| S11 | `hooks/ryu-codex-hook.mjs` + install script; phase1 roundtrip only | No Codex status hook; no await status on decide; no `verify:codex-*` / Track B cases |
| S12 | UI watchdog 45s in `useAgentStatuses.ts` only | Not in bridge; not in headless suite; stuck green if renderer misses updates |

## Execution steps

1. **Lock cases** — user confirms S9–S12 (or drops any).
2. **S10 dismiss (smallest trust win)**  
   - Bridge + headless: `POST /dismiss` `{ id }` → respond waiters `{ status: 'cancelled' }`, delete pending, optional IPC.  
   - Renderer: dismiss control on expanded/stale card → call dismiss.  
   - Verify: pending gone; hook fail-open (empty/`cancelled` path), never allow.
3. **S9 queue plumbing**  
   - `useIsland`: `queue: RyuEvent[]` + `current`; ingest enqueues; resolve pops next → attention.  
   - Bridge already multi-pending; assert order stable.  
   - Verify: two POSTs → two ids; allow first → one left; allow second → empty.  
   - Minimal UI: show “+N waiting” only if cheap; else bridge+state fixtures first.
4. **S11 Codex parity**  
   - Mirror Claude: status posts on approval/allow/deny (await before exit); optional `ryu-codex-status.mjs` or reuse status endpoint from permission hook.  
   - `verify:track-b` cases: Codex allow/deny/fail-open + status transitions.  
   - Install script unchanged unless status hooks needed in Codex settings.
5. **S12 watchdog**  
   - Prefer **bridge-side** soft idle: if agent `running`/`approval` and no `/status` refresh for `WATCHDOG_MS`, set `idle` (keeps headless honest).  
   - Align constant with UI (export shared ms in `shared/` or document single source).  
   - Verify: POST running → wait → GET idle.
6. **`npm run verify:track-b`** — headless bridge → S9–S12 → also spawn/require Track A green (or document run both).
7. **Memory** — update `memory/product-loops.md` (F3/F5/F8), `memory/status.md`, lessons if anything bites.
8. **Commit / PR** (same or follow-up branch).

## Suggested order (risk / value)

`S10 → S9 → S11 → S12`  
Dismiss unblocks stale pain first; queue is Phase 2 spine; Codex is demo parity; watchdog is signal polish (UI already half-there).

## Done when

- `npm run verify:track-b` exits 0 with `[S9]…[S12]` PASS  
- `npm run verify:track-a` still PASS  
- Home-only checklist unchanged  

## Explicit non-goals

- Live multi-agent demo on Windows  
- AskUserQuestion / batch / jump-to-session  
- Re-enable Cursor per-tool Approve  
- Mac notch work (`diff/mac/`)
