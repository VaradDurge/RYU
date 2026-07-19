/**
 * Shared interactive lock for the overlay.
 * Ref-count hover + force flag so harness leave doesn't steal clicks
 * while the dock / permission card still needs them.
 */

let refs = 0
let forced = false

function apply(): void {
  window.ryu?.setInteractive?.(forced || refs > 0)
}

export function interactiveEnter(): void {
  refs += 1
  apply()
}

export function interactiveLeave(): void {
  refs = Math.max(0, refs - 1)
  apply()
}

export function interactiveForce(on: boolean): void {
  forced = on
  apply()
}

/** @deprecated use interactiveEnter/Leave */
export function setInteractiveHover(active: boolean): void {
  if (active) interactiveEnter()
  else interactiveLeave()
}

export function resetInteractiveHover(): void {
  refs = 0
  forced = false
  window.ryu?.setInteractive?.(false)
}
