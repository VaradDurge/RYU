# Phase 3 execution plan — production proof and expansion gate

**Status:** remote + Electron smoke implemented — `npm run verify:phase3-proof` PASS.  
**Home validation:** [`HOME-PHASE3.md`](./HOME-PHASE3.md) (keep [`HOME-PHASE1.md`](./HOME-PHASE1.md) and [`HOME-PHASE2.md`](./HOME-PHASE2.md) open).  
**P3.7:** write [`phase3-expansion-decision.md`](./phase3-expansion-decision.md) only after home evidence is recorded.  
**Source:** [`core-loop-failure-analysis.md`](./core-loop-failure-analysis.md) F1, F2, F4, F5, F9–F11, F13 and F15; [`core-loop-remediation-plan.md`](./core-loop-remediation-plan.md).

## Why this Phase 3 is proof, not feature expansion

Older product notes use “Phase 3” for Questions / `AskUserQuestion`. That is not safe to build yet: remote scripts currently prove the shared bridge core, but not the shipped Electron window, IPC path, native click-through, or real adapters on a user machine.

This phase closes that evidence gap. It adds only the minimal diagnostics, retry/recovery behavior, and test seams needed to prove the existing permission loop. **Questions, batch/risk, mobile, and Cursor per-tool approval remain out of scope.**

## User goal

> Before RYU asks me to trust a decision in my real workspace, I can verify that the installed app, bridge, window, and live agent all behave like the tested loop — and I can recover honestly if one part fails.

The loop being proved remains:

```text
Idle → Attention → Understand → Decide → Resume → calm
```

## Success contract

| ID | User-observable outcome | Must not happen |
| --- | --- | --- |
| P3.1 | The Electron app uses and exposes the same bridge-core state that headless tests exercise | A duplicate bridge/server behavior drifts from Electron |
| P3.2 | Renderer startup/reload, snapshot hydration, live event/status delivery, and acknowledged actions are exercised through preload/IPC | Passing core tests are presented as Electron proof |
| P3.3 | Native interaction is bounded: dock controls work; surrounding IDE/terminal input still works | A transparent full-screen window traps mouse/keyboard/focus |
| P3.4 | Bridge start failure or restart is visibly unavailable and can recover without a misleading idle state | `EADDRINUSE` or restart leaves a normal-looking disconnected dock |
| P3.5 | Claude/Cursor/Codex live evidence is recorded per adapter; unsupported paths remain clearly unsupported | A spawned hook fixture is called live-agent proof |
| P3.6 | Local trust copy, token handling, and loopback behavior have a reviewed, accurate release checklist | Product copy overclaims local security or data handling |
| P3.7 | A written expansion decision identifies the next feature only after proof results are known | Questions or other expansion work is pulled forward |

## Scope and non-goals

### In scope

- Electron/main/preload/renderer integration and smoke testing.
- Testable native-window interaction boundaries.
- Bridge lifecycle diagnostics and safe retry/recovery.
- A reproducible Windows + WSL home-validation script.
- Live-adapter evidence capture for Claude, Cursor status rings, and Codex only where configured.
- Release-readiness checklist and expansion decision record.

### Explicitly out of scope

- Questions / `AskUserQuestion`
- Allow-always, batch approval, risk policy
- Cursor IDE approve-every-tool
- New adapters or remote/network bridge mode
- Mobile/push
- Packaging, signing, auto-update, analytics, or a settings dashboard
- Mac UI redesign (Mac validation remains a separate shell track)

## Evidence classes

Every result must carry one of these labels:

| Label | Meaning |
| --- | --- |
| **Remote contract** | Pure reducer/shared-core/renderer test run in CI-like Linux environment |
| **Electron smoke** | Test runs against built Electron main + preload + renderer path |
| **Home live proof** | Human performs and records the behavior with real local agent/IDE |
| **Unsupported** | Deliberately not offered; do not represent as verified |

No Home live proof may be inferred from an Electron smoke test or a spawned hook.

---

## P3.1 — Same-code Electron bridge proof

**Findings:** F10  
**User goal:** “The app I launch has the same decision behavior we tested.”

### Build

- Keep `shared/bridge-core.mjs` as the only HTTP state machine.
- Add a narrow, test-only Electron bootstrap seam that starts the real `RyuBridge` / `electron/main` path with:
  - an isolated app-data home/token location;
  - an ephemeral or injected loopback port;
  - deterministic cleanup;
  - no production-only alternate bridge implementation.
- Expose a read-only diagnostic identity in development/test only:
  - bridge version/revision;
  - bound port;
  - started/unavailable state and reason;
  - no token value.
- Assert Electron’s snapshot/health results match the core’s state contract.

### Remote acceptance

- Electron smoke starts the real main-process bridge and receives `/health` with `bridge: started`.
- A token-authenticated event appears in the main-process snapshot and renderer after startup.
- Decision/dismiss uses the same bridge core and produces the same waiter response as headless.
- The test fails if Electron imports/starts a second bridge implementation.

### Home-only check

- Launch the packaged/dev Electron app and confirm the diagnostics identify the expected bridge state without exposing a token.

