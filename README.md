# RYU

Desktop **attention + decision** surface for AI coding agent permissions.  
Core loop: **Idle → Attention → Understand → Decide → Resume**.

Windows-first · Electron + React · Claude Resume · Cursor live status rings · Codex adapter

---

## Two modes (do not confuse them)

| Mode | What it is | How to run |
| --- | --- | --- |
| **Demo / pitch** | Dock UI + fake events | `npm run dev` → harness **Inject Cursor/Claude/Codex** |
| **Live status** | Real agent rings (green while working) | Cursor + Claude lifecycle hooks (below) |
| **Product (Resume)** | Real agent blocked → dock Approve → agent continues | Claude `PermissionRequest` (below) |

Harness inject **never** talks to Cursor Agent or Claude. It only proves UI.

---

## Quick start

```bash
npm install
npm run dev
```

Hover the top glow for the multi-agent dock (Cursor · Claude · Codex).  
Rings: **blue** idle · **green** running · **yellow** needs approval · **red** error/deny.

Dev harness (top-left) injects fake permissions for pitch demos only.

---

## Cursor — live status rings (working)

Proven path this branch: Cursor lifecycle hooks → bridge → dock rings.

```bash
npm run dev
npm run verify:cursor-status   # automated: POST /status + status hook
```

**Live check (least effort):** reload this Cursor window (hooks reload) → ask the agent to do a tiny edit → Cursor ring goes **green**, then **blue** on stop.

> Windows note: Cursor may send UTF-16 stdin; hooks pass the event name via argv so rings still update.

| Piece | Role |
| --- | --- |
| [`.cursor/hooks.json`](./.cursor/hooks.json) | Wires lifecycle events |
| [`hooks/ryu-cursor-status.mjs`](./hooks/ryu-cursor-status.mjs) | `POST /status` (fail-open) |
| Bridge | `POST /status` · `GET /agents` · IPC `ryu:agentStatus` |

Debug: `http://127.0.0.1:41999/agents` · `%USERPROFILE%\.ryu\cursor-hook.log`

### Other Cursor paths

| Path | Status | How |
| --- | --- | --- |
| **IDE permission hooks** | Off by default | `ryu-cursor-hook.mjs` gated every tool/shell — too noisy; status-only now |
| **ACP (real gate)** | Spike client | `node scripts/ryu-cursor-acp.mjs "your prompt"` — needs `agent` CLI + login + RYU |
| **Harness Inject** | UI only | Not a real Cursor connection |

**Approve/Deny on the dock is for Claude Resume** (and optional Cursor ACP). Cursor IDE hooks only drive **status rings**.

IDE Multitask external approve is **not** supported.

---

## Claude — status rings + Resume (same shape as Cursor)

| Piece | Role |
| --- | --- |
| [`hooks/ryu-claude-status.mjs`](./hooks/ryu-claude-status.mjs) | Lifecycle → `POST /status` (green / yellow / blue) |
| [`hooks/ryu-hook.mjs`](./hooks/ryu-hook.mjs) | `PermissionRequest` + `PreToolUse` → dock Approve/Deny |
| `npm run hook:install` | Wires both into Windows + WSL `~/.claude/settings.json` |

```bash
npm run dev
npm run hook:install            # once — Windows + WSL (uses Windows node.exe)
npm run verify:claude-status    # rings smoke
npm run verify:claude-resume    # Approve/Deny / fail-open smoke
```

**Restart Claude Code** after install, then:

> Create a file `ryu-live-test.txt` with the text `hello`

**Expect:** Claude ring **green** while working → **yellow** when permission needed → dock **Approve** → file created (terminal Yes/No should not stay stuck).  
**Deny** → red, blocks. **Quit RYU** mid-prompt → Claude’s normal prompt (fail-open).

**WSL:** hooks must run **Windows** `node.exe` (installed by `hook:install`). Linux Node’s `127.0.0.1` is the WSL VM, not RYU — if you only see Claude’s Yes/No, re-run `npm run hook:install` from Windows and restart Claude.

Debug: `%USERPROFILE%\.ryu\hook.log` · `%USERPROFILE%\.ryu\claude-hook.log` · `http://127.0.0.1:41999/agents`

---

## Codex (second agent adapter)

```bash
npm run hook:install:codex   # writes ~/.codex/hooks.json
npm run dev
```

Trust hooks in Codex if prompted (`/hooks`). Permission → dock (Codex icon) → Approve/Deny.

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dock UI + bridge (`127.0.0.1:41999`) |
| `npm run verify:cursor-status` | Cursor live rings (`POST /status` + status hook) |
| `npm run verify:claude-status` | Claude live rings (`POST /status` + status hook) |
| `npm run hook:install` | Claude status + PermissionRequest/PreToolUse (Windows + WSL) |
| `npm run hook:install:codex` | Codex PermissionRequest + PreToolUse |
| `npm run verify:phase1` | Bridge roundtrips (Cursor/Codex/Claude) + Claude hook |
| `npm run verify:claude-resume` | Claude Resume path (allow / dual-waiter / deny / fail-open) |
| `npm run verify:track-a` | Headless S1–S8 contract suite (no Electron / no live agents) |
| `npm run bridge:headless` | Bridge HTTP only on `:41999` (for verifies) |
| `node scripts/ryu-cursor-acp.mjs` | Cursor CLI ACP ↔ RYU |
| `npm run capture:demo` | Windows dock screenshots |

Bridge: `127.0.0.1:41999` · `~/.ryu/port` · `GET /agents` for live ring state

---

## Docs

- Agents: [`AGENTS.md`](./AGENTS.md) · memory [`memory/index.md`](./memory/index.md) · plan [`tasks/to-do.md`](./tasks/to-do.md) · lessons [`lessons/index.md`](./lessons/index.md) · external research [`references/index.md`](./references/index.md)
- Product loops: [`docs/product-and-feature-loops.md`](./docs/product-and-feature-loops.md)  
- UI source of truth: [`docs/parallel-work-split.md`](./docs/parallel-work-split.md) §6  
- Mac shell (notch / notice window): [`diff/mac/README.md`](./diff/mac/README.md) — status pipeline was ported to Windows; Mac-only chrome stays under `diff/mac/`
