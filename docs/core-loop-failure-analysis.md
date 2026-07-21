# Core loop failure analysis

**Date:** 2026-07-20  
**Scope:** Current `main`-derived working branch after Track A/B. Two independent audits: technical failure modes and outcome-first UX.  
**Status:** findings only; no remediation implemented by this report.

## Executive summary

The **headless bridge/hook contracts are green**:

```bash
npm run verify:track-a # S1–S8
npm run verify:track-b # S9–S12 + Track A gate
```

That is useful evidence for HTTP and spawned-hook behavior. It is **not** evidence that the Electron renderer, IPC, native window interaction, or live agent integrations work.

The product should **solidify the existing core loop**, not add feature breadth. The highest-risk problems are:

1. a pending request can be retained by the bridge but invisible after renderer startup/reload;
2. the dock can show “Approved” before the bridge accepts the decision;
3. coalesced hook IDs can make one approval resolve more than one real operation;
4. the native full-screen transparent window can intercept desktop input while a card is open;
5. the local trust boundary is weaker than “Local mode” implies.

Live proof remains open: Cursor rings, Claude Write → dock Approve → file, UX/click-through sign-off, and live Codex.

---

## Evidence levels

| Label | Meaning |
| --- | --- |
| **Confirmed** | Directly follows from current code path |
| **Contract-tested** | Proven only through the headless suite |
| **Untested assumption** | Requires Electron, real agent, or user-machine proof |
| **Intentional constraint** | Deliberately outside current product scope, not a defect |

## Expected outcomes vs evidence

| Outcome a user expects | Current evidence | Main gap |
| --- | --- | --- |
| One Claude request is noticed, understood, decided, and resumes | Contract-tested: S1–S4/S7 | Renderer/IPC/live Claude path untested |
| Two requests are not lost | Contract-tested: S9 bridge queue | Island FIFO/“N waiting” UI untested |
| Dismissing a stale card does not silently approve it | Contract-tested: S10 | Renderer confirmation/native fallback untested |
| Rings reflect actual state | Endpoint/hook mapping tested | Event ordering, renderer hydration, real liveness untested |
| RYU failure falls back to native prompt | Hook exits empty, contract-tested | Native agent response is home-only |
| User can safely approve exactly what is shown | **Not established** | ID collision/coalescing and truncated/incomplete preview |
| RYU stays out of the way until needed | **Not established** | Full-window input capture and auto-expand risk |

---

## Priority findings

### P0 — core-loop blockers

#### F1. Pending requests can be invisible after renderer startup/reload
**Confirmed**

- The bridge stores pending requests and emits `ryu:event` only when the request arrives: [`electron/bridge.ts`](../electron/bridge.ts).
- The renderer subscribes only to future IPC events; [`src/App.tsx`](../src/App.tsx) does not hydrate from `GET /pending`.
- The same gap exists for ring state: no startup read of `GET /agents`.

**Failure path:** a hook sends `/event` while the Electron renderer is loading or reloading → bridge holds the request → the hook waits → the dock never enters Attention/Understand.

**User impact:** “Claude is stuck, but RYU showed me nothing.” Dismiss is also unavailable because the card never appears.

**Fix direction:** add an authenticated renderer hydration IPC (`getPending`, `getAgentStatuses`) after subscription, then reconcile/rerender. Add a renderer reload integration test.

#### F2. The UI reports a decision before the bridge accepts it
**Confirmed**

- `App.decide()` sends IPC and immediately transitions to resolved: [`src/App.tsx`](../src/App.tsx).
- `RyuBridge.resolveDecision()` can reject an unknown/expired/dismissed ID: [`electron/bridge.ts`](../electron/bridge.ts).
- The preload decision API is fire-and-forget: [`electron/preload.ts`](../electron/preload.ts).
- Dismiss has the same optimistic local removal behavior.

**Failure path:** timeout, duplicate click, dismiss, or another resolver wins the race → bridge rejects decision → user sees an “Approved” success state anyway.

**User impact:** breaks the product’s trust promise: user cannot know their decision landed.

**Fix direction:** use `ipcRenderer.invoke` / `ipcMain.handle` with a `{ ok }` acknowledgement; only resolve/advance after success. Display a recoverable “request expired/unavailable” state on failure.

#### F3. One approval can resolve distinct real operations
**Confirmed**

