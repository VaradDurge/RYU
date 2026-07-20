import type {
  ActionResult,
  AgentStatusUpdate,
  BridgeSnapshot,
  RyuDecision,
  RyuEvent
} from '../shared/types'

export {}

declare global {
  interface Window {
    ryu: {
      setInteractive: (interactive: boolean) => void
      setInteractiveBounds?: (
        bounds: { x: number; y: number; width: number; height: number } | null
      ) => void
      decide: (decision: RyuDecision) => Promise<ActionResult>
      dismiss: (id: string) => Promise<ActionResult>
      getSnapshot: () => Promise<BridgeSnapshot>
      onEvent: (handler: (event: RyuEvent) => void) => () => void
      onCancel: (handler: (id: string) => void) => () => void
      onAgentStatus: (handler: (update: AgentStatusUpdate) => void) => () => void
      isDev: () => boolean
      platform: 'darwin' | 'win32' | 'linux'
    }
  }
}
