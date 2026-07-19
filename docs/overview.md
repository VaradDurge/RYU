# RYU — Research Overview

**Date:** 2026-07-19  
**Product thesis:** A Mac Dynamic Island–style notch / Windows widget that monitors parallel coding agents (Cursor, Claude Code, Codex, etc.), notifies when they need attention (especially approvals), shows *what* is being asked, and lets the user approve/deny without switching tools.

**Companion docs:** [competitor-research.md](./competitor-research.md) · [pain-points-and-mvp.md](./pain-points-and-mvp.md)

---

## 1. One-line verdict

**This idea is real — and on Mac it is already a crowded niche.** Several paid and open-source products already do “agent Dynamic Island + approve from the notch.” The opportunity for RYU is **not** “nobody built this.” It is a **wedge**: Windows-first island UX, Cursor Multitask reliability, risk-aware batch triage, or a ruthlessly simple multi-agent attention layer that ships faster than cloning Vibe Island.

---

## 2. What RYU is trying to solve

Developers rarely run one agent in one tab. They run Cursor + Claude Code + Codex (and more) in parallel, then context-switch into browsers, Figma, meetings, or other repos. Agents freeze on permission prompts; the human comes back minutes later to idle compute and stalled work.

**Desired loop:**

1. Ambient surface always visible (notch / floating pill / widget).  
2. Surface expands when an agent needs the human.  
3. User sees session + tool + command/question preview.  
4. User Allow / Deny (or answer) from that surface.  
5. Agent continues; user never hunted for the right tab.

That loop is the product. Dashboards, cost charts, and 26-agent matrices are secondary.

---

## 3. Market summary (what exists today)

| Tier | What | Reality for RYU |
| --- | --- | --- |
| **A — Direct** | Mac notch apps: Vibe Island, CodeIsland, Open Island, AgentPulse, Ping Island, Claude Island/Vibe Notch, Clotch, Claude Pulse | Same job-to-be-done; Mac is saturated |
| **B — Adjacent HITL** | Pushary, ntfy-approve, ClaudeBeep, claude-notch-windows, claude-code-notify, Code Light AI | Same pain, different surface (phone / tray / toast / status light) |
| **C — Pattern only** | NotchNook, Raycast monitors, lazyclaude, claude-code-dashboard | UX or multi-session ideas; not the full product |

**Honest takeaway:** Pitching “first Dynamic Island for agents” will get fact-checked. Pitching “Windows attention + approve layer” or “Cursor Multitask inbox that actually works” is more credible.

Full profiles, loops, and sentiment live in [competitor-research.md](./competitor-research.md).

---

## 4. Shared architecture (almost everyone converges here)

```
Agent CLI / IDE
  → hooks / PermissionRequest / JSONL / app-server
    → local bridge (Unix socket | localhost HTTP | file watch)
      → notch / tray / toast / phone UI
        → Allow / Deny returned to agent
```

**Implications for RYU:**

- The hard work is **reliable per-tool hooks**, **trustworthy preview**, and **fail-open behavior** — not inventing the island metaphor.  
- Mac peers use Unix sockets; Windows peers use localhost HTTP + tray/overlay.  
- Hook-free monitoring (Clotch, dashboards) is easier but weak for approve-in-place.  
- Approving from a remote/phone/notch is a **security surface** (command text leaves the TTY). Design for localhost-only, timeouts, and never silent-auto-allow.

---

## 5. Pain stack (what to prioritize)

Ranked for RYU’s wedge (detail + sources in [pain-points-and-mvp.md](./pain-points-and-mvp.md)):

| Rank | Pain | Why it matters |
| ---: | --- | --- |
| 1 | Missed approvals → idle agents | Core “never miss” promise; measurable idle minutes |
| 2 | Approve/deny in-place with preview | Completes the loop without alt-tab |
| 3 | Unified multi-session queue | 3–6+ agents is the real power-user mode |
| 4 | Jump back to the right session | Fallback when preview isn’t enough |
| 5 | Risk-tiered batching | Stops users from YOLO `--dangerously-skip-permissions` |
| 6 | Cursor Multitask approval bugs | Sharp differentiation *if* integration is feasible |
| 7 | Mobile / away-from-desk HITL | Phase 2; Pushary/ntfy already occupy this |
| 8 | Cost / quota across agents | Adjacent chrome, not the demo |

**Do not prioritize first:** Devin-style orchestration IDE, media-notch features, supporting 20+ agents on day one, desktop pets as the product.

