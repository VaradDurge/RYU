/**
 * Click-through for the Mac overlay.
 * Default: click-through. Capture only while the pointer is over the island.
 *
 * Toggling setIgnoreMouseEvents can synthesize a mouseleave in Chromium —
 * callers should ignore leave for a short window after enter (see IslandMac).
 */

let hoverRefs = 0
let lastCaptureAt = 0

function apply() {
  const on = hoverRefs > 0
  if (on) lastCaptureAt = Date.now()
  window.ryu?.setInteractive?.(on)
}

/** Pointer entered the island hover zone */
export function interactiveEnter(): void {
  hoverRefs += 1
  apply()
}

/** Pointer left the island hover zone */
export function interactiveLeave(): void {
  hoverRefs = Math.max(0, hoverRefs - 1)
  apply()
}

/** True for a brief window after capture turns on (ignore synthetic leaves) */
export function recentlyCaptured(ms = 220): boolean {
  return Date.now() - lastCaptureAt < ms
}

/** @deprecated */
export function interactiveForce(_on: boolean): void {
  apply()
}

/** Hard reset — restores click-through immediately */
export function interactiveReset(): void {
  hoverRefs = 0
  apply()
}
