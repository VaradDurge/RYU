# Stale ≠ idle

## Problem

Watchdogs mapped `running` / `approval` → `idle` when heartbeats stopped. The dock looked calm (blue) while RYU had no fresh evidence — or while a permission was still pending.

## What we learned

Uncertainty must stay visible. Expire to **`stale`** (gray), never silently to idle. Only explicit stop/session-end or a resolved request should clear to idle. Late lifecycle `idle` must not overwrite approval/stale while that agent still has a pending permission.

## Rule

Bridge revisions + pending-aware status reducer are authoritative. Do not calm the UI by inventing idle.
