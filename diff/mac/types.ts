import type { RyuAgent } from '../../shared/types'

/**
 * Live agent ring status:
 * - idle     → blue (idle or finished)
 * - running  → green (processing)
 * - approval → yellow (needs permission)
 * - error    → red (error / deny / destructive fail)
 */
export type DockStatus = 'idle' | 'running' | 'approval' | 'error'

export type AgentStatusMap = Record<RyuAgent, DockStatus>

/** Real agents shown in the Mac dock (no mock icons). Cursor first. */
export const DOCK_AGENTS: RyuAgent[] = ['cursor', 'claude', 'codex']

export const AGENT_LABELS: Record<RyuAgent, string> = {
  cursor: 'Cursor',
  claude: 'Claude',
  codex: 'Codex'
}
