# RYU — Product & Feature Loops

**Status:** Locked direction for ideation → demo → build (not yet implementing).  
**Date:** 2026-07-19  
**Based on:** [overview.md](./overview.md) · [competitor-research.md](./competitor-research.md) · [pain-points-and-mvp.md](./pain-points-and-mvp.md) · product discussion (permissions-first, Apple-style island UX, demo-before-function)

---

## 1. Product north star

**When an agent is blocked waiting on a human, the user notices, understands the ask, decides, and unblocks — without hunting for the right tab.**

RYU is an **attention + decision surface**, not a dashboard, orchestrator, or multi-agent IDE.

We perfect the **core loop** first, then expand outward in phases. Competitive wedges (Windows-first, Cursor APIs, mobile, batch) come *after* the loop feels inevitable.

---

## 2. Core product loop (the spine)

This is the only loop that must feel magical. Everything else is a variant or multiplier of it.

```text
IDLE (ambient, quiet)
  → ATTENTION (something needs you)
    → UNDERSTAND (what / which agent / what permission)
      → DECIDE (Allow / Deny)
        → RESUME (agent continues; surface returns to calm)
```

### Loop stages (definition of “done” for each)

| Stage | User experience | Success look/feel |
| --- | --- | --- |
| **Idle** | Compact island / pill present but ignorable | You forget it’s there until you need it |
| **Attention** | Agent icon appears with a clear “needs you” signal (circular glow / pulse) | Impossible to miss when waiting; silent when not |
| **Understand** | Island expands enough to show session + permission preview | You can decide without opening the agent |
| **Decide** | Allow / Deny are obvious and one-tap | Decision feels instant and intentional |
| **Resume** | Agent continues; island collapses back to idle | Trust that the action actually landed |

### What we are optimizing for

1. **Signal quality** — notice without spam  
2. **Preview trust** — enough context to Allow safely  
3. **Decision reliability** — Allow/Deny actually unblocks (once functional phases start)

If any of those three is weak, the product fails — regardless of how many agents we support later.

---

## 3. Feature loops

Feature loops are smaller cycles that sit inside or around the product loop. Phase them; do not ship all at once.

### 3.1 Permission decision loop — **v1 / Phase 0–1 (core)**

**Trigger:** Agent hits a tool permission (`PermissionRequest` / equivalent).  
**Surface:** Island attention → expand → preview.  
**Actions:** Allow once · Deny.  
**Outcome:** Decision returned to agent; island returns to idle (or next item later).

This is the **only** ask-type in early phases.

### 3.2 Attention / presence loop — **Phase 0 (visual) → Phase 1 (wired)**

**Trigger:** Pending permission exists (or demo event).  
**Surface:** Compact → agent icon + circular light/glow.  
**Actions:** Tap / click to expand (and later, optional sound).  
**Outcome:** User is pulled into Understand without leaving their current app.

### 3.3 Collapse / return-to-calm loop — **Phase 0–1**

**Trigger:** User decides, dismisses, or timeout (later).  
**Surface:** Expanded → compact idle.  
**Outcome:** Island does not stay “loud” after the moment passes.

### 3.4 Question / AskUserQuestion loop — **later phase (logged)**

**Trigger:** Agent asks a human question (not a bash/tool permission).  
**Surface:** Same attention → expand pattern.  
**Actions:** Answer inline (choices / short text — TBD).  
**Outcome:** Agent continues with the answer.

> **Logged for build-out:** v1 is **permissions only**. Expand to **questions** only after the permission loop is solid in UX demo + functional form. Do not design question UI in Phase 0 beyond leaving space in the phase plan.

### 3.5 Multi-item queue loop — **later phase**

**Trigger:** More than one permission waiting.  
**Surface:** Badge / second minimal bubble / “2 waiting”.  
**Actions:** Decide current → next item auto-presents.  
**Outcome:** Same Decide interaction, repeated.

> **Logged:** Phase 0–1 start with **one** pending item only. Queue comes after single-item feels right.

### 3.6 Jump-to-session loop — **later phase (fallback)**

**Trigger:** Preview isn’t enough to decide safely.  
**Surface:** “Open session” from expanded island.  
**Outcome:** Focus the right terminal/IDE; approve there if needed.

Primary path remains **decide in place**. Jump is a safety valve, not the hero.

### 3.7 Risk / batch loops — **later phases**

- Risk coloring (destructive command → stronger visual warning)  
- Allow always / batch safe ops  

These amplify power users but introduce footguns. Ship only after core trust is earned.

### 3.8 Multi-agent adapter loop — **later phases**

Same product loop; new event sources (second CLI, then more). Adapters are plumbing around an unchanged UX spine.

### 3.9 Away-from-desk / mobile loop — **much later**

