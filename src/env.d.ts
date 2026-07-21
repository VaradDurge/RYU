import type {
  ActionResult,
  AgentStatusUpdate,
  BridgeDiagnostics,
  BridgeHealth,
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
        bounds: { x: number; y: number; width: number; height: number; mode?: string } | null
      ) => void
      decide: (decision: RyuDecision) => Promise<ActionResult>
      dismiss: (id: string) => Promise<ActionResult>
      getSnapshot: () => Promise<BridgeSnapshot>
      getDiagnostics?: () => Promise<BridgeDiagnostics>
      retryBridge?: () => Promise<{ ok: boolean; reason?: string; port?: number }>
      onEvent: (handler: (event: RyuEvent) => void) => () => void
      onCancel: (handler: (id: string) => void) => () => void
      onAgentStatus: (handler: (update: AgentStatusUpdate) => void) => () => void
      onHealth?: (handler: (health: BridgeHealth) => void) => () => void
      smokeProbe?: () => Promise<{
        ok: boolean
        usesSharedCore: boolean
        core: string
        lifecycle: string
        port: number
        boundPort: number | null
        reason: string | null
        hasTokenField: boolean
      }>
      isDev: () => boolean
      platform: 'darwin' | 'win32' | 'linux'
    }
  }
}
