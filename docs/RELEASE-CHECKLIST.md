# RYU release checklist (local trust)

**Purpose:** Keep product claims aligned with what RYU actually guarantees.  
**Phase:** Phase 3 / P3.6 — review before calling a build release-ready.

## What RYU guarantees

- [ ] Bridge listens only on loopback (`127.0.0.1`), not a public interface
- [ ] Non-health HTTP endpoints require `x-ryu-token` from `~/.ryu/token` (or `RYU_HOME/.ryu/token` in tests)
- [ ] Hooks stay fail-open if the bridge is down, unauthorized, or unreachable
- [ ] Dismiss returns `cancelled`, never silent allow
- [ ] Cursor IDE hooks remain **status rings only** (no approve-every-tool)
- [ ] User-visible copy says loopback/local bridge — not “all data stays on this device”

## Known limitations (must remain documented)

- Same-user malicious processes that can read `~/.ryu/token` are **not** fully defeated
- There is **no remote bridge mode** in this release
- Token must never appear in renderer UI, diagnostics, or logs
- Headless/`verify:*` green ≠ live Claude/Cursor/Codex proof
- Codex Resume is only live-proven when the home ledger says so

## Unsupported / deferred

- Questions / AskUserQuestion
- Batch / allow-always / risk policy
- Mobile / push
- Cursor Multitask external approve
- Packaging/signing/auto-update (unless separately shipped)

## Before release

1. `npm run verify:phase3-proof` green in a supported Electron environment
2. Home ledgers recorded: `HOME-PHASE1.md`, `HOME-PHASE2.md`, `HOME-PHASE3.md`
3. No token material in screenshots, logs, or issue trackers