Same decision payload on another surface (push / phone). Not part of early phases.

---

## 4. User flow (v1 mental model)

### Happy path (permissions, single item)

1. User is working in another app (browser, Figma, slides, another IDE).  
2. An agent (e.g. Claude Code / Codex / Cursor agent) needs permission to run a tool.  
3. RYU island draws attention: **agent icon + circular glow** (Apple-style “something is live / needs you”).  
4. User clicks / taps the island.  
5. Island **expands** to show:  
   - Which agent / session  
   - That this is a **permission**  
   - Command or path preview (truncated safely)  
   - **Allow** · **Deny**  
6. User chooses Allow or Deny.  
7. Island acknowledges briefly, then **collapses** to idle.  
8. Agent continues (functional phases) or demo simulates continue (Phase 0).

### Idle path

- No pending permission → island is minimal / dormant (thin pill or empty notch stand-in).  
- No spam animations.

### Unhappy / trust paths (design for these even if Phase 0 only fakes them)

| Situation | UX intent |
| --- | --- |
| Preview too scary / unclear | User Denies, or later uses Open session |
| User ignores attention | Island stays in attention state until resolved (persistent, not a vanishing toast) |
| Bridge/UI down (functional) | Fail open to agent’s normal prompt — never silent auto-allow |

---

## 5. UX direction — Apple Dynamic Island as the reference

We are not inventing a new interaction language. We borrow Apple’s **Dynamic Island / Live Activities** system: compact presence → attention → expand for detail + actions → collapse.

### Official / primary references