---

## P3.2 — Renderer, preload, and IPC lifecycle smoke

**Findings:** F1, F2, F9  
**User goal:** “A request cannot vanish while the installed window is starting or reloading.”

### Build

- Add an Electron integration harness using Playwright/Electron (or an equivalent supported runner) that drives the real preload API, not direct React props.
- Cover:
  1. subscribe first → snapshot hydrate → one visible request;
  2. pending request during reload → one recovered card;
  3. status snapshot/live update revisions → late update ignored;
  4. approve/deny/dismiss → controls remain disabled until IPC acknowledges;
  5. unavailable snapshot → visible unavailable diagnostic rather than fabricated idle.
- Make selector/test IDs limited to the integration surface; do not replace accessibility labels with test-only UX.
- Ensure test fixture events use the authenticated bridge path.

### Remote acceptance

- A single `npm run verify:phase3-proof` command runs P3.1–P3.4 smoke cases and regression gates.
- Reload/hydration fixture shows one card and preserves queue order.
- Mock/real IPC failure keeps the card actionable with an error.
- Repeated clicks produce one decision/dismiss request.

### Home-only check

- Trigger a real Claude request during app launch and after a renderer reload; the request appears once and remains decidable.

---

## P3.3 — Native interaction and focus proof

**Findings:** F4  
**User goal:** “RYU is clickable without taking over my workspace.”

### Build

- Add diagnostic logging (development/test only) for requested interactive bounds and whether the window is interactive; never log event detail/token.
- Add unit coverage for bounds transitions: idle, compact Attention, expanded card, resolved, and bridge unavailable.
- In Electron smoke where platform permits:
  - verify dock/card controls are hit-testable;
  - verify the interactive region is no larger than the visible surface;
  - verify no automatic focus steal on compact Attention.
- If automated native click-through is unreliable in the runner, leave it as a documented Home live proof rather than fabricating coverage.

### Remote acceptance

- Bounds tests cover each Island mode and no full-window interaction request.
- Electron smoke confirms the current window API receives only bounded regions.
- Accessibility controls remain keyboard reachable when the card is expanded.

### Home-only check

- With compact and expanded RYU states, click/type in Cursor, terminal, browser, and a second monitor.
- On macOS, additionally test focus, Spaces, and full-screen behavior.

---

## P3.4 — Bridge lifecycle, conflict, and recovery

**Findings:** F13, F15  
**User goal:** “If RYU is disconnected, I see it and know whether it recovered.”

### Product decision

The first launch must retain the port. A second instance that cannot bind `127.0.0.1:41999` is **unavailable**, not a secondary healthy bridge. It may offer a bounded retry only after the port becomes free; it must not fall back to a random port that existing hooks cannot discover.

### Build

- Model bridge lifecycle explicitly: `starting`, `started`, `unavailable`, `stopped`.
- Carry a sanitized start/retry reason (for example `EADDRINUSE`) through the main-process snapshot.
- Add a main-process retry command, rate-limited and disabled while a retry is active:
  - re-attempt only the configured loopback port;
  - update health/revision on success;
  - never auto-allow or clear pendings during failure.
- Renderer behavior:
  - unavailable indicator is visible in development and status detail;
  - existing pending cards remain honest/actionable only if their core is still available;
  - a stopped/unavailable bridge cannot display idle as a claim of current agent state.

### Remote acceptance

- Occupied-port smoke fixture yields `unavailable/EADDRINUSE`.
- Releasing the port then invoking one retry yields `started` on 41999.
- Repeated retry attempts while pending are coalesced/rate-limited.
- Existing status/pending state is not silently reset to idle because start failed.

### Home-only check

- Run a second RYU instance or occupy port 41999; observe unavailable copy; free it; retry; then trigger a real status/permission.

---

## P3.5 — Live adapter proof ledger

**Findings:** live-proof gaps  
**User goal:** “I know which agents really work on my machine, not just in a script.”

### Build

- Add `docs/HOME-PHASE3.md` with exact, short, reproducible evidence steps and a result table:
  - machine/OS/RYU build (no personal paths or tokens);
  - adapter/configuration;
  - action/result;
  - result class: pass, fail, unsupported, not configured.
- Claude:
  - permission request → compact Attention → expand → Allow → expected tool effect;
  - Deny and dismiss/fail-open behavior;
  - WSL token/config path if applicable.
- Cursor:
  - lifecycle/ring signals only;
  - explicitly verify no per-tool approval is introduced.
- Codex:
  - only validate Resume if its installed hook contract supports it;
  - otherwise record status-only/unsupported, not a failure disguised as support.
- Preserve redaction: no request payload, token, workspace contents, or screenshots containing secrets in the ledger.

### Acceptance

- The checklist makes it impossible to call any adapter live-proven without a recorded manual result.
- Claude live Allow, Deny, and bridge-down fail-open are individually recorded.
- Cursor’s status-only constraint is recorded.
- Codex is explicitly categorized as live-proven, unsupported, or not configured.

---

## P3.6 — Local trust and release-readiness review

**Findings:** F5, F11  
**User goal:** “RYU’s local-security language matches what it can actually guarantee.”

