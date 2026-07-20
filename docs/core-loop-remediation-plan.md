# Core-loop remediation plan

**Status:** Phase 1 planned only — do not implement until user says go.  
**Source:** [`core-loop-failure-analysis.md`](./core-loop-failure-analysis.md)  
**Rule:** Solidify the existing permission loop before adding questions, batch/risk, mobile, or another product wedge.

## Target user goal

> When an agent is blocked, I notice the exact request, understand enough to decide, make one intentional decision, and know it actually reached the agent — without RYU interrupting the rest of my desktop.

The product spine remains:

```text
Idle → Attention → Understand → Decide → Resume → calm
```

---

## Three phases

| Phase | Outcome | Scope |
| --- | --- | --- |
| **1 — Decision integrity + recovery** | No invisible request, false success, or over-broad approval | F1–F5; build/test now after explicit go |
| **2 — Truthful, usable surface** | Attention and context are clear; status is honest and recoverable | F6–F9, F12–F15; list only |
| **3 — Production proof + expansion gate** | Same shipped code is tested in Electron and signed off live | F10 + home validation; only then consider new features |

---

# Phase 1 — Decision integrity + recovery

## Exit criteria

Phase 1 is done only when all outcomes below are true:

1. A pending request survives renderer startup/reload and is shown once.
2. A user sees resolved UI **only** after the bridge accepts their exact decision/dismissal.
3. One Allow/Deny cannot resolve an independent, similar request.
4. The dock does not block clicks/keyboard input outside its visible controls.
5. The app no longer claims “Local mode” more strongly than its actual local-process threat model.
6. All remote tests pass; home-only native/Electron checks remain explicitly unchecked until performed.

## Phase 1 actions

### P1.1 — Make bridge state recoverable by the renderer
**Findings:** F1, F9  
**User goal satisfied:** “If RYU starts or reloads while Claude is waiting, I still see the request and can decide.”

**Build**
- Add a main-process snapshot API for:
  - ordered pending events;
  - agent status map;
  - optional monotonically increasing state revision.
- Expose it through preload as an awaited call, not a public HTTP call from the renderer.
- Renderer startup sequence:
  1. subscribe to live events/status;
  2. fetch snapshot;
  3. reconcile by event ID/revision, deduplicating items already received;
  4. rebuild island queue from the authoritative snapshot.
- Ensure a bridge dismiss/decision sent during hydration cannot resurrect an old card.

**Remote acceptance tests**
- Start a request before simulated renderer hydration → snapshot contains it → state contains it once.
- Receive live event before and after snapshot → one queue entry only.
- Snapshot with two pending requests → FIFO current + queue preserve order.
- Snapshot statuses populate rings before another status post.
- Dismiss/decision race during snapshot → removed event stays removed.

**Home-only check**
- Trigger a Claude request while RYU is launching, then reload the renderer/window; the card returns.

### P1.2 — Acknowledge decisions and dismissals before changing UI
**Findings:** F2, F12  
**User goal satisfied:** “When the dock says Approved, I can trust that my agent received it.”

**Build**
- Replace fire-and-forget decision/dismiss IPC with `ipcRenderer.invoke` / `ipcMain.handle`.
- Return a typed result: `{ ok: true }` or `{ ok: false, reason: 'unknown' | 'expired' | 'unavailable' }`.
- Keep current card/action controls disabled while the request is in flight.
- Only enter Resolved/advance queue after `{ ok: true }`.
- For `{ ok: false }`, preserve/reconcile the card and show an explicit expired/unavailable state; never show Approved.
- Use one click handler per action (remove duplicate mouse-down/click dispatch).

**Remote acceptance tests**
- Accepted allow/deny/dismiss → bridge result OK → exactly one state transition.
- Unknown/expired/dismissed ID → UI state does not resolve; error state/message is emitted.
- Two rapid action attempts → only one bridge decision call is accepted.
- Queue advances only after current action is acknowledged.

**Home-only check**
- Leave a card until timeout, click Approve, and confirm it never claims success.

### P1.3 — Narrow approval identity and paired-hook coalescing
**Findings:** F3  
**User goal satisfied:** “One approval authorizes exactly the operation I saw — no more.”

**Design decision required before implementation**
- First inspect current Claude/Codex hook payloads and official hook docs for an invocation/tool-use ID.
- If an invocation ID exists, use it as the event ID.
- If it does not, use two fields:
  - a unique `requestId` for every hook invocation;
  - a constrained `pairKey` used only to join the documented `PreToolUse` + `PermissionRequest` events for the same operation in a short correlation window.
- Do **not** coalesce two same-event-type requests merely because session/tool/path/content prefix match.

**Build**
- Evolve shared event/pending types to represent one visible request plus only explicitly paired waiters.
- Remove lossy content-prefix identity as the authorization key.
- Keep preview truncation presentation-only; it must not decide authorization identity.
- Apply the same rule to Codex (which currently omits content).

**Remote acceptance tests**
- Intended Claude PreToolUse + PermissionRequest pair → one visible card; one decision releases both.
- Two concurrent writes same session/path with different content after character 64 → two cards/decisions.
- Two identical independent calls → two cards/decisions.
- One request times out/dismisses → it does not resolve its neighbour.
- Codex equivalent does not collide.

**Home-only check**
- Trigger two similar real Claude writes; observe that each gets the intended scope.

### P1.4 — Make native interaction bounded to the dock
**Findings:** F4  
**User goal satisfied:** “RYU asks for a decision without preventing me from using my terminal, IDE, or desktop.”

**Build**
- Replace full-screen interactive capture with one of these designs:
  1. **preferred:** a visual/click-through shell plus a small, separate interactive dock/card window; or
  2. dynamically resize/reposition the native interactive window to only the visible hit/card bounds.
