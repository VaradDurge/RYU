import type { RyuAgent } from '../../../shared/types'
import type { AgentStatusMap, DockStatus } from '../types'
import { DOCK_AGENTS } from '../types'
import type { NotchNotice, NotchNoticeKind } from './NotchNotices'

export type SessionOpenMap = Record<RyuAgent, boolean>

/** Dock status → badge color. */
function kindFor(status: DockStatus): NotchNoticeKind {
  if (status === 'approval') return 'permission'
  if (status === 'error') return 'failed'
  if (status === 'running') return 'running'
  return 'idle'
}

/**
 * Agents that should appear in the dock / menu-bar:
 * open session (available) or currently active — never show unused agents.
 */
export function visibleAgents(
  sessionOpen: SessionOpenMap,
  statuses: AgentStatusMap
): RyuAgent[] {
  return DOCK_AGENTS.filter(
    (agent) => sessionOpen[agent] || statuses[agent] !== 'idle'
  )
}

/**
 * One badge per *visible* agent, colored from live status.
 * Unused agents (no session, idle) are omitted — e.g. Codex when never used.
 */
export function noticesFromStatuses(
  statuses: AgentStatusMap,
  sessionOpen: SessionOpenMap
): NotchNotice[] {
  return visibleAgents(sessionOpen, statuses).map((agent) => ({
    id: `${agent}-badge`,
    agent,
    kind: kindFor(statuses[agent]),
    ts: Date.now()
  }))
}
