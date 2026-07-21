# Cursor hooks (external)

Fetched ~2026-07-20.

## Links

- Official: https://cursor.com/docs/hooks

## Facts for RYU

- Config: project `.cursor/hooks.json` and/or user `~/.cursor/hooks.json`. JSON over stdio.
- Agent lifecycle events include `sessionStart` / `sessionEnd`, `preToolUse` / `postToolUse`, `beforeShellExecution`, `afterFileEdit`, `stop`, etc.
- Project hooks cwd = project root; paths relative to that.
- Good for **observe** (status rings) or selective gate — gating *every* tool/shell floods UX (our lesson).
- Cloud VMs: user-level `~/.cursor/hooks.json` generally not available; project hooks in-repo are the portable path.

## Repo touchpoints

`.cursor/hooks.json` · `hooks/ryu-cursor-status.mjs` · `verify:cursor-status`  
Product rule: status-only for Cursor IDE; Approve/Deny is Claude Resume (+ optional ACP).
