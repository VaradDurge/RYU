import { useEffect, useMemo } from 'react'
import type { RyuAgent } from '../../../shared/types'
import type { AgentStatusMap } from '../types'
import {
  noticesFromStatuses,
  type SessionOpenMap
} from './noticesFromStatuses'

export type NotchNoticeKind = 'idle' | 'running' | 'permission' | 'failed'

export interface NotchNotice {
  id: string
  agent: RyuAgent
  kind: NotchNoticeKind
  ts: number
}

/**
 * Pushes menu-bar badges only for agents with an open session (or live activity).
 */
export function NotchNotices({
  statuses,
  sessionOpen,
  onSelect
}: {
  statuses: AgentStatusMap
  sessionOpen: SessionOpenMap
  onSelect: (agent: RyuAgent) => void
}) {
  const notices = useMemo(
    () => noticesFromStatuses(statuses, sessionOpen),
    [statuses, sessionOpen]
  )

  useEffect(() => {
    window.ryu?.setNotices?.(notices)
  }, [notices])

  useEffect(() => {
    if (!window.ryu?.onNoticeClicked) return
    return window.ryu.onNoticeClicked(({ agent }) => {
      onSelect(agent)
    })
  }, [onSelect])

  useEffect(() => {
    return () => {
      window.ryu?.setNotices?.([])
    }
  }, [])

  return null
}
