/**
 * Shared interactive lock for Mac overlay.
 * Prevents the demo harness mouseleave from re-enabling click-through
 * while the island / permission card still needs clicks.
 */

let refs = 0
let forced = false

function apply() {
  const on = forced || refs > 0
  window.ryu?.setInteractive?.(on)
}

/** Begin hovering an interactive surface (island, harness, etc.). */
export function interactiveEnter(): void {
  refs += 1
  apply()
}

/** End hovering an interactive surface. */
export function interactiveLeave(): void {
  refs = Math.max(0, refs - 1)
  apply()
}

/** Force interactive while permission UI must accept clicks (expanded / resolved). */
export function interactiveForce(on: boolean): void {
  forced = on
  apply()
}
