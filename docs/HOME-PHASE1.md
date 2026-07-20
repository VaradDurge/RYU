# Phase 1 home validation (laptop only)

Remote suite may be green while these remain unchecked.

1. Start `npm run dev`, immediately trigger Claude Write while dock is loading — card appears from snapshot.
2. Reload renderer/window during a pending request — card returns.
3. Leave a request until timeout, click Approve — UI must not claim success.
4. With card open, click/type in IDE/terminal outside dock — input must pass through; Mac must not steal focus.
5. Two similar Claude writes — each needs its own decision unless they are the PreToolUse+PermissionRequest pair for one op.
6. Confirm `~/.ryu/token` exists after RYU starts; WSL hooks still fail open when RYU is stopped.
