import { useEffect, useRef, useState } from 'react'
import type {
  AgentStatusUpdate,
  IslandMode,
  RyuAgent,
  RyuDecision,
  RyuEvent
} from '../../../shared/types'
import type { AgentStatusMap, DockStatus } from '../types'
import { DOCK_AGENTS } from '../types'
import { clipSummary, fallbackSummary, summaryFromEvent } from './hoverSummary'

const IDLE: AgentStatusMap = {
  cursor: 'idle',
  claude: 'idle',
  codex: 'idle'
}

const IDLE_SUMMARIES: Record<RyuAgent, string> = {
  cursor: fallbackSummary('cursor', 'idle'),
  claude: fallbackSummary('claude', 'idle'),
  codex: fallbackSummary('codex', 'idle')
}

const WATCHDOG_MS = 45_000
const ERROR_SETTLE_MS = 2800

export type AgentSummaryMap = Record<RyuAgent, string>

/**
 * Live per-agent dock rings + hover summaries from bridge POST /status.
 * Notch dots are owned by the main process (see noticeState.ts).
 */
export function useAgentStatuses(
  mode: IslandMode,
  event: RyuEvent | null,
  lastDecision: RyuDecision['decision'] | null
): {
  statuses: AgentStatusMap
  summaries: AgentSummaryMap
} {
  const [statuses, setStatuses] = useState<AgentStatusMap>(IDLE)
  const [summaries, setSummaries] = useState<AgentSummaryMap>(IDLE_SUMMARIES)
  const timers = useRef<Partial<Record<RyuAgent, number>>>({})
  const watchdogs = useRef<Partial<Record<RyuAgent, number>>>({})
  const statusesRef = useRef(statuses)
  statusesRef.current = statuses

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
      setStatuses((s) => {
        if (s[agent] === 'running' || s[agent] === 'approval') {
          return { ...s, [agent]: 'idle' as DockStatus }
        }
        return s
      })
      setSummaries((s) => ({ ...s, [agent]: fallbackSummary(agent, 'idle') }))
      // Mirror idle to bridge so notch dots update too
      void fetch('http://127.0.0.1:41999/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent,
          status: 'idle',
          detail: fallbackSummary(agent, 'idle')
        })
      }).catch(() => {})
      delete watchdogs.current[agent]
    }, WATCHDOG_MS)
  }

  const applyStatus = (agent: RyuAgent, status: DockStatus, detail?: string) => {
    clearTimer(agent)
    setStatuses((s) => ({ ...s, [agent]: status }))

    const line =
      detail && detail.trim()
        ? clipSummary(detail)
        : fallbackSummary(agent, status)
    setSummaries((s) => ({ ...s, [agent]: line }))

    if (status === 'running' || status === 'approval') {
      armWatchdog(agent)
    } else {
      clearWatchdog(agent)
    }

    if (status === 'error') {
      timers.current[agent] = window.setTimeout(() => {
        setStatuses((s) => ({ ...s, [agent]: 'idle' as DockStatus }))
        setSummaries((s) => ({ ...s, [agent]: fallbackSummary(agent, 'idle') }))
        delete timers.current[agent]
      }, ERROR_SETTLE_MS)
    }
  }

  useEffect(() => {
    if (!window.ryu?.onAgentStatus) return
    return window.ryu.onAgentStatus((update: AgentStatusUpdate) => {
      applyStatus(update.agent, update.status, update.detail)
    })
  }, [])

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
      applyStatus(
        event.agent,
        'running',
        clipSummary(event.preview || 'Approved — continuing')
      )
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

  return { statuses, summaries }
}

export function anyAgentActive(statuses: AgentStatusMap): boolean {
  return DOCK_AGENTS.some((a) => statuses[a] !== 'idle')
}
