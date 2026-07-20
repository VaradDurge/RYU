export type RyuAgent = 'claude' | 'codex' | 'cursor'

export type RyuRisk = 'normal' | 'destructive'

/** If no /status refresh for running|approval, fall back to idle (bridge + UI). Override with RYU_WATCHDOG_MS. */
export const AGENT_STATUS_WATCHDOG_MS = 45_000

export interface RyuEvent {
  id: string
  agent: RyuAgent
  sessionLabel: string
  tool: string
  preview: string
  /** Optional workspace path shown in expanded permission card */
  path?: string
  risk?: RyuRisk
  ts: number
}

export interface RyuDecision {
  id: string
  decision: 'allow' | 'deny'
  reason?: string
}

export type IslandMode = 'idle' | 'attention' | 'expanded' | 'resolved'

/** Live dock ring update (from Cursor/Claude hooks via bridge POST /status) */
export type AgentLiveStatus = 'idle' | 'running' | 'approval' | 'error'

export interface AgentStatusUpdate {
  agent: RyuAgent
  status: AgentLiveStatus
  detail?: string
}

export interface BridgeDecisionResponse {
  status: 'allow' | 'deny' | 'timeout' | 'cancelled'
  decision?: RyuDecision
}
