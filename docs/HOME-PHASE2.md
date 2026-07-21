# Home checklist — Phase 2 (truthful usable surface)

**Remote evidence:** `npm run verify:phase2-surface` (includes Phase 1 + Track B gates).  
**Do not mark live/Electron items done from headless scripts alone.**

Keep Phase 1 home checks open: [`HOME-PHASE1.md`](./HOME-PHASE1.md).

## P2.1 — Deliberate Attention

- [ ] New permission shows compact Attention (agent icon + yellow ring) without auto-opening the card
- [ ] Click (or activate) the requesting agent to open Understand
- [ ] After Approve/Deny/Dismiss with a queue, next item returns to compact Attention (not expanded)
- [ ] Glanceable from normal IDE use; not a modal interruption

## P2.2 — Understand card

- [ ] Card shows agent, session label, tool, path, and preview
- [ ] Details either reveals bounded extra fields or is absent (never a dead button)
- [ ] Long detail shows “truncated”; approval identity unchanged
- [ ] Two similar sessions are distinguishable without opening a terminal

## P2.3 — Stale (honest liveness)

- [ ] Long-running work without refresh → gray **Status stale**, not blue idle
- [ ] Ignored approval past timeout → stale ring; pending card still actionable until decide/dismiss
- [ ] Explicit agent stop / resolved request → idle (blue)

## P2.4 — Ordered statuses

- [ ] While a permission is pending, late Cursor/Claude lifecycle `idle` does not flip the ring blue
- [ ] Yellow/approval survives out-of-order lifecycle noise until decide/dismiss/stale policy

## P2.5 — Bridge / adapter health

- [ ] Healthy RYU: no “unavailable” copy on status card
- [ ] Second RYU instance / occupied port 41999: UI reports bridge unavailable (not calm idle)
- [ ] Never-configured / never-seen agent is not claimed as proven idle

## P2.6 — Action integrity

- [ ] Double-click Approve does not double-dispatch
- [ ] Failed ack leaves card open with error; retry works
- [ ] Successful Approve/Deny/Dismiss resolves once

## Out of scope (do not expand here)

Questions, batch/risk, mobile, Cursor approve-every-tool, Phase 3 Electron packaging proof.
