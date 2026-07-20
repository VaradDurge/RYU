import { useEffect, useRef, useState } from 'react'
import type { AgentActivityEvent, RyuAgent } from '../../../shared/types'

const POLL_MS = 1200

/**
 * Live + transcript activity for the hover panel.
 * Polls disk transcripts while open; merges bridge live pushes.
 */
export function useAgentActivity(
  agent: RyuAgent | null,
  workspace: string | null | undefined,
  enabled: boolean
): {
  events: AgentActivityEvent[]
  loading: boolean
} {
  const [events, setEvents] = useState<AgentActivityEvent[]>([])
  const [loading, setLoading] = useState(false)
  const agentRef = useRef(agent)
  agentRef.current = agent

  useEffect(() => {
    if (!enabled || !agent) {
      setEvents([])
      setLoading(false)
      return
    }

    let cancelled = false
    let lastFp = ''
    setLoading(true)

    const refresh = async () => {
      if (!window.ryu?.getAgentActivity) {
        setLoading(false)
        return
      }
      try {
        const next = await window.ryu.getAgentActivity({
          agent,
          workspace
        })
        if (cancelled || agentRef.current !== agent) return
        // Skip identical polls so AnimatePresence doesn't remount the feed.
        const fp = next.map((e) => e.id).join('\n')
        if (fp === lastFp) return
        lastFp = fp
        setEvents(next)
      } catch {
        // fail-open
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void refresh()
    const poll = window.setInterval(() => void refresh(), POLL_MS)

    const unsub = window.ryu?.onAgentActivity?.((event) => {
      if (event.agent !== agentRef.current) return
      setEvents((prev) => {
        const key = `${event.kind}|${event.title}|${event.detail || ''}`
        if (prev.some((e) => `${e.kind}|${e.title}|${e.detail || ''}` === key)) {
          return prev
        }
        const next = [...prev, event].slice(-100)
        lastFp = next.map((e) => e.id).join('\n')
        return next
      })
    })

    return () => {
      cancelled = true
      window.clearInterval(poll)
      unsub?.()
    }
  }, [agent, workspace, enabled])

  return { events, loading }
}
