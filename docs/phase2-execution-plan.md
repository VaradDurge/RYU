# Phase 2 execution plan — truthful, usable surface

**Status:** remote implementation done — `npm run verify:phase2-surface` PASS.  
**Home validation:** [`HOME-PHASE2.md`](./HOME-PHASE2.md) (keep [`HOME-PHASE1.md`](./HOME-PHASE1.md) open).  
**Source:** [`core-loop-failure-analysis.md`](./core-loop-failure-analysis.md) F6–F9, F12–F15 and [`core-loop-remediation-plan.md`](./core-loop-remediation-plan.md).

## User goal

> RYU should be quiet when nothing needs me, clear when something does, and honest when it is uncertain or disconnected. I should know which agent/session is asking, what I am approving, and whether the displayed state is current.

This phase improves the **presentation/truth** of the existing permission loop. It does not add questions, batch approval, mobile, or a Cursor IDE approval gate.

## Phase 2 success contract

| ID | User-observable outcome | Must not happen |
| --- | --- | --- |
| P2.1 | A new request first shows compact, icon-first Attention; user intentionally opens details | Card auto-opens as a modal-like interruption |
| P2.2 | Card identifies agent + session and provides useful, working context disclosure | Dead Details button / ambiguous session / blind truncation |
| P2.3 | Long work or an ignored request becomes visibly **stale**, not falsely idle | Blue/idle while RYU lacks fresh evidence |
| P2.4 | Late/out-of-order status events cannot overwrite newer state | Old idle/running event erases an active approval/error |
| P2.5 | Idle is distinguishable from bridge unavailable, adapter inactive, and stale status | “Idle” hides a broken integration |
| P2.6 | Each click dispatches one acknowledged action | Duplicate action dispatch/regression |

## Out of scope

- Questions / AskUserQuestion
- Allow always, batch, risk policy
- Cursor approve-every-tool
- New agent integrations
- Mobile/push
- Phase 3 Electron/live proof work beyond keeping its home checklist current

---

## Execution order

1. **P2.4 status data model first** — all UI truth depends on ordered state.
2. **P2.3 stale state + heartbeat policy** — do not silently map uncertainty to idle.
3. **P2.5 bridge/adapter health** — make unavailable/inactive states legible.
4. **P2.1 deliberate Attention** — use improved truth state in compact dock.
5. **P2.2 Understand card** — add context without widening approval scope.
6. **P2.6 action regression** — preserve Phase 1 acknowledgement behavior.
7. Run remote suite, then update home checklist; do not claim live sign-off.

---

## P2.4 — Ordered status model

**Findings:** F9  
**User goal:** “The latest real agent state wins.”

### Build
- Extend status updates with bridge-assigned `revision` and `receivedAt`.
- Keep bridge as authoritative: renderer receives snapshots + live revisions and ignores revisions older than its per-agent latest revision.
- Do not trust client wall-clock time for ordering; bridge receive order is the baseline.
- Preserve decision/permission precedence:
  - an active pending permission remains `approval` until resolved/dismissed/explicitly stale;
  - a generic late lifecycle `idle` cannot clear it.
- Centralize status application in one pure reducer usable by renderer and tests.

### Remote acceptance
- `running → approval → late idle` results in `approval`.
- `approval → deny/error → late running` results in error until settle policy.
- Snapshot revision followed by older live update is ignored.
- Newer live update applies once.
- Existing Track A/B/Phase 1 tests remain green.

### Home-only check
- Trigger a permission while Cursor/Claude emits lifecycle events; yellow must not flip blue before decision.

---

## P2.3 — Honest liveness: stale, heartbeat, and timeout policy

**Findings:** F8  
**User goal:** “Blue means known idle; stale means RYU no longer knows.”

### Product decision

Add a `stale` live status (distinct neutral/gray ring + “Status stale” label). Do **not** convert `running` or `approval` directly to idle after a timer.

### Build
- Add `stale` to shared types, dock styling, hover summary, bridge snapshots, and renderer state.
- Bridge timeout policy:
  - `running` without refresh → `stale`;
  - `approval` without refresh → `stale`, while its pending card remains actionable;
  - only explicit agent stop/session-end or resolved request → `idle`.
- Add light status heartbeats where the adapter can honestly supply them. Do not fabricate heartbeats from UI timers.
- Document each adapter’s liveness source:
  - Cursor: lifecycle updates;
  - Claude/Codex: lifecycle/permission hook updates;
  - no source → stale.

### Remote acceptance
- Running and approval expire to `stale`, never idle.
- Pending remains on `/pending` after approval becomes stale.
- Explicit idle clears stale.
- A fresh status refreshes stale to running/approval.
- Status reducer and watchdog tests run with short timeout overrides.

### Home-only check
- Let a long operation and an ignored approval run beyond timeout; ring becomes gray/stale with clear copy, never silently blue.

---

## P2.5 — Bridge and adapter health

**Findings:** F13, F15  
**User goal:** “I can tell calm from broken.”

### Build
- Add a read-only renderer health snapshot:
  - bridge started / unavailable;
  - port/start error reason (e.g. `EADDRINUSE`);
  - per-agent `lastSeenAt`, latest source, and integration state (`unknown`, `active`, `stale`, `not-configured`).