| Reference | What to steal |
| --- | --- |
| [Apple HIG — Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities) | **Compact**, **Minimal**, **Expanded** presentations; alert only for essential updates; expanded for detail + controls |
| [Apple HIG — Live Activities (system experiences)](https://developer.apple.com/design/human-interface-guidelines/components/system-experiences/live-activities) | Minimal can appear **circular/oval** when space is tight; tap vs expand behaviors |
| [MacRumors — Dynamic Island guide](https://www.macrumors.com/guide/dynamic-island/) | Background activity + alerts; tap to open; long-press / hold to expand controls |
| [iGeeksBlog — How to use Dynamic Island](https://www.igeeksblog.com/how-to-use-dynamic-island-on-iphone/) | Gesture table: tap, long-press expand, swipe collapse / switch |
| Incoming **Phone call** island pattern | Expands with identity + **Accept / Decline** — closest analogue to **Allow / Deny** |
| **AirDrop** island pattern | Pulsing circles / progress ring around activity — closest analogue to **circular light around icon** while “something is happening / needs you” ([icon decoding overview](https://www.themobilebase.ca/blogs/news/decoding-the-icons-on-your-iphones-dynamic-island-a-complete-guide)) |

### RYU visual states (map to Apple)

| RYU state | Apple analogue | Visual brief |
| --- | --- | --- |
| **Idle** | Empty / resting island | Compact dark pill; no glow; low visual weight |
| **Attention (pending permission)** | Minimal / alert + activity icon | **Agent app icon** centered; **circular glow / pulse ring** around it (AirDrop-like “live” energy, not a toast banner) |
| **Expanded (decide)** | Expanded Live Activity / call controls | Wider island: icon + session label + permission preview + **Allow / Deny** |
| **Resolved** | Activity ends / collapses | Brief success/deny flash optional → back to Idle |

### Interaction model (desktop translation of Apple gestures)

| Apple | RYU (desktop) |
| --- | --- |
| Activity appears in island automatically | Pending permission → Attention state |
| Tap island → open app | Click → **Expand** (primary); optional secondary “Open session” later |
| Touch & hold → expanded controls | Click expand *is* the control surface (Allow/Deny live here) |
| Alert for essential updates | Permission waiting = essential; use glow + optional soft sound |
| Don’t alert for trivial updates | No glow for “agent is merely thinking” in v1 |

### UX principles (non-negotiable)

1. **Icon-first attention** — at Attention, the first read is *which agent*, not a paragraph of text.  
2. **Circular light = “needs you”** — glow/pulse is reserved for pending human input, not ambient “running”.  
3. **Expand for trust** — commands appear only in Expanded; never force Allow blind.  
4. **Two actions only in v1** — Allow · Deny. No Always / Batch yet.  
5. **Persistent until resolved** — behaves like a Live Activity, not a disappearing OS toast.  
6. **One job per state** — Idle / Attention / Expanded each have one purpose (see research “one job per section”; apply to island states).

### What Phase 0 demo must prove visually

Even with **no real agent hooks**, a viewer should feel:

> “That’s the same language as iPhone Dynamic Island — an icon lit up when something needs me, expand to act, collapse when done.”

---

## 6. Phasing plan (demo first, then function)

We split “what it looks/feels like” from “how it works under the hood.”

### Phase 0 — UX / product demo (look & feel only)

**Goal:** Lock the visual and interaction language of the core loop.  
**Not in scope:** Real hooks, real approvals, real multi-agent plumbing.

| Deliverable | Detail |
| --- | --- |
| Floating island UI | Top-center pill (Windows and/or Mac stand-in) |
| State machine (simulated) | Idle → Attention → Expanded → Resolved → Idle |
| Attention visual | Agent icon + circular glow/pulse |
| Expanded visual | Fake permission preview + Allow / Deny |
| Demo harness | Buttons or scripted timeline to fire fake events |
| Motion | Island morph expand/collapse; glow breathe; optional soft chime |

**Success criteria:** Stakeholder can watch a 60–90s demo and say “yes, that’s the product” without any live agent.

**Agent coverage:** One fictional agent identity (e.g. Claude / Codex icon) is enough.

---

### Phase 1 — Core loop functional (one agent, one permission)

**Goal:** Make Expand → Preview → Allow/Deny → Resume **real** for a single agent integration.

| Deliverable | Detail |
| --- | --- |
| One agent adapter | Claude Code *or* Codex (pick at build time) |
| Hook → local bridge → UI | Permission events drive Attention |
| Allow/Deny write-back | Decision reaches the agent |
| Fail-open | If RYU down, agent falls back to normal prompt |
| Keep Phase 0 UX | Same states; replace fake events with live ones |

**Still out:** Questions, queue, jump-to-session, batch, mobile, Cursor IDE Multitask deep integrate.

---

### Phase 2 — Parallel reality (still permissions)

- More than one pending permission (queue / badge)  
- Same Decide interaction, repeated  
- Optional: second agent adapter  

---

### Phase 3 — Questions loop *(logged expansion)*

- AskUserQuestion / equivalent in the same Attention → Expand pattern  
- Answer UI (choices / short text)  
- Permissions remain the default “loud” attention; questions share the surface

---

### Phase 4 — Trust & power

- Open session (jump-back)  
- Risk coloring for destructive commands  
- Allow once vs Always (careful)  
- Cautious batch for low-risk ops  

---

### Phase 5 — Reach

- Additional agents (Cursor CLI / others as feasible)  
- Platform polish (true Mac notch vs Windows overlay)  
- Away-from-desk / mobile channel  

---

## 7. Phase backlog log (explicit “do later” list)

Use this when asking to “build out the next phase” so scope doesn’t collapse into Phase 0.

| ID | Item | Earliest phase |
| --- | --- | --- |
| L1 | Questions / AskUserQuestion loop | Phase 3 |
| L2 | Multi-pending queue / badge | Phase 2 |
| L3 | Second+ agent adapters | Phase 2–5 |
| L4 | Open session / jump-back | Phase 4 |
| L5 | Always Allow / batch / risk tiers | Phase 4 |
| L6 | Plan-review style approvals | Phase 3–4 |
| L7 | Mobile / push HITL | Phase 5 |
| L8 | Cost/quota chrome | Phase 5+ |
| L9 | Cursor IDE Multitask external approve (if APIs allow) | Phase 5 (spike earlier only as research) |

**v1 commitment:** Permissions only · single pending item · Apple-like icon + circular light → expand → Allow/Deny.

---

## 8. What we must perfect before anything else

Ordered craft priorities:

1. **Attention visual** — icon + circular glow reads as “needs you” in &lt;1 second  
2. **Expand motion** — feels like Apple island morph, not a modal dialog  
3. **Preview clarity** — session + command readable; Deny always available  
4. **Allow/Deny affordance** — two clear actions; no clutter  
5. **Return to calm** — collapse timing; no leftover anxiety UI  
6. *(Functional)* **Decision reliability** — Allow really continues the agent  

Do not spend Phase 0 time on multi-agent matrices, settings pages, or wedge positioning copy inside the UI.

---

## 9. Why this plan (short)

| Decision | Why |
| --- | --- |
| Permissions before questions | Same spine; permissions are the painful blocker and simpler binary actions |
| Demo (Phase 0) before function (Phase 1) | Align on feel before hook complexity burns time |
| One pending item first | Perfect a single Expand→Decide before queue UX |
| Apple Dynamic Island language | Users already know compact → glow → expand → act → collapse |
| Core loop before wedges | Research shows competitors win on loop polish; wedges are distribution |

---

## 10. Next step (when you say go)

**Phase 0 only:** build an interactive visual demo of Idle → Attention (icon + circular light) → Expanded (permission + Allow/Deny) → Idle, with a scripted fake permission event — no agent integration yet.

When Phase 0 is signed off, move to Phase 1 functional wiring per this doc.
