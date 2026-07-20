# Tasks / plan

**Default mode: plan here first, then execute.**  
Statuses: `todo` · `doing` · `blocked` · `done` · `later`

## Plan (current)

- [x] Seed `memory/` `references/` `tasks/` `lessons/` + protocol
- [x] Add `AGENTS.md` so coding agents know memory + how to code
- [x] Reframe `references/` = external research; seed Claude/Cursor/Apple/competitors
- [x] Agree Track A success cases S1–S8 (H1–H3 home-only)
- [x] Write Track A plan → `tasks/track-a-plan.md`
- [x] User **go** on Track A plan → implement
- [x] Write Track B plan → `tasks/track-b-plan.md`
- [x] User **go** on Track B (confirm S9–S12) → implement
- [x] Track B S10→S9→S11→S12 + verify:track-b green
- [x] Independent core-loop technical + outcome audit → `docs/core-loop-failure-analysis.md`
- [ ] User reviews audit priorities; then write remediation plan (F1–F15)
- [ ] E6 Cursor Resume strategy note — later / optional after B

### Track A checklist (after go)

- [x] Headless bridge harness (no Electron UI)
- [x] Named S1–S8 asserts in verify path
- [x] Fill S5 error (+ cursor approval POST); S3/S6 harden as planned
- [x] `npm run verify:track-a` green here
- [x] Update memory/status + PR

## Home-only (user laptop — do not fake as done)

- [ ] `npm run dev` + reload Cursor → rings, no Approve spam
- [ ] Restart Claude → Write `ryu-live-test.txt` → dock Approve → file exists
- [ ] If Claude Yes/No only → `npm run hook:install` (Windows) + check `~/.ryu/hook.log`

## Engineering backlog (remote-capable)

| ID | Task | Value | Status |
| --- | --- | --- | --- |
| E1 | Harden bridge/hook `verify:*` with named stage asserts | Trust that Decide/Resume is real | done |
| E2 | Codex status+permission verify parity | Multi-agent demo | done |
| E3 | Phase 2 queue plumbing + fixtures | Parallel permissions | done |
| E4 | In-dock dismiss stale cards | Attention quality | done |
| E5 | Ring watchdog (no stuck green) | Signal quality | done |
| E6 | Cursor Resume strategy note (ACP vs selective) | Unblock Cursor product loop | todo |
| E7 | Clean PR of working Windows path | Known-good home baseline | todo |
| E8 | Core-loop recovery/trust remediation (F1–F15) | Prevent invisible/false decisions | needs plan |

## Later / logged (product phases)

- L1 Questions (P3) · L2 Queue UI polish (P2) · L4 Jump-to-session (P4) · L5 Batch/risk (P4) · L7 Mobile (P5)