- Avoid a settings dashboard. Put compact health language in existing hover/status card and a dev-only diagnostics view.
- When bridge fails to start, do not leave a normal-looking interactive dock; surface a small unavailable indicator in development and clear console/log instruction in production.
- Define “not configured” conservatively: only assert it if installer/config evidence exists; otherwise show `unknown`.

### Remote acceptance
- Bridge healthy snapshot has `started`.
- Simulated start failure yields unavailable state without fabricated idle.
- Never-seen adapter is `unknown`, not idle.
- Last seen timestamps / revisions update on authenticated status posts.

### Home-only check
- Start a second RYU instance / occupy port, then confirm the primary UI reports unavailable rather than pretending idle.

---

## P2.1 — Deliberate Attention

**Findings:** F6  
**User goal:** “I notice who needs me, then choose to inspect.”

### Build
- Remove automatic `onExpand()` when a new event enters Attention.
- Compact Attention must show the requesting agent’s icon + reserved glow/ring; no command text required at this level.
- Click/keyboard activation expands. Preserve accessibility focus order and reduced-motion behavior.
- Queue semantics:
  - compact state shows current agent + count;
  - expanding shows current request;
  - resolving advances to next Attention, not automatically expanded.
- Do not weaken persistent Attention: request remains visible until resolved/dismissed/stale policy applies.

### Remote acceptance
- Reducer/event test: new event enters `attention`, not `expanded`.
- Explicit expand enters `expanded`.
- Resolve current with queue → next is `attention`.
- Reduced-motion snapshot/props preserve state behavior.

### Home-only check
- Assess glanceability from normal IDE use: recognizable within one second, not visually intrusive.

---

## P2.2 — Complete Understand card

**Findings:** F7  
**User goal:** “Before I approve, I know which session and operation this is.”

### Build
- Render `agent`, `sessionLabel`, tool, path, and preview in the card.
- Replace inert **Details**:
  - either implement a compact disclosure that reveals available structured fields; or
  - remove it entirely if no additional truthful detail exists.
- Keep preview safety:
  - do not send arbitrary unbounded tool input to the renderer just to fill Details;
  - carry a bounded, structured `detail` field with explicit byte limit;
  - preserve canonical command/path text rather than synthesizing a different command representation.
- Make truncation visible (“truncated”) with a way to read the bounded complete detail if present.
- Ensure risk language remains informational only; risk policy remains Phase 4.

### Remote acceptance
- Card model includes session label and path/tool.
- Details is either actionable or absent—never a button without behavior.
- Long structured detail is bounded, marks truncation, and does not affect authorization identity.
- Existing decision payload and Phase 1 pairing tests stay unchanged.

### Home-only check
- Review two similar sessions and a long command/path; user can identify the correct request without opening terminal.

---

## P2.6 — Action integrity regression

**Findings:** F12  
**User goal:** “One click means one deliberate action.”

### Build / verify
- Retain one handler per control, disabled in-flight controls, and Phase 1 bridge acknowledgement.
- Add renderer/pure-state tests for repeated click attempts:
  - first action starts;
  - second ignored while pending;
  - failed acknowledgment leaves card actionable with error;
  - accepted acknowledgment resolves once.

### Remote acceptance
- Test action reducer state and mocked IPC result sequence.
- Verify `Expanded` source/component does not bind both `onMouseDown` and `onClick` to action dispatch.

---

## Test deliverables

Add one command:

```bash
npm run verify:phase2-surface
```

It must:

1. Run pure status/attention/card/action reducers.
2. Start the shared headless bridge core for stale/health/snapshot fixtures.
3. Run `verify:phase1-remediation` and `verify:track-b` as regression gates, or provide an equivalent combined command.
4. Exit non-zero on any failure and print P2.1–P2.6 labels.

## Documentation/memory deliverables

- Update `memory/status.md` and `memory/product-loops.md` with only verified changes.
- Log lessons for any ordering/staleness edge case found.
- Update `docs/HOME-PHASE1.md` or add `docs/HOME-PHASE2.md`; retain all unresolved Phase 1 checks.
- Do not mark an adapter live/proven because a spawned hook test passed.

## Model handoff note

This is a **model-neutral** plan. Any coding model must:

1. Read `AGENTS.md`, `memory/index.md`, `tasks/to-do.md`, Phase 1 plan/results, and this file first.
2. Implement only P2.1–P2.6—do not pull Phase 3 proof or new features forward.
3. Start with pure test cases and the `verify:phase2-surface` skeleton before UI changes.
4. Keep bridge status ordering authoritative and use revisions; do not solve races with renderer-only timers.
5. Never change an uncertain state to idle merely to make the dock look calm.
6. Preserve: authenticated loopback bridge, fail-open, decision acknowledgement, unique request identity, constrained pairKey, and Cursor status-only rule.
7. Keep “Details” truthful and bounded; never expose raw unbounded tool payloads for visual polish.
8. Update memory, tasks, lessons, and PR after each logical change; explicitly label remote versus home-only evidence.

**Suggested implementation prompt**

> Implement Phase 2 only from `docs/phase2-execution-plan.md`. Write P2.1–P2.6 acceptance tests first and add `npm run verify:phase2-surface`. Preserve all Phase 1 trust invariants in `AGENTS.md`. Make bridge revisions authoritative; use `stale`, never false idle. Do not add Questions, batch/risk, mobile, or a Cursor approval gate. Keep a strict split between headless evidence and home-only Electron/live-agent checks.