- Do not focus the overlay merely to make an action clickable; preserve terminal focus on Mac when feasible.
- Keep keyboard accessibility explicit: visible controls must be focusable only while the card is active.

**Remote acceptance tests**
- Unit-test bounds calculation for idle, dock, and expanded card states.
- Assert interaction changes are requested only for those bounds.
- Build/type-check Electron code in an environment with dependencies installed.

**Home-only check (required)**
- With a card open, click/type outside the dock in IDE/terminal/browser.
- Verify mouse, keyboard focus, multi-monitor behavior, and macOS Spaces/full-screen behavior.

### P1.5 — Make the local trust boundary truthful and bounded
**Findings:** F5, F11  
**User goal satisfied:** “A local approval is not silently controllable by another process, and RYU does not misrepresent where my request data goes.”

**Build**
- Keep production hook target strictly loopback by default; reject non-loopback `RYU_HOST` / `~/.ryu/host` unless an explicit future remote mode is designed and visibly enabled.
- Add per-RYU-launch capability authentication for `/event`, `/decision`, `/dismiss`, `/pending`, and `/status`.
  - Keep token material out of renderer-visible UI and logs.
  - Document limitation: same-user malicious processes are not fully defeated if they can read hook configuration; token still prevents accidental/unauthorized local callers.
- Validate full event/decision schemas and allowed decisions.
- Add request body byte limits and request timeouts.
- Change “Local mode — All data stays on this device” to accurate copy until the threat model is implemented and reviewed.

**Remote acceptance tests**
- Missing/wrong token → 401/403 and no state mutation.
- Correct hook token → normal allow/deny/dismiss flow.
- Non-loopback host override → fail-open plus a diagnostic log; no outbound request.
- Invalid decision/oversized body → 400/413 without retained pending state.
- Existing Track A/B cases run through authenticated hook/bridge path.

**Home-only check**
- Confirm Windows/WSL installer distributes the loopback token/config correctly and Claude still fails open when RYU is stopped.

## Phase 1 implementation/test order

1. Extract one shared bridge core (HTTP state, schemas, snapshot, decision/dismiss result) so headless and Electron use identical logic.
2. P1.1 snapshot/reconciliation.
3. P1.2 acknowledged action API.
4. P1.3 request identity/pairing, then collision tests.
5. P1.5 local boundary/schema/body limits.
6. P1.4 native interaction bounds/window split.
7. Run full remote suite, then leave a concise home-validation script.

## Phase 1 constraints

- Do not add questions, batch/risk, mobile, or Cursor IDE permission gates.
- Do not claim live proof from headless tests.
- Preserve fail-open: bridge/auth/network failure must not silently allow.
- Preserve Cursor status-only rule.

## Model handoff note

This plan is **model-neutral**. Any model receiving it must:

1. Read `AGENTS.md`, `memory/index.md`, `tasks/to-do.md`, and this file before coding.
2. Implement only Phase 1; do not pull Phase 2/3 work forward.
3. Add/modify tests **before** calling an action complete; distinguish remote evidence from home-only evidence.
4. Use the same extracted bridge core for Electron and headless tests—do not create another duplicate server.
5. Treat security/threat-model choices as product behavior: document assumptions, never silently weaken fail-open or loopback rules.
6. Update `memory/`, `lessons/`, and `tasks/to-do.md` whenever an outcome/failure status changes.

**Suggested implementation prompt for another model**

> Implement Phase 1 only from `docs/core-loop-remediation-plan.md`. Start by writing the exact acceptance tests for P1.1–P1.5. Use the existing product rules in `AGENTS.md`; preserve fail-open and Cursor status-only behavior. Do not claim Electron/live-agent success from headless tests. Commit focused logical changes and update memory, lessons, tasks, and PR.

---

# Phase 2 — Truthful, usable surface (actionable later)

Do not implement until Phase 1 exit criteria and home checks are signed off.

| Action | Findings | User outcome |
| --- | --- | --- |
| Restore deliberate Attention | F6 | I see who needs me before detail takes over |
| Complete Understand card | F7 | I see agent, session, exact usable preview, and functional Details |
| Replace blind idle watchdog | F8 | Ring state reflects working/waiting/stale honestly |
| Reconcile ordered statuses | F9 | A late event cannot overwrite a newer permission/decision state |
| Add bridge/adapter health | F13, F15 | I can tell idle apart from disconnected/uninstalled/broken |
| Eliminate UI duplicate actions | F12 | Each click is one deliberate decision |

**Remote test direction:** reducer/state ordering tests, visual/state snapshots, stale-vs-idle status tests, adapter health fixtures.  
**Home check:** attention feel, session/preview readability, long-running command, stale/bridge-down messaging.

---

# Phase 3 — Production proof and expansion gate (actionable later)

Do not start product feature expansion until this phase passes.

| Action | Findings | User outcome |
| --- | --- | --- |
| Shared bridge-core integration | F10 | The code tested is the code Electron runs |
| Electron renderer/IPC smoke tests | F1, F2, F4, F9 | Startup/reload/action/click-through regressions are caught |
| Live Windows/WSL/Cursor/Codex validation | Home-only gaps | Real agents behave like contracts say |
| Port/restart/recovery UX | F13 | Dock shows an honest unavailable/recoverable state |
| Security review of local-mode copy/token limits | F5, F11 | Product claims match actual protection |

**Expansion gate:** only after Phase 3 proof, decide whether to build Questions, jump-to-session, batch/risk, or a stronger Codex/Cursor integration. New features must not bypass the Phase 1 decision-trust guarantees.
