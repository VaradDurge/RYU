# Headless contracts are not Electron proof

**Problem:** Track A/B use `scripts/headless-bridge.mjs`, a duplicate bridge implementation; they skip IPC, renderer hydration, native input, and real agents.

**Learned:** Green S1–S12 proves hook/HTTP contracts only.

**Rule:** State verification scope precisely. Add shared bridge core + Electron/renderer tests before calling the user loop reliable.
