# RYU — Pain Points & MVP Scope

**Date:** 2026-07-19  
**Purpose:** What developers complain about in multi-agent workflows, what RYU should prioritize, and how to ship something demoable fast (~5 hours as a forcing function, not a hard ceiling).

**Companion docs:** [overview.md](./overview.md) · [competitor-research.md](./competitor-research.md)

---

## Part A — Pain points

### Context

Power users run several agents at once (Cursor tabs, Claude Code sessions, Codex, cloud agents). Permission prompts and questions pause work. Humans are in another Space, browser, or meeting. Idle time compounds with session count. Coping strategies (`--dangerously-skip-permissions`, “approve all”) trade safety for speed until something destructive happens.

Sources below mix GitHub issues, Cursor forum threads, HN Show HNs, product blogs, and OSS README framings (2025–2026).

---

### P0 — Solve first

#### 1. Missed approvals = idle agents (and wasted spend)

Agents pause on tool permission; humans are elsewhere. Idle minutes stack across sessions.

- Claude Pulse claims ~8–15 approvals/hour/session; missed approvals average ~10 min idle: https://claudepulse.app/blog/hidden-cost-of-missed-approvals  
- OSS READMEs (Vibe Island category, CodeIsland, AgentPulse, lazyclaude) all lead with “I was babysitting terminal tabs.”

**Product implication:** Ambient, persistent “needs you” signal + approve-in-place beats another dashboard tab.

#### 2. No unified attention inbox across parallel sessions

Power users run 3–6+ agents. Sidebar dots and terminal bells don’t scale.

- Anthropic: batch permission triage across sessions — https://github.com/anthropics/claude-code/issues/58247  
- Anthropic: “Football Manager–style news inbox” for multi-agent — https://github.com/anthropics/claude-code/issues/45609  
- HN dashboard Show HN: https://news.ycombinator.com/item?id=47314375  

**Product implication:** One queue ranked by risk/urgency; session label + command/diff preview.

#### 3. Context-switching tax to *find* the right session

A toast that says “Terminal wants attention” still leaves users hunting the tab/pane/tmux window.

- lazyclaude: prompts block unless you’re in the right window  
- Mac notch apps compete on **precise terminal jump**  
- Windows: claude-code-notify jump-to-tab  

**Product implication:** Jump-back is half the feature; approve-without-jump is the other half.

#### 4. Cursor Multitask / subagent approval UI is unreliable

Users report agents stuck on “Waiting for approval” with missing or out-of-sync Allow buttons; side pane doesn’t badge “needs attention.”

- https://forum.cursor.com/t/background-subagent-can-get-stuck-when-permission-prompt-disappears-and-the-agent-list-does-not-show-that-attention-is-required/161539  
- https://forum.cursor.com/t/no-approve-dialog-though-agent-wait-for-the-approval/157685  
- https://forum.cursor.com/t/sub-agent-approval-buttons-shown-in-3-places-inline-status-line-drill-in-pop-up-get-out-of-sync/163013  
- https://forum.cursor.com/t/mcp-tool-stuck-on-waiting-for-approval-with-no-approve-option/150574  

**Product implication:** If RYU can *reliably* surface Cursor approvals, that’s a sharper wedge than cloning Vibe Island for Claude CLI on Mac.  
**Feasibility risk:** public external approve APIs for Cursor IDE Multitask are unclear; CLI hooks are the proven path.

---

### P1 — High value, slightly secondary

#### 5. Dangerous “skip permissions” / “approve all” coping strategies

Users disable safety because friction > fear — until an `rm -rf` day.

