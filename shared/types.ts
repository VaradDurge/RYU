export type RyuAgent = 'claude' | 'codex' | 'cursor'

export type RyuRisk = 'normal' | 'destructive'

export type RyuHookKind = 'PreToolUse' | 'PermissionRequest'

/** If no /status refresh for running|approval, fall back to stale (bridge + UI). Override with RYU_WATCHDOG_MS. */
export const AGENT_STATUS_WATCHDOG_MS = 45_000

/** Max UTF-8 bytes for optional structured detail on permission events. */
export const MAX_EVENT_DETAIL_BYTES = 2048

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
  /** Constrained pair key for PreToolUse ↔ PermissionRequest only */
  pairKey?: string
  hookKind?: RyuHookKind
  /** Bounded structured detail for Understand card disclosure */
  detail?: string
  detailTruncated?: boolean
}

export interface RyuDecision {
  id: string
  decision: 'allow' | 'deny'
  reason?: string
}

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: 'unknown' | 'expired' | 'unavailable' | 'invalid' }

export type BridgeHealthState = 'unknown' | 'started' | 'unavailable'

export type AgentIntegrationState = 'unknown' | 'active' | 'stale' | 'not-configured'

export interface AgentStatusMeta {
  revision: number
  lastSeenAt: number
  detail?: string | null
  source?: string
  integration: AgentIntegrationState
}

export interface BridgeHealth {
  bridge: BridgeHealthState
  port?: number | null
  reason?: string | null
  startedAt?: number | null
  auth?: boolean
}

export interface BridgeSnapshot {
  revision: number
  events: RyuEvent[]
  ids: string[]
  agents: Record<RyuAgent, AgentLiveStatus>
  agentMeta?: Record<RyuAgent, AgentStatusMeta>
  health?: BridgeHealth
}

export type IslandMode = 'idle' | 'attention' | 'expanded' | 'resolved'

/**
 * Live dock ring update (from Cursor/Claude hooks via bridge POST /status).
 * stale = RYU no longer has fresh evidence (not the same as idle).
 */
export type AgentLiveStatus = 'idle' | 'running' | 'approval' | 'error' | 'stale'

export interface AgentStatusUpdate {
  agent: RyuAgent
  status: AgentLiveStatus
  detail?: string
  revision?: number
  receivedAt?: number
}

export interface BridgeDecisionResponse {
  status: 'allow' | 'deny' | 'timeout' | 'cancelled'
  decision?: RyuDecision
}
