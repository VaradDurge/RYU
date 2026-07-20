import { useEffect, useRef, useState } from 'react'
import {
  AGENT_STATUS_WATCHDOG_MS,
  type AgentStatusUpdate,
  type IslandMode,
  type RyuAgent,
  type RyuDecision,
  type RyuEvent
} from '../../shared/types'
import {
  applyStatusUpdate,
  initialStatusState,
  reduceAgentStatus,
  type AgentStatusState
} from '../../shared/status-reducer.mjs'
import type { AgentStatusMap, LiveAgentStatus } from './dockTypes'
import { DOCK_AGENTS } from './dockTypes'
import { clipSummary, fallbackSummary, summaryFromEvent } from './hoverSummary'

const IDLE_SUMMARIES: Record<RyuAgent, string> = {
  cursor: fallbackSummary('cursor', 'idle'),
  claude: fallbackSummary('claude', 'idle'),
  codex: fallbackSummary('codex', 'idle')
}

/** Local fallback only — bridge watchdog is authoritative. Override with RYU_WATCHDOG_MS in bridge. */
const WATCHDOG_MS = AGENT_STATUS_WATCHDOG_MS
const ERROR_SETTLE_MS = 2800

export type AgentSummaryMap = Record<RyuAgent, string>

function pendingSet(event: RyuEvent | null, mode: IslandMode): Set<RyuAgent> {
  const set = new Set<RyuAgent>()
  if (event && (mode === 'attention' || mode === 'expanded')) set.add(event.agent)
  return set
}

/**
 * Live per-agent rings + short hover summaries from bridge POST /status.
 * Applies revisions so late/out-of-order updates cannot erase newer state.
 */
export function useAgentStatuses(
  mode: IslandMode,
  event: RyuEvent | null,
  lastDecision: RyuDecision['decision'] | null
): {
  statuses: AgentStatusMap
  summaries: AgentSummaryMap
  health: AgentStatusState['health']
} {
  const [statusState, setStatusState] = useState<AgentStatusState>(() => initialStatusState())
  const [summaries, setSummaries] = useState<AgentSummaryMap>(IDLE_SUMMARIES)
  const timers = useRef<Partial<Record<RyuAgent, number>>>({})
  const watchdogs = useRef<Partial<Record<RyuAgent, number>>>({})
  const stateRef = useRef(statusState)
  stateRef.current = statusState
  const eventRef = useRef(event)
  eventRef.current = event
  const modeRef = useRef(mode)
  modeRef.current = mode

  const clearTimer = (agent: RyuAgent) => {
    const t = timers.current[agent]
    if (t) {
      window.clearTimeout(t)
      delete timers.current[agent]
    }
  }

  const clearWatchdog = (agent: RyuAgent) => {
    const t = watchdogs.current[agent]
    if (t) {
      window.clearTimeout(t)
      delete watchdogs.current[agent]
    }
  }

  const armWatchdog = (agent: RyuAgent) => {
    clearWatchdog(agent)
    watchdogs.current[agent] = window.setTimeout(() => {
      setStatusState((s) =>
        reduceAgentStatus(s, {
          type: 'markStale',
          agent,
          pendingAgents: pendingSet(eventRef.current, modeRef.current)
        })
      )
      setSummaries((sum) => ({ ...sum, [agent]: fallbackSummary(agent, 'stale') }))
      delete watchdogs.current[agent]
    }, WATCHDOG_MS)
  }

  const applyStatus = (agent: RyuAgent, status: LiveAgentStatus, detail?: string, revision?: number) => {
    clearTimer(agent)
    const rev =
      typeof revision === 'number' && revision > 0
        ? revision
        : (stateRef.current.revisions[agent] || 0) + 1

    setStatusState((s) => {
      const next = applyStatusUpdate(
        s,
        { agent, status, revision: rev, receivedAt: Date.now(), detail },
        { pendingAgents: pendingSet(eventRef.current, modeRef.current) }
      )
      return next
    })

    const line =
      detail && detail.trim() ? clipSummary(detail) : fallbackSummary(agent, status)
    setSummaries((sum) => ({ ...sum, [agent]: line }))

    if (status === 'running' || status === 'approval') {
      armWatchdog(agent)
    } else {
      clearWatchdog(agent)
    }

    if (status === 'error') {
      timers.current[agent] = window.setTimeout(() => {
        setStatusState((s) =>
          applyStatusUpdate(
            s,
            {
              agent,
              status: 'idle',
              revision: (s.revisions[agent] || 0) + 1,
              receivedAt: Date.now()
            },
            { pendingAgents: pendingSet(eventRef.current, modeRef.current) }
          )
        )
        setSummaries((sum) => ({ ...sum, [agent]: fallbackSummary(agent, 'idle') }))
        delete timers.current[agent]
      }, ERROR_SETTLE_MS)
    }
  }

  useEffect(() => {
    if (!window.ryu?.onAgentStatus) return
    return window.ryu.onAgentStatus((update: AgentStatusUpdate) => {
      applyStatus(update.agent, update.status, update.detail, update.revision)
    })
  }, [])

  // Hydrate statuses + health from bridge snapshot (P2.4 / P2.5).
  useEffect(() => {
    void (async () => {
      try {
        const snap = await window.ryu?.getSnapshot?.()
        if (!snap) {
          setStatusState((s) =>
            reduceAgentStatus(s, {
              type: 'health',
              health: { bridge: 'unavailable', reason: 'no_snapshot' }
            })
          )
          return
        }
        setStatusState((s) =>
          reduceAgentStatus(s, {
            type: 'snapshot',
            snapshot: {
              agents: snap.agents,
              agentMeta: snap.agentMeta,
              health: snap.health || { bridge: 'started' },
              pendingAgents: pendingSet(eventRef.current, modeRef.current)
            }
          })
        )
        if (snap.agents) {
          setSummaries((sum) => {
            const next = { ...sum }
            for (const agent of DOCK_AGENTS) {
              const st = snap.agents[agent]
              if (!st) continue
              const detail = snap.agentMeta?.[agent]?.detail
              next[agent] =
                detail && String(detail).trim()
                  ? clipSummary(String(detail))
                  : fallbackSummary(agent, st)
            }
            return next
          })
        }
      } catch {
        setStatusState((s) =>
          reduceAgentStatus(s, {
            type: 'health',
            health: { bridge: 'unavailable', reason: 'snapshot_failed' }
          })
        )
      }
    })()
  }, [])

  // Permission pending → yellow + preview line (local bump; bridge may confirm).
  useEffect(() => {
    if (!event) return
    if (mode !== 'attention' && mode !== 'expanded') return
    applyStatus(event.agent, 'approval', summaryFromEvent(event))
  }, [event?.id, event?.agent, mode])

  useEffect(() => {
    if (mode !== 'resolved' || !event || !lastDecision) return
    if (lastDecision === 'deny') {
      applyStatus(event.agent, 'error', `${event.agent} · Denied`)
    } else {
      applyStatus(event.agent, 'running', clipSummary(event.preview || 'Approved — continuing'))
    }
  }, [mode, lastDecision, event?.id, event?.agent])

  useEffect(() => {
    return () => {
      for (const agent of DOCK_AGENTS) {
        clearTimer(agent)
        clearWatchdog(agent)
      }
    }
  }, [])

  return {
    statuses: statusState.statuses,
    summaries,
    health: statusState.health
  }
}

export function anyAgentActive(statuses: AgentStatusMap): boolean {
  return DOCK_AGENTS.some((a) => statuses[a] !== 'idle')
}
