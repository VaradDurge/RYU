import type { AgentStatusUpdate, RyuDecision, RyuEvent } from '../shared/types'

export {}

declare global {
  interface Window {
    ryu: {
      setInteractive: (interactive: boolean) => void
      decide: (decision: RyuDecision) => void
      onEvent: (handler: (event: RyuEvent) => void) => () => void
      onCancel: (handler: (id: string) => void) => () => void
      onAgentStatus: (handler: (update: AgentStatusUpdate) => void) => () => void
      isDev: () => boolean
      platform: 'darwin' | 'win32' | 'linux'
    }
  }
}
