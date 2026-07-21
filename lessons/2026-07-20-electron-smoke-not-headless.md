# Electron smoke ≠ headless contract

## Problem

Track A/B and Phase 1/2 headless suites can be green while the shipped Electron main/preload/renderer path is unproven. Reloading the renderer mid-session can also wedge Playwright evaluate calls if tests keep using the same page carelessly.

## What we learned

Phase 3 requires a real Electron launch (`verify:phase3-proof`). Remote contracts supplement it; they never replace it. Keep healthy-path smoke cases before destructive reload when possible, and always label Home live proof separately.

## Rule

Do not call Phase 3 complete from headless results alone. Do not mark adapters live-proven from spawned hooks.
