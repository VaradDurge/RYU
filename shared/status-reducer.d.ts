import type { AgentLiveStatus, RyuAgent } from './types'

export const AGENTS: RyuAgent[]
export const LIVE_STATUSES: AgentLiveStatus[]
export const INTEGRATION_STATES: Array<'unknown' | 'active' | 'stale' | 'not-configured'>

export interface StatusHealth {
  bridge: 'unknown' | 'started' | 'unavailable'
  port: number | null
  reason: string | null
  startedAt: number | null
}

export interface AgentStatusState {
  statuses: Record<RyuAgent, AgentLiveStatus>
  revisions: Record<RyuAgent, number>
  receivedAt: Record<RyuAgent, number>
  details: Record<RyuAgent, string | null>
  integration: Record<RyuAgent, 'unknown' | 'active' | 'stale' | 'not-configured'>
  health: StatusHealth
}

export function initialStatusState(): AgentStatusState
export function shouldApplyStatus(
  state: AgentStatusState,
  update: { agent: RyuAgent; status: AgentLiveStatus; revision: number },
  options?: { pendingAgents?: Set<RyuAgent> }
): boolean
export function applyStatusUpdate(
  state: AgentStatusState,
  update: {
    agent: RyuAgent
    status: AgentLiveStatus
    revision: number
    receivedAt?: number
    detail?: string | null
  },
  options?: { pendingAgents?: Set<RyuAgent>; integration?: AgentStatusState['integration'][RyuAgent] }
): AgentStatusState
export function applyStatusSnapshot(state: AgentStatusState, snapshot: Record<string, unknown>): AgentStatusState
export function reduceAgentStatus(
  state: AgentStatusState | undefined,
  action: Record<string, unknown>
): AgentStatusState
export function boundDetail(raw: unknown, maxBytes?: number): { text: string | undefined; truncated: boolean }
