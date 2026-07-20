# Product & feature loops (compact)

Source of truth (long): `docs/product-and-feature-loops.md`

## Core loop

`Idle → Attention → Understand → Decide → Resume`

## Feature loops — status

| ID | Loop | Phase | Status |
| --- | --- | --- | --- |
| F1 | Permission decide (Allow/Deny) | 0–1 | Claude path wired + script-verified; live WSL sign-off pending |
| F2 | Attention / presence (rings) | 0–1 | Cursor live OK; Claude wired + verify OK |
| F3 | Collapse / return-to-calm | 0–1 | UI exists; stale cards can stick → restart RYU |
| F4 | Questions / AskUserQuestion | 3 | Logged — not started |
| F5 | Multi-item queue | 2 | Logged — not started |
| F6 | Jump-to-session | 4 | Logged — not started |
| F7 | Risk / batch | 4 | Logged — not started |
| F8 | Multi-agent adapters | 2–5 | Cursor status + Claude resume; Codex early; Cursor approve off |
| F9 | Away-from-desk / mobile | 5 | Logged — not started |

## Phase map

| Phase | Intent | Remote-executable? |
| --- | --- | --- |
| 0 | UX demo / harness | Yes (code + captures); eyes-on sign-off at home |
| 1 | One agent real Resume | Bridge/hooks/verify yes; live Claude/Cursor no |
| 2 | Queue + optional 2nd agent | Mostly yes (fixtures) |
| 3–5 | Questions, trust, reach | Spec/tests yes; product proof later |
