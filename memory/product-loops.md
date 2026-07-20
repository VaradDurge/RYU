# Product & feature loops (compact)

Source of truth (long): `docs/product-and-feature-loops.md`

## Core loop

`Idle → Attention → Understand → Decide → Resume`

## Feature loops — status

| ID | Loop | Phase | Status |
| --- | --- | --- | --- |
| F1 | Permission decide (Allow/Deny) | 0–1 | Track A S1–S4/S7 green (headless); live WSL sign-off pending |
| F2 | Attention / presence (rings) | 0–2 | Rings + stale/health (P2.3–P2.5); compact Attention first (P2.1); live glanceability home |
| F3 | Collapse / return-to-calm | 0–2 | Dismiss + watchdog→**stale** (P2.3/S12); deliberate Attention (P2.1); live UX still home |
| F4 | Questions / AskUserQuestion | after proof gate | Logged — not started; Phase 3 is production proof first |
| F5 | Multi-item queue | 2 | Bridge + island FIFO (Track B S9); badge = “N waiting” |
| F6 | Jump-to-session | 4 | Logged — not started |
| F7 | Risk / batch | 4 | Logged — not started |
| F8 | Multi-agent adapters | 2–5 | Cursor status + Claude resume; Codex script parity (S11); Cursor approve off |
| F9 | Away-from-desk / mobile | 5 | Logged — not started |

## Phase map

| Phase | Intent | Remote-executable? |
| --- | --- | --- |
| 0 | UX demo / harness | Yes (code + captures); eyes-on sign-off at home |
| 1 | One agent real Resume | Bridge/hooks/verify yes; live Claude/Cursor no |
| 2 | Queue + optional 2nd agent | Mostly yes (fixtures) |
| 3 | Production proof + expansion decision | Electron smoke + home proof required |
| 4–5 | Questions, trust, reach | Spec/tests yes; after Phase 3 gate |
