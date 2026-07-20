import { useEffect, useRef, useState } from 'react'
import type {
  AgentStatusUpdate,
  IslandMode,
  RyuAgent,
  RyuDecision,
  RyuEvent
} from '../../../shared/types'
import type { AgentStatusMap, DockStatus } from '../types'
import { AGENT_LABELS, DOCK_AGENTS } from '../types'
import { clipSummary, fallbackSummary, summaryFromEvent } from './hoverSummary'
import type { SessionOpenMap } from './noticesFromStatuses'

const IDLE: AgentStatusMap = {
  cursor: 'idle',
  claude: 'idle',
  codex: 'idle'
}

const NO_SESSION: SessionOpenMap = {
  cursor: false,
  claude: false,
  codex: false
}

const IDLE_SUMMARIES: Record<RyuAgent, string> = {
  cursor: fallbackSummary('cursor', 'idle'),
  claude: fallbackSummary('claude', 'idle'),
  codex: fallbackSummary('codex', 'idle')
}

/** Drop “running” if hooks go quiet — prevents stuck green while you’re in WhatsApp */
const WATCHDOG_MS = 25_000
const ERROR_SETTLE_MS = 2800
const BRIDGE = 'http://127.0.0.1:41999'

export type AgentSummaryMap = Record<RyuAgent, string>

/**
 * Single source of truth for dock rings, session presence, and badge dots.
 */
export function useAgentStatuses(
  mode: IslandMode,
  event: RyuEvent | null,
  lastDecision: RyuDecision['decision'] | null
): {
  statuses: AgentStatusMap
  summaries: AgentSummaryMap
  sessionOpen: SessionOpenMap
  lastWorkspace: string | null
} {
  const [statuses, setStatuses] = useState<AgentStatusMap>(IDLE)
  const [summaries, setSummaries] = useState<AgentSummaryMap>(IDLE_SUMMARIES)
  const [sessionOpen, setSessionOpen] = useState<SessionOpenMap>(NO_SESSION)
  const [lastWorkspace, setLastWorkspace] = useState<string | null>(null)
  const timers = useRef<Partial<Record<RyuAgent, number>>>({})
  const watchdogs = useRef<Partial<Record<RyuAgent, number>>>({})
  const statusesRef = useRef(statuses)
  const summariesRef = useRef(summaries)
  const sessionRef = useRef(sessionOpen)
  statusesRef.current = statuses
  summariesRef.current = summaries
  sessionRef.current = sessionOpen
  const ignoreEchoUntil = useRef<Partial<Record<RyuAgent, number>>>({})

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

  const postBridge = (
    agent: RyuAgent,
    status: DockStatus,
    detail: string,
    session?: 'open' | 'closed'
  ) => {
    ignoreEchoUntil.current[agent] = Date.now() + 120
    void fetch(`${BRIDGE}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, status, detail, session })
    }).catch(() => {})
  }

  const setSession = (agent: RyuAgent, open: boolean) => {
    sessionRef.current = { ...sessionRef.current, [agent]: open }
    setSessionOpen(sessionRef.current)
  }

  const armWatchdog = (agent: RyuAgent) => {
    clearWatchdog(agent)
    watchdogs.current[agent] = window.setTimeout(() => {
      const cur = statusesRef.current[agent]
      if (cur === 'running' || cur === 'approval') {
        applyStatus(agent, 'idle', fallbackSummary(agent, 'idle'), true)
      }
      delete watchdogs.current[agent]
    }, WATCHDOG_MS)
  }

  const applyStatus = (
    agent: RyuAgent,
    status: DockStatus,
    detail?: string,
    publish = false,
    extras?: { session?: 'open' | 'closed'; path?: string }
  ) => {
    const line =
      detail && detail.trim()
        ? clipSummary(detail)
        : fallbackSummary(agent, status)

    if (extras?.path) setLastWorkspace(extras.path)

    if (extras?.session === 'open') setSession(agent, true)
    else if (extras?.session === 'closed') setSession(agent, false)
    else if (status === 'running' || status === 'approval' || status === 'error') {
      // Activity implies an open session for badge persistence
      setSession(agent, true)
    }

    const prev = statusesRef.current[agent]
    if (
      prev === status &&
      summariesRef.current[agent] === line &&
      !extras?.session
    ) {
      if (status === 'running' || status === 'approval') armWatchdog(agent)
      return
    }

    clearTimer(agent)
    statusesRef.current = { ...statusesRef.current, [agent]: status }
    summariesRef.current = { ...summariesRef.current, [agent]: line }
    setStatuses(statusesRef.current)
    setSummaries(summariesRef.current)

    if (status === 'running' || status === 'approval') {
      armWatchdog(agent)
    } else {
      clearWatchdog(agent)
    }

    if (status === 'error') {
      timers.current[agent] = window.setTimeout(() => {
        applyStatus(agent, 'idle', fallbackSummary(agent, 'idle'), true)
        delete timers.current[agent]
      }, ERROR_SETTLE_MS)
    }

    if (publish) {
      postBridge(
        agent,
        status,
        line,
        extras?.session ??
          (sessionRef.current[agent] ? 'open' : undefined)
      )
    }
  }

  useEffect(() => {
    if (!window.ryu?.onAgentStatus) return
    return window.ryu.onAgentStatus((update: AgentStatusUpdate) => {
      const until = ignoreEchoUntil.current[update.agent] ?? 0
      if (Date.now() < until) return
      applyStatus(update.agent, update.status, update.detail, false, {
        session: update.session,
        path: update.path
      })
    })
  }, [])

  useEffect(() => {
    if (!event) return
    if (mode !== 'attention' && mode !== 'expanded') return
    applyStatus(event.agent, 'approval', summaryFromEvent(event), true, {
      session: 'open',
      path: event.path
    })
  }, [event?.id, event?.agent, mode, event?.path])

  useEffect(() => {
    if (mode !== 'resolved' || !event || !lastDecision) return
    if (lastDecision === 'deny') {
      applyStatus(
        event.agent,
        'error',
        `${AGENT_LABELS[event.agent]} · Denied`,
        true,
        { session: 'open' }
      )
    } else {
      applyStatus(
        event.agent,
        'running',
        clipSummary(event.preview || 'Approved — continuing'),
        true,
        { session: 'open' }
      )
    }
  }, [mode, lastDecision, event?.id, event?.agent])

  useEffect(() => {
    if (event) return
    if (mode !== 'idle') return
    for (const agent of DOCK_AGENTS) {
      if (statusesRef.current[agent] === 'approval') {
        applyStatus(agent, 'idle', fallbackSummary(agent, 'idle'), true)
      }
    }
  }, [event, mode])

  useEffect(() => {
    return () => {
      for (const agent of DOCK_AGENTS) {
        clearTimer(agent)
        clearWatchdog(agent)
      }
    }
  }, [])

  return { statuses, summaries, sessionOpen, lastWorkspace }
}

export function anyAgentActive(statuses: AgentStatusMap): boolean {
  return DOCK_AGENTS.some((a) => statuses[a] !== 'idle')
}