- Claude IDs are derived from session, tool, command/path and only the first 64 content characters: [`hooks/ryu-hook.mjs`](../hooks/ryu-hook.mjs).
- Codex omits content from its ID input: [`hooks/ryu-codex-hook.mjs`](../hooks/ryu-codex-hook.mjs).
- The bridge intentionally resolves every waiter sharing the ID: [`electron/bridge.ts`](../electron/bridge.ts).

This was built to merge one Claude `PreToolUse` + `PermissionRequest` pair, which S7 correctly tests. It also merges independent concurrent identical requests in one session. Two file writes that differ after character 64 can therefore share one Allow.

**User impact:** approval scope is broader than the previewed action; this is a trust/safety failure.

**Fix direction:** use a per-invocation request ID supplied by the hook input when available; otherwise keep a short-lived, explicit pair-correlation key that only coalesces the known `PreToolUse` + `PermissionRequest` pair. Add collision tests.

#### F4. The overlay can block normal desktop input
**Confirmed on code path; native behavior needs home proof**

- Windows creates a transparent BrowserWindow covering the entire work area: [`electron/window.ts`](../electron/window.ts).
- Attention/expanded/resolved force native mouse interaction: [`src/island/Island.tsx`](../src/island/Island.tsx).
- When Electron ignores no mouse events, transparent pixels in a full-screen window do not reliably pass clicks through. The Mac shell additionally focuses the overlay: [`diff/mac/electron/window.ts`](../diff/mac/electron/window.ts).

**User impact:** a pending request may prevent clicking the terminal/IDE/browser outside the island; on Mac it can steal keyboard focus.

**Fix direction:** separate a small interactive card window from a click-through hit/visual window, or dynamically resize the native window to the island/card bounds. Validate on Windows and Mac before claiming the UX loop.

#### F5. “Local mode” is not a full approval security boundary
**Confirmed**

- The bridge binds to `127.0.0.1`, but `GET /pending` and `POST /decision` are unauthenticated: [`electron/bridge.ts`](../electron/bridge.ts).
- Any process on the same user account can read previews/IDs and submit an allow decision.
- Claude permits `RYU_HOST` / `~/.ryu/host` to point outside loopback: [`hooks/ryu-hook.mjs`](../hooks/ryu-hook.mjs), while the card says “All data stays on this device” in [`src/island/Expanded.tsx`](../src/island/Expanded.tsx).

**User impact:** same-machine malware/another process can approve actions; host override can exfiltrate preview metadata and accept remote decisions.

**Fix direction:** document the current local-process threat model immediately. Then bind decisions to a per-launch secret/capability and restrict production hook targets to loopback unless a future explicit remote mode exists. Validate event/decision schema and cap HTTP body size.

---

### P1 — high user-flow and reliability risk

#### F6. Attention is skipped: every request auto-expands
**Confirmed**

`Island` calls `onExpand()` whenever it sees Attention: [`src/island/Island.tsx`](../src/island/Island.tsx). The product spec says Attention is icon-first and expands on click: [`docs/product-and-feature-loops.md`](./product-and-feature-loops.md).

**User impact:** more modal/intrusive than the Dynamic Island model; the user cannot glance at the requesting agent before opening detail.

**Fix direction:** retain Attention until a click/keyboard action; decide whether urgent permissions should have a separate accessibility/attention policy.

#### F7. Understand context is incomplete and “Details” is inert
**Confirmed**

- `RyuEvent` has `sessionLabel`, but the card does not render it: [`shared/types.ts`](../shared/types.ts), [`src/island/Expanded.tsx`](../src/island/Expanded.tsx).
- “Details” is a `<button>` with no action.
- Previews are truncated in hooks; Bash is rendered as a synthetic `bash -lc` form.

**User impact:** the user cannot distinguish sessions, inspect a truncated operation, or understand what Details means before approving.

**Fix direction:** show agent + session label, disclose untruncated/safely scrollable payload where possible, or remove the dead button. Do not present a non-functional affordance in a trust-critical card.

#### F8. The watchdog can lie about a real active/waiting agent
**Confirmed behavior; appropriateness untested**

The bridge and renderer set running/approval to idle after 45 seconds without a fresh status post: [`electron/bridge.ts`](../electron/bridge.ts), [`src/island/useAgentStatuses.ts`](../src/island/useAgentStatuses.ts). Current hooks send lifecycle events, not periodic heartbeats.

**Failure path:** long command or ignored approval lasts >45 seconds → ring becomes idle/blue while the agent is still working/waiting.

