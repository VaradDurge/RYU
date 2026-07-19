# RYU — Competitor Research

**Date:** 2026-07-19  
**Scope:** Products that monitor AI coding agents, surface “needs attention,” and/or let users approve/deny without living in the agent UI. Includes Mac notch peers, Windows tray/overlay tools, mobile HITL, and adjacent dashboards.

**Companion docs:** [overview.md](./overview.md) · [pain-points-and-mvp.md](./pain-points-and-mvp.md)

---

## How to read this doc

For each product: **what it is**, **product loop**, **what it does well**, **what people say / positioning signals**, **gaps vs RYU**, and **links**.

**Overlap legend**

| Level | Meaning |
| --- | --- |
| ★★★★★ | Same job-to-be-done as RYU |
| ★★★★ | Same pain, slightly different surface or depth |
| ★★★ | Strong adjacency (monitor or HITL, not full island) |
| ★★ | UX or workflow pattern only |

---

## Category map

```
                    APPROVE IN-PLACE
                           ▲
     Pushary / ntfy        │         Vibe Island
     ClaudeBeep            │         CodeIsland / Open Island
                           │         AgentPulse / Ping Island
                           │         Claude Pulse
    MOBILE / CHAT ─────────┼───────────────────── DESKTOP ISLAND
                           │
     Code Light AI         │         NotchNook (media only)
     Dashboards            │
     Raycast monitors      │         lazyclaude (TUI)
                           │
                           ▼
                    NOTIFY / MONITOR ONLY
         (claude-code-notify, claude-code-dashboard)
```

**Mac agent-island = crowded.**  
**Windows polished multi-agent island = thin.**  
**Cursor IDE-external approve = mostly unsolved / unclear.**

---

# Tier A — Direct competitors (Mac agent islands)

---

## 1. Vibe Island — ★★★★★

