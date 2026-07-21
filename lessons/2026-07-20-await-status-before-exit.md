# Await status POST before hook exit

**Problem:** Deny/allow used `void postStatus(...)` then `process.exit(0)` — ring often never reached `error`/`running`.

**Learned:** Fire-and-forget fetch loses to process exit. Track A S3 failed until we `await postStatus`.

**Rule:** On decision paths, await bridge status (short timeout OK) before emit + exit.
