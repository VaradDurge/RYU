# Home checklist — Phase 3 (production proof ledger)

**Remote/Electron evidence:** `npm run verify:phase3-proof`  
**Do not mark any adapter live-proven from scripts or spawned hooks alone.**

Keep open until manually recorded:

- [`HOME-PHASE1.md`](./HOME-PHASE1.md)
- [`HOME-PHASE2.md`](./HOME-PHASE2.md)

## Run metadata (fill in by hand)

| Field | Value |
| --- | --- |
| Date | |
| OS / machine | |
| RYU build / commit | |
| Display notes | |

Result classes: `pass` · `fail` · `unsupported` · `not configured`

## P3.1 / P3.2 — Installed app path

- [ ] Launch Electron RYU (dev or installed). Diagnostics show started/unavailable **without** a token value
- [ ] Trigger a Claude request while launching / after reload — card appears once and remains decidable

| Check | Result | Notes |
| --- | --- | --- |
| Diagnostics omit token | | |
| Pending survives reload | | |

## P3.3 — Native interaction

- [ ] Compact Attention: dock clickable; IDE/terminal still receive clicks outside
- [ ] Expanded card: Approve/Deny/Dismiss work; outside click-through still works
- [ ] macOS (if applicable): focus / Spaces / full-screen behavior acceptable

| Check | Result | Notes |
| --- | --- | --- |
| Click-through idle/attention | | |
| Click-through expanded | | |
| No focus steal on attention | | |

## P3.4 — Bridge conflict / recovery

- [ ] Occupy port 41999 or start a second RYU — UI shows unavailable (not calm idle)
- [ ] Free the port → Retry bridge → started on 41999
- [ ] After recovery, a real status/permission still works

| Check | Result | Notes |
| --- | --- | --- |
| Unavailable on conflict | | |
| Retry recovers same port | | |

## P3.5 — Live adapter ledger

### Claude

| Action | Result | Notes |
| --- | --- | --- |
| Permission → Attention → expand → Allow → expected effect | | |
| Deny | | |
| Dismiss / bridge-down fail-open | | |
| WSL token/config (if used) | | |

### Cursor

| Action | Result | Notes |
| --- | --- | --- |
| Lifecycle / ring signals | | |
| Confirmed **no** per-tool Approve spam | | |

### Codex

| Action | Result | Notes |
| --- | --- | --- |
| Live Resume (only if configured) | | `unsupported` / `not configured` / `pass` |
| Status-only if Resume unsupported | | |

## P3.6 — Trust / release

- [ ] Review [`RELEASE-CHECKLIST.md`](./RELEASE-CHECKLIST.md) and tick applicable items
- [ ] Confirm copy still says loopback/local bridge (no absolute “all data stays on device”)

## Expansion gate

Do **not** start Questions / batch / mobile until:

1. This ledger has recorded Claude + Cursor (+ Codex category)
2. Phase 1 + Phase 2 home checks are recorded
3. `docs/phase3-expansion-decision.md` is written (P3.7)