**Fix direction:** either send heartbeats while a status remains active, make timeout semantics visible (“status stale”), or do not collapse approval automatically. Test refresh/long-work scenarios.

#### F9. Status and queue state are not renderer-recoverable
**Confirmed**

Beyond F1 startup loss, bridge and renderer maintain separate watchdogs/state with no reconciliation. Late lifecycle status updates can overwrite approval/error with no correlation/version ordering.

**Fix direction:** bridge should be authoritative; renderer needs snapshot + sequence/timestamp handling. Add tests for out-of-order status events and reload/reconnect.

#### F10. Verification covers a duplicate bridge, not the Electron bridge
**Confirmed**

`scripts/headless-bridge.mjs` reimplements bridge behavior rather than instantiating `RyuBridge`. Thus Track A/B do not execute Electron IPC, real `electron/bridge.ts`, preload, renderer, or native window lifecycle.

**User impact:** green tests can drift from the shipped implementation—the current finding list is evidence of that.

**Fix direction:** extract the HTTP bridge core into a shared, Electron-independent module and run the same module in Electron and headless tests. Add an Electron integration/smoke harness when environment supports it.

---

### P2 — material gaps / cleanup

| ID | Finding | Evidence / impact | Direction |
| --- | --- | --- | --- |
| F11 | HTTP request bodies are unlimited | `readBody` buffers all content in actual and headless bridge | Add byte limit + request timeout |
| F12 | Decision and Dismiss can fire twice | `onMouseDown` and `onClick` both invoke handlers in `Expanded` | Use one event; disable action while pending |
| F13 | Port conflict leaves a functional-looking disconnected dock | Electron logs `EADDRINUSE` then loads UI in [`electron/main.ts`](../electron/main.ts) | Show explicit unavailable state / retry |
| F14 | Codex “parity” is adapter-contract parity, not live product parity | S11 spawns hook directly; install format and real Codex behavior unproven | Rename/caveat accurately; home test |
| F15 | Idle conflates quiet, unavailable, uninstalled, and missed status | Only four coarse states / fallback summary | Expose bridge/adapter health + last seen |

---

## What is solid today

- Bridge/hook decision contracts pass S1–S12 in a repeatable headless process.
- Allow/deny/fail-open output shapes are asserted for Claude; Codex adapter shapes are similarly asserted.
- Dismiss returns `cancelled`, not allow, and hooks fail open.
- Cursor project hook configuration is status-only; no per-tool approval spam path is configured.
- Status posts are awaited before Claude/Codex hook exit on explicit decisions.
- Bridge binds to loopback; Electron has context isolation, Node integration disabled, and a CSP.

These are meaningful building blocks. They do not close the user-facing reliability risks above.

---

## Intentional constraints (not bugs)

- Cursor IDE is rings-only; dock approval for every Cursor tool is intentionally disabled.
- Claude is the only intended real Resume path today.
- Cursor ACP is a spike; Codex is not live-proven.
- Questions, batch/risk rules, jump-to-session, and mobile are later phases.

---

## Recommended remediation order

1. **Decision truth:** F2 decision/dismiss acknowledgement; prevent false resolved UI.
2. **Recoverability:** F1/F9 renderer snapshot/replay for pending + statuses.
3. **Approval scope:** F3 collision-safe pairing for Claude/Codex; add tests.
4. **Input safety:** F4 native click-through/focus design and a Windows/Mac proof.
5. **Trust boundary:** F5 loopback-only behavior, capability token, schema/body limits, honest Local mode copy.
6. **Understand UX:** F6 no auto-expand; F7 session/detail/preview clarity.
7. **Signal reliability:** F8 heartbeat/stale status policy plus status ordering.
8. **Test architecture:** F10 share bridge core; add renderer/Electron integration tests.
9. **Health polish:** F13/F15 availability and adapter-state UI.

## Home validation after remediation

Keep existing `docs/RESUME.md` checks, then add:

1. Start RYU and immediately trigger a Claude Write while the dock is still loading; card must appear.
2. Reload the renderer during a pending request; card must return from pending snapshot.
3. Click Allow/Deny only once; success UI must appear only after acknowledgment.
4. With a card open, click desktop/terminal outside the dock; input must pass through.
5. Leave an approval or long-running task past watchdog duration; display must remain truthful by chosen policy.
6. Trigger two similar writes in one session; they must not share a decision unless they are the known paired hook events.

