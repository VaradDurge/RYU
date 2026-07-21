# Unique request id + constrained pairKey

**Problem:** Hashing session/tool/truncated content made one Approve release multiple real operations.

**Learned:** Each hook invocation needs its own `id`. Coalesce only PreToolUse ↔ PermissionRequest via `pairKey` (full content fingerprint, not truncated preview).

**Rule:** Never use preview truncation as authorization identity.
