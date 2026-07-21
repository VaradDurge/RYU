# Claude Code hooks (external)

Fetched ~2026-07-20.

## Links

- Guide: https://code.claude.com/docs/en/hooks-guide
- Reference: https://code.claude.com/docs/en/hooks

## Facts for RYU

- `PermissionRequest` — fires when a permission dialog would show; can answer for the user.
- `PreToolUse` — before tool runs; can allow/deny/ask via `permissionDecision`.
- **Stdout must be wrapped** in `hookSpecificOutput` (flat JSON is ignored).
- PermissionRequest shape (command hooks):

```json
{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}
```

Deny uses `"behavior":"deny"`. Do **not** use `permissionDecision` on PermissionRequest (wrong event shape; see community bug reports).
- PreToolUse uses `permissionDecision`: `allow` | `deny` | `ask`.
- Fail-open for RYU: exit 0 with no decision / `ask` so Claude’s normal prompt appears.
- Keep matchers narrow (`Write|Edit|Bash`) — broad matchers = spam.

## Repo touchpoints

`hooks/ryu-hook.mjs` · `npm run hook:install` · `verify:claude-resume`