- Called out in Claude Code feature requests (#45609)  
- Claude Pulse argues against naïve batch approve  

**Product implication:** Risk-tiered actions (safe batch vs destructive single-confirm).

#### 6. Notification fatigue / generic OS notifications

“Terminal wants attention” without session/command context becomes ignored noise; Focus modes / fullscreen suppress banners.

**Product implication:** Rich payload + persistent island state, not only toasts.

#### 7. Away-from-desk / mobile HITL

Long jobs continue while the user walks away; terminal prompt sits for 30+ minutes.

- Pushary, ntfy-approve, HN: https://news.ycombinator.com/item?id=47111171  

**Product implication:** Phase-2 channel; desktop island first unless the demo *is* mobile.

#### 8. Subagents / teams can’t ask the human

AskUserQuestion gaps in spawned sessions reduce swarm efficiency.

- HN: https://news.ycombinator.com/item?id=48320233  

**Product implication:** Notch should handle **questions**, not only bash allow/deny.

---

### P2 — Important later

| # | Pain | Notes |
| --- | --- | --- |
| 9 | Cost / quota blindness across parallel agents | Adjacent category (Raycast, Vibe quotas, dashboards) |
| 10 | Trust, audit, secret exposure | Approving from phone/notch leaks command text; governance proxies (e.g. Bulwark) are a separate layer |
| 11 | Hook fragility / update breakage | Why Clotch’s hook-free approach exists |
| 12 | Remote SSH / multi-machine agent farms | CodeIsland remote, Vibe SSH, Clotch file sync |

---

### Priority stack for RYU

| Rank | Pain | Why first |
| ---: | --- | --- |
| 1 | Missed approval awareness | Core “never miss” promise |
| 2 | Approve/deny in-place with command preview | Completes the loop |
| 3 | Multi-session unified queue | Multi-agent reality |
| 4 | Jump to session | Fallback when preview insufficient |
| 5 | Risk-tiered batching | Safety without YOLO |
| 6 | Cursor Multitask reliability | Differentiation *if* API allows |
| 7 | Mobile/remote HITL | Expansion |
| 8 | Cost/quota | Nice-to-have chrome |

### Explicitly deprioritize for v0

- Full Devin-style orchestration IDE  
- Media Dynamic Island features (NotchNook territory)  
- Supporting 26 agents on day one  
- Desktop pets as the product (optional flair only)  
- Dual-OS ship in the first sprint  

---

## Part B — MVP scope (~5-hour forcing function)

### Goal

Ship something **demoable** that proves:

> Agent needs approval → ambient surface expands → user sees what/why → Approve/Deny → agent continues — without alt-tabbing into the agent UI.

Five hours is a pace target (wipe code fast, put something out). Stretch if the demo needs it; do not expand *feature* scope just because calendar time expands.

---

### Platform recommendation

| Choice | Verdict |
| --- | --- |
| Mac notch-native Swift | Best story match; slow unless the team already ships Swift overlays. Immediate competition with Vibe Island. |
| **Windows floating “island” + tray (recommended here)** | This workspace is **Windows**. Fastest path: Tauri / Electron / WPF always-on-top overlay + toast. Category **less saturated** than Mac. |
| Mac Electron floating pill | Faster than Swift; still Mac-only distribution. |

**Rules:**

- Demo on **this Windows PC** → Windows floating pill + tray. Study `claude-notch-windows`, ClaudeBeep, `claude-code-notify`.  
- Demo on a **notched MacBook** with Swift experience → Mac / Open Island patterns.  
- **Do not** attempt dual-OS in the first build.

---

### In scope (must ship)

1. **One agent integration only:** Claude Code **or** Codex CLI via `PermissionRequest` / notify hooks (whichever is installed).  
   - *Not* Cursor IDE Multitask approvals in v0 (API risk).  
2. **Always-on-top floating pill** (top-center): idle → expands on `waiting_approval`.  
3. **Show:** session/project label + tool name + command/path preview (truncate safely).  
4. **Buttons:** Allow once / Deny (return decision through hook protocol).  
5. **Sound or toast** when attention needed.  
6. **Fake/demo mode** with scripted events so the pitch works even if hooks flake live.  
7. **Short README** with demo script + architecture diagram.

### Out of scope

- Cursor / Cloud agents / Devin adapters  
- Batch approve, Always Allow policies, risk scoring  
- Precise terminal/IDE tab jump  
- iPhone/Watch, Pushary-like mobile  
- SSH remote agents  
- Usage/cost dashboards  
- Pixel pets, Liquid Glass fetish, 26-agent matrix  
- Accounts, sync, telemetry  
- Notarization / Store submission  

### Stretch (only if ahead at ~T+3h)

- Second agent (Codex if Claude done, or vice versa)  
- Click pill to focus last-known terminal window (best-effort)  
- Risk color (bash containing `rm -rf` → red border)  
- “Simulate 3 parallel sessions” demo harness  

---

### Architecture sketch (Windows-first)

```
┌─────────────────────┐     stdin JSON      ┌──────────────────┐
│ Claude Code / Codex │ ──────────────────► │ hook script      │
│ PermissionRequest   │ ◄────────────────── │ (Allow/Deny JSON)│
└─────────────────────┘     stdout decision └────────┬─────────┘
                                                     │ POST /event
                                                     ▼
                                            ┌──────────────────┐
                                            │ Local bridge     │
                                            │ 127.0.0.1:PORT   │
                                            └────────┬─────────┘
                                                     │
                                            ┌────────▼─────────┐
                                            │ Island UI        │
                                            │ (Tauri/Electron  │
                                            │  / WPF)          │
                                            │ pill + Approve   │
                                            └──────────────────┘
```

Mac variant later: Unix socket (Open Island / CodeIsland pattern).

**Fail-open rule:** if UI/bridge is down, hook times out and agent falls back to normal terminal prompt — **never silent-auto-allow**.

---

### Demo script (~90 seconds)

1. **Setup (10s):** “I run agents while I multitask. They freeze on approvals. I miss them.”  
2. Start island app — idle pill top-center.  
3. Start Claude/Codex task that hits a permission **or** run demo harness injecting fake `Bash: npm test`.  
4. Switch to browser/Figma/slides — show you’re not watching the terminal.  
5. Pill glows/expands + optional sound; preview shows command.  
6. Click **Allow** from the pill — agent continues.  
7. Optional: inject scary `rm` preview → **Deny**.  
8. **Close:** “Mac already has Vibe Island; we’re the Windows attention layer / Cursor-shaped wedge next.”

---

### Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Hook protocols differ per tool/version | One tool + demo harness |
| Approving from UI is a security surface | Localhost-only, no LAN bind, fail-open, show full command |
| Cursor has no clean external approve API | Don’t promise Cursor in v0 |
| Electron packaging eats the clock | Run unpackaged (`npm start`) for demo |
| Live demo failure | Scripted event injector required |
| Competing with Vibe Island narrative | Lead with gap (Windows / Cursor / batch triage), not “first ever” |

---

### Success criteria

- Judge sees approval UI **outside** the agent  
- Decision actually unblocks (or convincingly simulates) the agent  
- Story acknowledges existing Mac competitors and states RYU’s wedge in one sentence  

---

### Post-MVP forks (not day one)

1. Windows multi-agent island (Claude + Codex + Cursor CLI)  
2. Risk-aware batch inbox (Claude Pulse / lazyclaude ideas)  
3. Cursor Multitask reliability layer **if** unofficial/public APIs emerge  
4. Fork Open Island instead of greenfield on Mac  
5. Optional mobile channel (Pushary-class) once desktop loop is solid  

---

## Decision checklist (before writing product code)

- [ ] Wedge chosen: **Windows island** / Cursor reliability / risk-inbox (pick one primary)  
- [ ] First agent: **Claude Code** or **Codex**  
- [ ] UI stack: Tauri / Electron / WPF  
- [ ] Demo harness planned (fake events)  
- [ ] One-sentence competitive acknowledgment ready  

When those are checked, scaffold bridge + pill — not more research docs.
