import type { RyuAgent } from '../../shared/types'

/** Presentational dock slots (demo + real agents). Real events still use RyuAgent. */
export type DockSlotId = RyuAgent | 'cube' | 'sparkle' | 'terminal' | 'sailboat' | 'add'

/**
 * Live agent ring status:
 * - idle     → blue (known idle / finished)
 * - running  → green (processing)
 * - approval → yellow (needs permission)
 * - error    → red (error / deny / destructive fail)
 * - stale    → gray (no fresh evidence; not idle)
 */
export type LiveAgentStatus = 'idle' | 'running' | 'approval' | 'error' | 'stale'

/** @deprecated Prefer LiveAgentStatus for real agents; kept for decorative slots */
export type DockStatus = LiveAgentStatus | 'ok' | 'waiting' | 'danger' | 'muted'

export type AgentStatusMap = Record<RyuAgent, LiveAgentStatus>

/** Real agents in the dock — Cursor first for status wiring. */
export const DOCK_AGENTS: RyuAgent[] = ['cursor', 'claude', 'codex']

export const AGENT_LABELS: Record<RyuAgent, string> = {
  cursor: 'Cursor',
  claude: 'Claude',
  codex: 'Codex'
}

export interface DockSlot {
  id: DockSlotId
  /** Maps to a real RyuEvent agent when applicable */
  agent?: RyuAgent
  label: string
  status: DockStatus
  selectable: boolean
}
