import type {
  AgentStatusMeta,
  AgentStatusUpdate,
  BridgeHealth,
  BridgeSnapshot,
  RyuAgent,
  RyuDecision,
  RyuEvent
} from './types'

export const DEFAULT_PORT: number
export const DECISION_TIMEOUT_MS: number
export const AGENT_STATUS_WATCHDOG_MS: number
export const MAX_BODY_BYTES: number
export const MAX_EVENT_DETAIL_BYTES: number
export const PAIR_WINDOW_MS: number
export const AGENTS: RyuAgent[]
export const STATUSES: Array<AgentStatusUpdate['status']>
export const HOOK_KINDS: Array<'PreToolUse' | 'PermissionRequest'>

export function validateEvent(raw: unknown): { ok: true; event: RyuEvent } | { ok: false; error: string }
export function validateDecision(
  raw: unknown
): { ok: true; decision: RyuDecision } | { ok: false; error: string }
export function shouldPairWith(
  existing: { pairKey?: string; hookKinds: Set<string> },
  incoming: { pairKey?: string; hookKind?: string }
): boolean
export function computeInteractiveBounds(
  workArea: { x: number; y: number; width: number; height: number },
  mode?: 'idle' | 'dock' | 'expanded'
): { x: number; y: number; width: number; height: number; mode: string }
export function isLoopbackHost(host: string): boolean

export class RyuBridgeCore {
  constructor(options?: {
    port?: number
    token?: string
    requireAuth?: boolean
    headless?: boolean
    onEvent?: (event: RyuEvent) => void
    onCancel?: (id: string) => void
    onAgentStatus?: (update: AgentStatusUpdate) => void
  })
  start(): Promise<number>
  stop(): void
  getSnapshot(): BridgeSnapshot
  getToken(): string
  applyAgentStatus(
    agent: RyuAgent,
    status: AgentStatusUpdate['status'],
    detail?: string
  ): {
    ok: boolean
    ignored?: boolean
    reason?: string
    agents: Record<RyuAgent, AgentStatusUpdate['status']>
    revision: number
    agentMeta: Record<RyuAgent, AgentStatusMeta>
  }
  healthSnapshot(): BridgeHealth
  resolveDecision(decision: RyuDecision): { ok: boolean; reason?: string }
  dismiss(id: string): { ok: boolean; reason?: string }
}