---

## 6. Insights specific to RYU (keep these front-of-mind)

### Positioning

1. **Do not claim novelty of the category.** Claim a **gap**: Windows island quality, Cursor reliability, or safety-aware triage.  
2. **Mac head-to-head with Vibe Island is a trap** for a short build — polish, agent breadth, and social proof are their moat.  
3. **This workspace is Windows.** Fastest demo path is a floating top-center pill + tray, not a Swift notch clone.  
4. **“Control from any screen”** is the emotional pitch; the technical pitch is “HITL bridge with ambient UI.”

### Product principles

5. **Attention is the product**, not a dashboard. Stay compact until something needs a human (Ping Island / island pattern).  
6. **Fail open:** if RYU or the bridge is down, the agent must fall back to its normal prompt — never silently auto-approve.  
7. **Preview is trust:** show project/session + tool + truncated command; red-flag destructive patterns.  
8. **Questions ≠ bash only:** AskUserQuestion / plan review are part of the same attention queue.  
9. **Batch carefully:** “Approve all” without risk tiers recreates the skip-permissions footgun Claude Pulse warns about.  
10. **One integration deep beats five shallow** for v0 — pick Claude Code *or* Codex CLI hooks first; defer Cursor IDE Multitask until APIs are clear.

### Feasibility flags (high priority)

11. **Cursor IDE Multitask external approve is the biggest unknown.** Forum threads show stuck “Waiting for approval” and missing Allow UI. CLI hooks are proven; IDE chrome may not expose a clean external channel. Do not promise Cursor in a 5-hour MVP.  
12. **Hook fragility is a support tax.** Claude/Codex updates break `settings.json` hooks; Clotch exists because of this. Plan for a demo harness / fake event injector.  
13. **Windows has no hardware notch API.** “Island” = always-on-top overlay + animation. Study `claude-notch-windows`, ClaudeBeep, `claude-code-notify`.  
14. **Security narrative matters in a demo.** Localhost-only, show full command, Deny default on timeout is a feature, not a footnote.  
15. **OSS exists to fork.** Open Island / CodeIsland / AgentPulse are implementation references; greenfield Mac Swift is optional ego, not required learning.

### Competitive wedges that still look open

| Wedge | Why it’s still open | Risk |
| --- | --- | --- |
| **Windows-first multi-agent island** | Mac has Vibe/CodeIsland; Windows is tray/toast/Claude-only overlays | UX polish bar; packaging time |
| **Cursor Multitask reliability layer** | Real forum pain; Mac islands help CLIs more than broken IDE chrome | May lack public APIs |
| **Risk-aware batch inbox** | Requested in Anthropic issues; few products do it well | Safety product design depth |
| **Unified Claude + Codex + Cursor CLI** with one queue | Many apps claim multi-tool; depth varies | Hook matrix maintenance |
| **Desktop + optional mobile** | Pushary owns phone; notch owns desk — combo is thin | Scope creep |

### Narrative that works for judges / posts

> “Mac already has Vibe Island. We built the attention layer for people who live in parallel agents on Windows — see the approval, decide from the pill, keep shipping.”

Or, if Mac-capable later:

> “We’re not another 26-agent matrix. We’re the risk-aware inbox: safe ops batch, dangerous ops stop the island.”

---

## 7. Recommended direction (near-term)

| Horizon | Focus |
| --- | --- |
| **~5 hours** | Windows floating pill + one CLI (Claude Code or Codex) + Allow/Deny + sound/toast + **scripted demo mode**. See [pain-points-and-mvp.md](./pain-points-and-mvp.md). |
| **Next** | Second CLI, best-effort window focus, risk color on destructive commands. |
| **Later** | Multi-agent queue, Cursor exploration, optional mobile channel, Mac port or Open Island fork. |

**Success criterion for any demo:** Judge sees an approval UI *outside* the agent, understands the preview, clicks Allow/Deny, and believes the agent unblocked — while acknowledging Mac competitors and stating RYU’s wedge in one sentence.

---

## 8. What “done” looks like for this research package

- [x] Market scan: direct + adjacent products documented  
- [x] Pain prioritization with sources  
- [x] Ruthless MVP scope for a short build  
- [x] Consolidated into three docs for decision-making  

**Next step after you review these docs:** pick the wedge (Windows island vs Cursor vs risk-inbox), pick the first agent integration, then scaffold the bridge + pill UI.