| | |
| --- | --- |
| **Platform** | macOS 14+ (Apple Silicon emphasized) |
| **Pricing** | Free trial; ~**$19.99** one-time / 1 Mac (multi-Mac tiers) |
| **Type** | Commercial, closed-source |
| **Home** | [vibeisland.app](https://vibeisland.app/) · Homebrew cask `vibe-island` |

### What it is

Native Mac app that turns the notch (or a top-center bar on non-notch displays) into a Dynamic Island for AI coding agents. Claims **26 agents**, including Claude Code, Codex, Gemini CLI, Cursor, and many more. Markets monitor → approve → answer → jump-back without leaving flow.

### Product loop

1. Install app; it (auto) wires hooks for detected agents.  
2. Idle: compact island / bar shows ambient session presence.  
3. Agent hits permission, AskUserQuestion, or plan review → island expands.  
4. User Approves / Denies / answers from the island.  
5. Optional: one-click jump to exact terminal/IDE session.  
6. Extras: sounds, usage/quota, SSH remote narrative.

### What it does well

- Closest commercial gold standard to RYU’s pitch.  
- Breadth of agents/terminals is the moat.  
- Zero-config / local-first story; low RAM claims (~100 MB).  
- Strong category ownership (they publish “best AI agent notch apps” roundups).

### What people say / signals

- Dev Twitter / “best Mac app of 2026”-style praise appears in marketing and roundups.  
- Positioned as the paid polish winner vs OSS clones.  
- Alternatives page frames Open Island et al. as shallower on questions/plan review (competitive messaging — treat as biased).

### Gaps vs RYU

- **No Windows.**  
- Competing on Mac notch polish is expensive.  
- Paid; OSS-preferring users churn to CodeIsland/Open Island.  
- Cursor *IDE Multitask* chrome bugs may still live inside Cursor even if CLI hooks work.

### RYU takeaway

Study as the **pitch benchmark**. Do not try to out-breadth them in a short build. Differentiate on platform or problem slice.

---

## 2. CodeIsland — ★★★★★

| | |
| --- | --- |
| **Platform** | macOS 14+; iPhone / Apple Watch companions |
| **Pricing** | Free / OSS |
| **Type** | Open source |
| **Home** | [github.com/wxtsky/CodeIsland](https://github.com/wxtsky/CodeIsland) |

### What it is

OSS macOS notch panel with pixel-art / “buddy” aesthetic. Real-time agent status via **Unix socket IPC** + auto-installed hooks. Claims ~**13 tools** (Claude Code, Codex, Cursor, Copilot, Gemini CLI, Cline, OpenCode, etc.). Companion apps for iPhone Dynamic Island / Lock Screen / Watch.

### Product loop

1. Hooks fire on agent events → Unix socket → notch UI.  
2. Live tool calls / session status on the island.  
3. Approve/deny permissions and answer questions from the panel.  
4. Glance on Watch/iPhone when away from the Mac lid angle.

### What it does well

- Proven architecture template for Mac builds.  
- High visibility (~2k+ GitHub stars at research time).  
- Extends “never miss” beyond the laptop (wearables).  
- Free — pressure on Vibe Island’s paid tier.

### What people say / signals

- Treated as the main OSS alternative in Vibe Island’s own category content.  
- Pixel-art branding is polarizing but memorable for Show HN / social demos.

### Gaps vs RYU

- Mac-centric; not a Windows path.  
- Hook install/repair + tool version churn.  
- Cursor IDE depth may vary by event support table.

### RYU takeaway

Best **OSS reference + companion-device** lesson. Fork inspiration, not a Windows solution.

---

## 3. Open Island — ★★★★★

| | |
| --- | --- |
| **Platform** | macOS 14+ (SwiftUI + AppKit) |
| **Pricing** | Free / **GPL v3** |
| **Type** | Open source (“open-source Vibe Island”) |
| **Home** | [github.com/Octane0411/open-vibe-island](https://github.com/Octane0411/open-vibe-island) |

### What it is

Native Swift app: notch / top-bar for session status, permission approvals, notifications, jump-back. Explicitly positioned as the open Vibe Island. Documented bridge: `agent hook → OpenIslandHooks → Unix socket → BridgeServer → UI`. Hooks **fail open** if the app is down.

### Product loop

Same as Vibe Island category: hook → expand → approve/deny/answer → optional jump. Active work on Codex `PermissionRequest` (e.g. v1.1.3 notes). Sparkle updates + notarized DMG / Homebrew.

### What it does well

- Best **implementation reference** if RYU ever goes Mac-native.  
- Fail-open design is the right safety default.  
- Forkable (with GPL constraints for commercial packaging).

### What people say / signals

- Vibe Island marketing claims shallower question/plan review — useful as competitive framing, not gospel.  
- Attractive to developers who refuse paid notch apps.

### Gaps vs RYU

- macOS-only; GPL may constrain closed commercial forks.  
- Feature race vs Vibe on polish.

### RYU takeaway

If building Mac later: **read this codebase before greenfield Swift**. Copy fail-open.

---

## 4. AgentPulse — ★★★★★

| | |
| --- | --- |
| **Platform** | macOS 13+ |
| **Pricing** | Free / OSS |
| **Type** | Open source |
| **Home** | [github.com/omerates760/AgentPulse](https://github.com/omerates760/AgentPulse) |

### What it is

Notch monitor with hover expand, color-coded glow (active / permission / question), auto-hooks, global hotkey, AppleScript terminal jump. Supports Claude Code, Cursor, Codex, Gemini.

### Product loop

Detect tools → install hooks → bridge binary under `~/.agent-pulse/bin/` → glow states → **Allow Once / Always Allow / Deny** with bash preview → sound (suppressed when terminal focused).

### What it does well

- Clear permission UX taxonomy (Once / Always / Deny).  
- Smart sound suppression (reduces fatigue when you’re already watching).  
- Same socket architecture as leaders; smaller project = easier to study end-to-end.

### What people say / signals

- Newer / lower stars than CodeIsland at research time — less social proof, more hackable.

### Gaps vs RYU

- Maturity/notarization unknown; Mac-only; single-maintainer risk.

### RYU takeaway

Steal the **permission button model** and “quiet when focused” behavior for the MVP.

---

## 5. Ping Island — ★★★★★

| | |
| --- | --- |
| **Platform** | macOS 14+ |
| **Pricing** | Free / OSS |
| **Type** | Open source |
| **Home** | [github.com/sudo-1024/ping-island](https://github.com/sudo-1024/ping-island) |

### What it is

Menu bar + Dynamic Island surface that expands when agents need attention. Listens to Claude-style hooks, Codex hooks, Gemini hooks, Codex app-server, OpenCode plugins, IDE-compatible integrations. Lineage from Claude Island → broader multi-client.

### Product loop

Compact until signal → expand on approval/input/review → act in place → precise jump (iTerm2 / Ghostty / Terminal / tmux / VS Code–compatible). Emphasis on **event-level filtering** (“what deserves a ping”).

### What it does well

- Mental model: **attention as the product**, not always-on dashboard clutter.  
- Filtering narrative matches notification-fatigue pain.  
- Bilingual EN/ZH positioning (broader audience).

### What people say / signals

- Listed in Vibe Island category roundups; early-stage visibility (low stars at research time).

### Gaps vs RYU

- Mac-only; Cursor Multitask coverage not independently verified.

### RYU takeaway

Adopt “signal-first / filter noise” as a principle for the island states.

---

## 6. Claude Island / Vibe Notch — ★★★★

| | |
| --- | --- |
| **Platform** | macOS (README cites 15.6+ for current builds) |
| **Pricing** | Free / Apache 2.0 |
| **Type** | Open source (category originator) |
| **Home** | [github.com/farouqaldori/claude-island](https://github.com/farouqaldori/claude-island) |

### What it is

Early notch/menu-bar overlay for **Claude Code CLI**. Installs Python hooks into `~/.claude/hooks/`, Unix socket bridge, live sessions, approve/deny from notch, chat history with markdown. Coined the “Dynamic Island for coding agents” pattern others expanded.

### Product loop

Claude permission/event → Python hook → socket → island expand → approve/deny → continue. Single-agent focus historically.

### What it does well

- Proved the category early — best **MVP scope template** (one agent, deep).  
- Simple enough to understand in an afternoon.

### What people say / signals

- Inspired forks / successors (Ping Island, etc.).  
- Dev cadence noted as uneven (pause/resume).  
- Mixpanel analytics may bother privacy-sensitive users.

### Gaps vs RYU

- Not the multi-tool unifier by default.  
- Less competitive vs Vibe/CodeIsland on breadth.

### RYU takeaway

**v0 should look more like Claude Island than Vibe Island** — one agent, magical loop, then expand.

---

## 7. Clotch — ★★★★

| | |
| --- | --- |
| **Platform** | macOS (scanner can run on Linux/macOS servers) |
| **Pricing** | Free / OSS |
| **Type** | Open source, **hook-free** |
| **Home** | [github.com/tuannvm/clotch](https://github.com/tuannvm/clotch) |

### What it is

Claude Code–focused island that **reads session files / JSONL** instead of rewriting `settings.json`. Optional rsync/Syncthing for multi-machine glance. Minimal attack surface (no localhost server claimed).

### Product loop

Poll/watch session artifacts (~3s default) → show multi-session status on island → remote machines sync files → local glance. Approve write-back is weaker/less clear than hook-based peers.

### What it does well

- Survives Claude updates that break hooks — huge ops insight.  
- Multi-machine without a cloud account.  
- Attractive if RYU’s support burden becomes “hooks broke again.”

### What people say / signals

- Positioned against hook fragility; niche but architecturally important.

### Gaps vs RYU

- Harder to approve-from-island without a permission channel.  
- Claude-centric; polling latency vs push hooks.

### RYU takeaway

Consider **hybrid**: hooks for approve path, file watch as fallback monitor. Don’t bet the whole product on hook-free if approve-in-place is the demo.

---

## 8. Claude Pulse — ★★★★

| | |
| --- | --- |
| **Platform** | macOS |
| **Pricing** | Marketed as free download (verify at ship time) |
| **Type** | Productized Mac app |
| **Home** | [claudepulse.app](https://claudepulse.app/) · [idle-cost blog](https://claudepulse.app/blog/hidden-cost-of-missed-approvals) |

### What it is

Claude Code multi-session notch product with a strong **economics narrative**: missed approvals ≈ idle compute. Markets safety-aware batching (bulk-approve safe ops; force review for destructive) and native notifications with inline Allow/Deny. Usage tracking without re-login.

### Product loop

Multi-session Claude → time-sensitive notify → notch/notification Allow/Deny → optional batch of “safe” ops → continue. Frames ~8–15 approvals/hour/session and ~10 min average idle when missed (their numbers — use as story, validate independently).

### What it does well

- Best written articulation of **why the category exists**.  
- Correct critique of naïve “Approve all.”  
- Notification reliability across Spaces/Focus as a selling point.

### What people say / signals

- Blog math is widely reusable for pitch decks.  
- Competitive density on Mac Claude-only notches is high — differentiation must be safety/batch, not “we also have a notch.”

### Gaps vs RYU

- Claude-first; Cursor/Codex breadth unclear.  
- Claims not independently audited here.

### RYU takeaway

Steal the **idle-cost story** and **risk-tiered batch** principle for messaging and later features.

---

# Tier B — Adjacent HITL & Windows

---

## 9. Pushary — ★★★★

| | |
| --- | --- |
| **Platform** | Phone (iOS/Android) + agent machines |
| **Pricing** | Freemium / SaaS (tiers marketed; verify) |
| **Home** | [pushary.com](https://pushary.com/) |

### What it is

Cross-agent **push + HITL**: Claude Code, Codex, Cursor, Windsurf, etc. via MCP and/or hooks. Phone buzzes when a task finishes or permission is needed; Yes/No from lock screen. Codex 0.122+ called out for enforced approvals. Setup via `npx @pushary/agent-hooks setup` / MCP URL. Policy timeouts (auto-deny / fall back to terminal).

### Product loop

Agent event → Pushary → push to phone → tap Yes/No → decision returns → agent continues (or timeout policy).

### What it does well

- Best “left the desk” solution.  
- Multi-agent brand already exists.  
- Timeout/fallback policy design is mature thinking.

### What people say / signals

- Occupies the mobile HITL slot; complementary to desktop islands, not a full substitute for at-desk multitasking.

### Gaps vs RYU

- Not glanceable while multitasking *on the same machine* the way a notch is.  
- Command text over a network needs threat modeling.  
- Cloud path vs local-first islands.

### RYU takeaway

Phase-2 channel. Don’t build mobile in the first demo unless that’s the wedge.

---

## 10. ntfy-approve / claude-push / remote approvers — ★★★★

| | |
| --- | --- |
| **Platform** | Any OS + phone with ntfy |
| **Pricing** | Free / OSS (+ ntfy.sh or self-host) |
| **Examples** | [achton/ntfy-approve](https://github.com/achton/ntfy-approve) · [Medium: claude-push](https://medium.com/@Purpom_aoki/how-i-built-a-mobile-approval-system-for-claude-code-so-i-can-finally-leave-my-desk-76b048b35c33) · [HN remote approver](https://news.ycombinator.com/item?id=47111171) |

### What it is

DIY family: Claude `PermissionRequest` → ntfy push → Allow/Deny JSON back to hook. Often fail-open to terminal on timeout.

### Product loop

Same as Pushary but thinner / self-hosted / Claude-centric.

### What it does well

- Tiny implementation surface; strong HN validation of the pain.  
- Privacy option via self-hosted ntfy.

### Gaps vs RYU

- No unified desktop control surface; usually Claude-only.

### RYU takeaway

Proof the pain is real on HN. Protocol patterns for timeout + fail-open are reusable.

---

## 11. ClaudeBeep — ★★★★ (Windows)

| | |
| --- | --- |
| **Platform** | Windows (tray + WinRT toasts) |
| **Pricing** | Free / OSS |
| **Home** | [github.com/Tommie-P-xl/ClaudeBeep](https://github.com/Tommie-P-xl/ClaudeBeep) |

### What it is

Windows tray app for Claude Code: notifications + **interactive approval replies** via Windows Toast, Telegram, QQ, Feishu/Lark, DingTalk, etc. Installable desktop app + Web UI for config.

### Product loop

Permission/elicitation → toast or chat channel → reply Allow/Deny → hook returns decision. AFK path via Telegram/etc.

### What it does well

- Proves **Windows demand** and a shippable tray distribution shape.  
- Remote reply while AFK.  
- Good reference for formatting PermissionRequest / elicitation payloads.

### What people say / signals

- Closest Windows peer for HITL, even though tray ≠ island.

### Gaps vs RYU

- Claude-focused; channel sprawl = security/ops complexity.  
- Not a polished multi-agent island.

### RYU takeaway

Study for Windows packaging + toast interactive replies. RYU can be the “prettier island” cousin.

---

## 12. claude-notch-windows — ★★★★ (Windows)

| | |
| --- | --- |
| **Platform** | Windows |
| **Pricing** | Free / OSS |
| **Home** | [github.com/frobinson47/claude-notch-windows](https://github.com/frobinson47/claude-notch-windows) |

### What it is

Claude Code companion: **system tray + floating overlay**. Hooks POST JSON to local HTTP (`localhost:27182`); Qt/Python UI updates tray/overlay; balloons/toasts for events. Explicit “notch on Windows” attempt via always-on-top UI.

### Product loop

Hook → HTTP POST → state manager → overlay/tray update → user glances / interacts → (approve depth may lag Mac peers).

### What it does well

- Direct **Windows MVP template** (overlay + localhost bridge).  
- Documented architecture.  
- Per-project accent colors / mini mode ideas.

### Gaps vs RYU

- Claude-only; approve-from-overlay depth may lag Vibe-class Mac apps.  
- Localhost port + scripts = support surface.

### RYU takeaway

**Primary architecture reference for a Windows-first RYU.**

---

## 13. claude-code-notify — ★★★ (Windows)

| | |
| --- | --- |
| **Platform** | Windows (WT / VS Code / Cursor / JetBrains called out) |
| **Pricing** | Free / OSS |
| **Home** | [github.com/chuilishi/claude-code-notify](https://github.com/chuilishi/claude-code-notify) |

### What it is

Native Windows Toast for Claude Code via plugins/hooks. Context-aware titles (“Permission Required”, “Claude is Waiting”, “Plan Ready”). Click toast → jump to correct terminal/editor tab.

### Product loop

Event → toast → click → focus session → approve *inside* agent UI.

### What it does well

- Excellent **notify + jump** building block.  
- Plugin auto-registration reduces manual settings pain.  
- Works alongside Cursor as host editor.

### Gaps vs RYU

- Approve still happens after jump — half the product.  
- Toast fatigue; no multi-agent unified queue.

### RYU takeaway

Ship notify+jump as fallback; win on **approve without jump**.

---

## 14. Code Light AI — ★★★

| | |
| --- | --- |
| **Platform** | macOS / Linux / Windows |
| **Pricing** | Free / OSS |
| **Home** | [github.com/cuihp/code-light-ai](https://github.com/cuihp/code-light-ai) |

### What it is

Tray **status light** (+ optional desktop pet) for Claude Code and Codex. Colors: idle / working / waiting / completed / error. Multi-session: highest-priority state wins.

### Product loop

Hooks → aggregate state → tray color. Waiting ≈ permission/notify. No full approve UI from the light alone.

### What it does well

- True cross-platform footprint.  
- Clean priority aggregation model.  
- Lightweight always-on presence.

### Gaps vs RYU

- Monitor ≠ HITL control surface.  
- Less demo “wow” than an expanding island.

### RYU takeaway

Reuse **priority aggregation** (waiting > working > idle) for pill color states.

---

# Tier C — Dashboards, TUI, launchers, generic notch

---

## 15. lazyclaude — ★★★★ (different surface)

| | |
| --- | --- |
| **Platform** | Terminal / tmux (macOS/Linux primary) |
| **Pricing** | Free / OSS |
| **Home** | [github.com/any-context/lazyclaude](https://github.com/any-context/lazyclaude) |

### What it is

lazygit-inspired TUI for many Claude Code sessions: live preview, scrollback, SSH, **permission popups** with accept / always-allow / reject, stacked popups, “accept all pending,” diff preview for Write/Edit.

### Product loop

Live in TUI → permission stacks appear → one-key triage → sessions continue. Power-user, keyboard-native.

### What it does well

- Best-in-class **batch permission triage** UX reference.  
- Diff-before-approve for edits.  
- SSH-friendly.

### What people say / signals

- README leads with “babysitting terminal tabs” — same emotional pitch as island apps.

### Gaps vs RYU

- Useless while in Figma/browser unless you live in the TUI.  
- “Accept all” without risk tiers is a footgun.  
- Not a Windows widget / Mac notch.

### RYU takeaway

Copy batch + diff-preview ideas for a later inbox mode; don’t make TUI the v0.

---

## 16. claude-code-dashboard — ★★★

| | |
| --- | --- |
| **Platform** | Local Node server (browser) |
| **Pricing** | Free / MIT |
| **Home** | [github.com/Stargx/claude-code-dashboard](https://github.com/Stargx/claude-code-dashboard) · [HN](https://news.ycombinator.com/item?id=47314375) |

### What it is

Watches `~/.claude/projects/` JSONL: multi-session status, tokens/cost, context, subagents, files, git branch, permission mode. Observation, not control.

### Product loop

Open localhost dashboard → glance sessions → still approve in the agent.

### What it does well

- Zero-hooks monitoring prototype path.  
- Cost/context awareness.  
- HN validated the multi-session visibility pain.

### Gaps vs RYU

- Hidden browser tab = same “miss it” failure mode.  
- No approve/deny. Claude-only.

### RYU takeaway

Dashboards are **not** the ambient surface. Don’t confuse status pages with the product.

---

## 17. Raycast Claude monitors — ★★★

| | |
| --- | --- |
| **Platform** | macOS + Raycast |
| **Pricing** | Extensions generally free; Raycast free/pro |
| **Examples** | [claude-code-monitor](https://github.com/wuyuxiangX/claude-code-monitor) · [ClaudeCast](https://www.raycast.com/qazi0/claudecast) |

### What it is

Launcher/menu-bar workflows: session status (Active/Waiting/Idle/Ended), costs, focus jump, resume, Ralph loops, usage dashboards.

### Product loop

Hooks → JSON/status → Raycast menu bar → jump/resume (approvals often still in session).

### What it does well

- Low build cost for Raycast power users.  
- Cost + session resume strength.

### Gaps vs RYU

- Not Windows; not Dynamic Island language; approvals often still require focusing the session.

### RYU takeaway

Menu bar is a fallback surface, not the brand.

---

## 18. NotchNook (and media islands) — ★★

| | |
| --- | --- |
| **Platform** | macOS |
| **Pricing** | ~$3/mo or ~$25 one-time; Setapp |
| **Home** | Covered by [The Verge](https://www.theverge.com/2024/7/21/24202914/notchnook-mac-app-dynamic-island-iphone), MacStories, etc. |

### What it is

Turns the Mac notch into a hub for **media, widgets, file tray, shortcuts** — not AI agents. Related names in the media-notch world: MediaMate, boring.notch, etc.

### Why it matters to RYU

- Validates third-party notch overlays, Accessibility/Screen Recording prompts, non–App Store distribution.  
- Users will pay for notch UX — but **do not confuse media-notch with agent-notch** (Vibe Island’s roundups make this distinction).

### Gaps vs RYU

Zero agent/approval workflow.

---

## Also mentioned (not deeply profiled)

| Name | Note |
| --- | --- |
| **Notchi / AgentNotch** | Appear in category roundups; verify before citing as primary comps |
| **Harness** | Worktree / multi-agent dashboard adjacency |
| **Bulwark** | Governance proxy — audit/credentials layer, not island UX |
| **Voxlert-style voice alerts** | Mentioned in HN threads as nearby awareness, not HITL |

---

# Comparative matrix

| Product | OS | Approve in UI | Multi-agent | Surface | Pricing |
| --- | --- | --- | --- | --- | --- |
| Vibe Island | Mac | Yes | Broad (26) | Notch | ~$20 |
| CodeIsland | Mac (+iOS/Watch) | Yes | Broad (13) | Notch | Free |
| Open Island | Mac | Yes | Broad | Notch | Free (GPL) |
| AgentPulse | Mac | Yes | Claude/Cursor/Codex/Gemini | Notch | Free |
| Ping Island | Mac | Yes | Multi-client | Notch | Free |
| Claude Island | Mac | Yes | Claude-first | Notch | Free |
| Clotch | Mac | Weak / unclear | Claude | Notch (hook-free) | Free |
| Claude Pulse | Mac | Yes + batch narrative | Claude multi-session | Notch | Free* |
| Pushary | Phone | Yes | Multi | Push | Freemium |
| ntfy family | Phone | Yes | Usually Claude | Push | Free |
| ClaudeBeep | Windows | Yes (toast/chat) | Claude | Tray/channels | Free |
| claude-notch-windows | Windows | Partial | Claude | Overlay/tray | Free |
| claude-code-notify | Windows | No (jump) | Claude | Toast | Free |
| Code Light AI | Win/Mac/Linux | No | Claude/Codex | Tray light | Free |
| lazyclaude | Terminal | Yes + batch | Claude | TUI | Free |
| Dashboard | Browser | No | Claude | Web | Free |
| NotchNook | Mac | N/A | N/A | Media notch | Paid |

\*Verify Claude Pulse pricing at decision time.

---

# What competitors’ loops teach RYU

| Loop stage | Who does it best | Lesson |
| --- | --- | --- |
| Ambient idle presence | Vibe / CodeIsland / Code Light | Compact until needed |
| Expand on attention | Ping Island framing | Filter; don’t spam |
| Preview command/question | AgentPulse / lazyclaude | Trust = payload richness |
| Allow Once / Always / Deny | AgentPulse | Three-way is table stakes |
| Risk-aware batch | Claude Pulse / lazyclaude (batch) | Differentiator if done safely |
| Jump to session | Vibe / Open Island / claude-code-notify | Half the product for scary ops |
| Away from desk | Pushary / ntfy / ClaudeBeep channels | Different surface; phase 2 |
| Survive hook breakage | Clotch | Need fallback story |
| Windows distribution | ClaudeBeep / claude-notch-windows | Tray + overlay + localhost HTTP |

---

# Competitive conclusion for RYU

1. **Exact Mac product exists and is contested** — Vibe Island (paid) + several OSS peers.  
2. **Windows equivalent of Vibe Island does not clearly exist** — pieces exist (ClaudeBeep, claude-notch-windows, notify, Code Light).  
3. **Mobile HITL exists** — Pushary / ntfy; complementary, not blocking.  
4. **Cursor IDE Multitask as a reliable external control plane is still a gap** — high upside, high feasibility risk.  
5. **Winning narrative is wedge + execution**, not category invention.

For how this maps to pain priority and a short MVP, see [pain-points-and-mvp.md](./pain-points-and-mvp.md). For RYU-specific decisions, see [overview.md](./overview.md).