### Build

- Review all user-visible bridge/local-copy strings for accuracy.
- Verify:
  - bridge binds only to loopback;
  - auth is required for non-health endpoints;
  - token is neither sent to renderer nor logged;
  - hook failure remains fail-open;
  - body limits and host rejection remain in the shared core.
- Add a concise release checklist with known limitations:
  - same-user malicious process limitation;
  - no remote bridge;
  - local data/token handling;
  - unsupported adapters/features.
- Do not claim third-party security certification or solve same-user malicious-process defense in this phase.

### Remote acceptance

- Existing auth/loopback/body-limit tests remain in the Phase 3 regression gate.
- Static checks reject token-like diagnostics/logging in renderer/devtools-facing code.
- Copy test asserts no absolute “all data stays on this device” or equivalent overclaim.

### Home-only check

- Confirm installer/hook configuration can read required local config on Windows/WSL while RYU stopped still fails open.

---

## P3.7 — Expansion decision record

**User goal:** “The next feature is chosen from evidence, not optimism.”

### Build

- Add `docs/phase3-expansion-decision.md` only after P3.1–P3.6 are recorded.
- It must choose exactly one next direction:
  1. Questions / `AskUserQuestion`;
  2. jump-to-session;
  3. batch/risk;
  4. stronger Codex/Cursor integration;
  5. reliability follow-up.
- Include:
  - what evidence supports the choice;
  - user value;
  - affected trust invariant;
  - explicit scope boundary;
  - reasons the other options were deferred.

### Acceptance

- The decision record links the home evidence and remote gates.
- No product expansion implementation is bundled with the decision.

---

## Implementation order

1. P3.1 test bootstrap/seam for the real Electron bridge.
2. P3.2 preload/renderer lifecycle smoke harness.
3. P3.3 bounded interaction instrumentation/tests.
4. P3.4 lifecycle/retry state, then conflict/recovery smoke tests.
5. P3.6 trust-copy/static release checks.
6. `verify:phase3-proof` regression gate.
7. P3.5 home checklist and live proof recording.
8. P3.7 expansion decision only after evidence is recorded.

## Verification deliverable

Add:

```bash
npm run verify:phase3-proof
```

It must:

1. run Electron smoke only when Electron/display dependencies are available, and fail clearly rather than silently downgrading;
2. run bridge/core/renderer lifecycle and port-recovery fixtures;
3. run `verify:phase2-surface` as the regression gate;
4. label each result **Remote contract** or **Electron smoke**;
5. never report Home live proof as passed.

If CI cannot provide a supported Electron display environment, the command may report the Electron suite as **not runnable in this environment**, but it must exit non-zero when invoked as the required Phase 3 gate. Do not replace it with headless tests and call the phase complete.

## Phase exit / expansion gate

Phase 3 is not complete until:

- `verify:phase3-proof` passes in a supported Electron environment;
- all relevant Phase 1 and Phase 2 home checks have recorded results;
- P3.5 live ledger records Claude, Cursor, and Codex status accurately;
- P3.6 release checklist is complete;
- P3.7 records the next feature decision.

Until then, Phase 1/2 remote results remain valuable but are not release proof.

## Model handoff note

This plan is deliberately proof-first. Any coding model must:

1. Read `AGENTS.md`, `memory/index.md`, `tasks/to-do.md`, `memory/status.md`, `memory/product-loops.md`, `lessons/index.md`, Phase 1/2 plans and home checklists before changing code.
2. Implement only P3.1–P3.6 in the order above; do not add Questions, risk/batch, mobile, Cursor per-tool approval, a random fallback port, or remote bridge mode.
3. Start with the `verify:phase3-proof` skeleton and exact acceptance tests. Use the real Electron main/preload/renderer path; direct shared-core tests supplement but never replace it.
4. Keep `shared/bridge-core.mjs` authoritative. Preserve authenticated loopback-only communication, unique request identity, constrained pairing, acknowledged decision/dismiss, fail-open, ordered revisions, and `stale` over false idle.
5. Treat platform limitations honestly: label a missing display/native automation capability as unproven, not passing.
6. Do not log/token-expose secret material or raw event detail in diagnostics/screenshots.
7. Keep the strict evidence labels (Remote contract, Electron smoke, Home live proof, Unsupported) in output and docs.
8. Commit focused logical changes, run the highest supported regression gate, and update `memory/`, `lessons/`, `tasks/to-do.md`, home checklist, and PR after each logical increment.

**Suggested implementation prompt**

> Implement Phase 3 only from `docs/phase3-execution-plan.md`. This is a production-proof gate, not the old Questions feature phase. Build `verify:phase3-proof` first using the real Electron main/preload/renderer path, then P3.1 → P3.6. Preserve all Phase 1/2 trust invariants, especially fail-open, authenticated loopback, Cursor status-only, revisions, stale-not-idle, and acknowledged actions. Do not call headless or spawned-hook evidence Electron/live proof. Add `HOME-PHASE3.md`, but never mark it complete from remote automation. Do not implement any expansion feature; only record P3.7 after proof results exist.
