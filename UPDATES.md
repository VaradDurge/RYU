# RYU — Updates (what’s done, what’s not)

Last updated: July 2026  
Audience: quick catch-up for anyone on this branch.

---

## What RYU is trying to be

A small floating **dock** on Windows that sits above your coding agents (Cursor, Claude, Codex).

The product loop we care about:

1. **Idle** — dock tucked away / quiet  
2. **Attention** — something needs you (agent working, or permission waiting)  
3. **Understand** — see which agent + what they want to do  
4. **Decide** — Approve or Deny on the dock  
5. **Resume** — agent continues (or stops) without you digging through terminal prompts  

---

## What has been built (start → now)

### 1. Desktop shell + dock UI

- Electron + React app (`npm run dev`)
- Top-of-screen hover dock with **Cursor · Claude · Codex**
- Glass-style Windows UI (opaque enough that IDE text doesn’t bleed through)
- Permission card: tool preview, Deny / Approve, “Local mode”
- Dev **Inject** buttons (top-left) for pitch demos only — fake events, not real agents

### 2. Local bridge

- Small HTTP server on `127.0.0.1:41999`
- Agents/hooks talk to RYU here (not over the internet)
- Main endpoints:
  - `POST /event` — “please approve this”
  - `POST /decision` — Approve / Deny from the dock
  - `POST /status` — live ring updates (running / idle / approval / error)
  - `GET /agents` — current ring state (debugging)
  - `GET /health` / `GET /pending`

### 3. Live status rings (working for Cursor; wired for Claude)

Colors:

| Color | Meaning |
| --- | --- |
| Blue | Idle / finished |
| Green | Agent is working |
| Yellow | Needs your approval |
| Red | Error / denied |

**Cursor (proven live):**

- Project hooks in `.cursor/hooks.json`
- Status-only: updates rings while the agent works
- Automated check: `npm run verify:cursor-status`
- Live check: reload Cursor → ask for a tiny edit → ring green → blue when done

**Claude (installed + automated checks green):**

- `npm run hook:install` writes Windows + WSL Claude settings
- Status hooks update Claude’s ring the same way
- Permission hooks send Write/Bash/Edit approvals to the dock
- Automated checks: `npm run verify:claude-status` and `npm run verify:claude-resume`
- Live Claude in WSL still needs a clean restart + a real Write prompt to sign off by hand

### 4. Claude Resume (the real Approve → continue path)

This is the main **product** permission loop today:

1. Keep RYU running  
2. `npm run hook:install` (once)  
3. Restart Claude Code  
4. Ask Claude to create a file (needs permission)  
5. Dock opens on Claude → **Approve** → tool runs  
6. **Deny** blocks · if RYU is down, Claude falls back to its normal prompt (fail-open)

WSL detail: Claude hooks must use **Windows Node**, because Linux `127.0.0.1` is the WSL VM, not the Windows app where RYU listens. Install script handles that.

### 5. Cursor permission gate — tried, then turned off

We briefly routed every Cursor tool/shell call through RYU Approve/Deny.  
That spam-asked for pointless things (`Write`, `Read`, random shells) and was unusable.

**Current rule:**

- Cursor hooks → **status rings only**  
- Dock Approve/Deny → **Claude Resume** (not every Cursor click)  
- Cursor “real Resume” remains a separate spike (ACP), not finished product

### 6. Other pieces present but lighter

- **Codex** adapter install script (`npm run hook:install:codex`) — early  
- **Cursor ACP** script — experimental real gate, not day-to-day  
- **Mac** folder under `diff/mac/` — teammate track; Windows dock is what we run here  
- Demo screenshots / capture scripts for pitching  

---

## Product loops — plain summary

| Loop | Status | How you use it |
| --- | --- | --- |
| Pitch / demo UI | Works | `npm run dev` + Inject buttons |
| Cursor live rings | Works (live + verify) | Reload Cursor, run an agent edit |
| Claude live rings | Wired + verify OK | Install hooks, restart Claude, watch rings |
| Claude Approve → Resume | Automated OK; live WSL needs your sign-off | Write prompt → Approve on dock |
| Cursor Approve → Resume | Not product yet | Permission hook disabled (too noisy); ACP is a spike |
| Codex full loop | Early | Install + trust hooks; not the focus |

---

## What is not working / not finished

1. **Claude live sign-off** — scripts pass; you still need to restart Claude and prove one Write → Approve → file on your machine (especially WSL).  
2. **Cursor dock permissions** — intentionally off; don’t expect Approve for every Cursor tool.  
3. **Cursor Multitask / external approve** — not supported.  
4. **Codex** — not at Cursor/Claude parity.  
5. **Mac notch / notice dots** — not part of the Windows daily path.  
6. **Lots of uncommitted local work** — branch has many changes not cleaned into one neat commit yet.  
7. **Stuck permission cards** — if the dock shows an old Approve forever, restart RYU; clear pending or reload the agent window.

---

## Next steps / action items

### Do now (you)

1. Keep `npm run dev` running when testing.  
2. **Reload Cursor** after hook changes (status-only). Confirm: rings move, **no** random Approve spam.  
3. **Restart Claude** (full quit), then:  
   > Create `ryu-live-test.txt` with text `hello`  
   Approve on the dock. Confirm file exists and terminal isn’t stuck on Yes/No.  
4. If Claude only shows its own Yes/No: from Windows run `npm run hook:install` again, restart Claude, check `%USERPROFILE%\.ryu\hook.log`.

### Do next (engineering)

1. Stabilize Claude live Resume on WSL (one happy path video / checklist).  
2. Decide Cursor Resume strategy (ACP vs selective gate) — **not** “approve every tool”.  
3. Bring Codex to the same status + permission shape if we demo multi-agent.  
4. Commit / PR the working Windows path (dock + bridge + Cursor status + Claude hooks).  
5. Optional: in-dock dismiss for stale cards without restarting RYU.

### Nice later

- Finish/fail notice dots on Windows (without a second Mac-only window)  
- Stronger watchdog so rings never stick green  
- Packaging / install story for non-dev users  

---

## Useful commands

```bash
npm run dev                    # start RYU
npm run verify:cursor-status   # Cursor rings
npm run hook:install           # Claude status + permission (Win + WSL)
npm run verify:claude-status   # Claude rings
npm run verify:claude-resume   # Claude Approve/Deny/fail-open
```

Debug:

- Bridge health: `http://127.0.0.1:41999/health`  
- Rings: `http://127.0.0.1:41999/agents`  
- Cursor log: `%USERPROFILE%\.ryu\cursor-hook.log`  
- Claude logs: `%USERPROFILE%\.ryu\hook.log` · `claude-hook.log`  

---

## Bottom line

**Working today:** floating multi-agent dock, local bridge, Cursor live status rings, Claude status + permission plumbing (verified by scripts).  

**Still on you to prove once:** live Claude Write → dock Approve → file, after a clean Claude restart.  

**Deliberately not doing:** Cursor asking RYU for approval on every tiny tool call.
