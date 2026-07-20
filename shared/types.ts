export type RyuAgent = 'claude' | 'codex' | 'cursor'

export type RyuRisk = 'normal' | 'destructive'

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

/** Session presence for menu-bar badges (independent of ring color) */
export type AgentSessionPresence = 'open' | 'closed'

export interface AgentStatusUpdate {
  agent: RyuAgent
  status: AgentLiveStatus
  detail?: string
  /** When set, opens/closes the persistent menu-bar badge for this agent */
  session?: AgentSessionPresence
  /** Optional workspace path for prompt spawn / permission context */
  path?: string
  /** Skip mirroring this status line into the activity feed (e.g. delivered prompts) */
  quiet?: boolean
}

/** Scrollable activity feed item (hover panel / Agents-style view) */
export type AgentActivityKind =
  | 'prompt'
  | 'message'
  | 'tool'
  | 'shell'
  | 'edit'
  | 'status'
  | 'error'
  | 'permission'

export interface AgentActivityEvent {
  id: string
  agent: RyuAgent
  kind: AgentActivityKind
  title: string
  /** Optional body — command, path, assistant excerpt */
  detail?: string
  ts: number
  path?: string
}

export interface BridgeDecisionResponse {
  status: 'allow' | 'deny' | 'timeout' | 'cancelled'
  decision?: RyuDecision
}
