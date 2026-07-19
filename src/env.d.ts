import type { RyuDecision, RyuEvent } from '../shared/types'

export {}

declare global {
  interface Window {
    ryu: {
      setInteractive: (interactive: boolean) => void
      decide: (decision: RyuDecision) => void
      onEvent: (handler: (event: RyuEvent) => void) => () => void
      isDev: () => boolean
    }
  }
}
