import { useEffect, useMemo } from 'react'
import type { RyuAgent } from '../../../shared/types'

export type NotchNoticeKind = 'finished' | 'failed'

export interface NotchNotice {
  id: string
  agent: RyuAgent
  kind: NotchNoticeKind
  ts: number
}

/** Priority: failed (red) > finished (blue). One dot = highest across all agents. */
const KIND_PRIORITY: Record<NotchNoticeKind, number> = { failed: 2, finished: 1 }

/**
 * Pushes finish/fail dots to the dedicated Mac notice window.
 * Collapses to ONE dot colored by the highest-priority notice.
 * Dots persist until the user opens the island (peek / hover).
 */
export function NotchNotices({
  notices,
  onDismiss,
  onSelect,
  islandOpen
}: {
  notices: NotchNotice[]
  onDismiss: (id: string) => void
  onSelect: (agent: RyuAgent) => void
  islandOpen: boolean
}) {
  // Pick the single highest-priority notice to display
  const top = useMemo(() => {
    if (notices.length === 0) return null
    return notices.reduce((best, n) =>
      KIND_PRIORITY[n.kind] > KIND_PRIORITY[best.kind] ? n : best
    )
  }, [notices])

  const payload = useMemo(() => (top ? [top] : []), [top])

  useEffect(() => {
    window.ryu?.setNotices?.(payload)
  }, [payload])

  // Island opened → dismiss all notices
  useEffect(() => {
    if (islandOpen && notices.length > 0) {
      for (const n of notices) onDismiss(n.id)
    }
  }, [islandOpen, notices, onDismiss])

  useEffect(() => {
    if (!window.ryu?.onNoticeClicked) return
    return window.ryu.onNoticeClicked(({ id, agent }) => {
      onSelect(agent)
      // Dismiss all on click
      for (const n of notices) onDismiss(n.id)
    })
  }, [onDismiss, onSelect, notices])

  useEffect(() => {
    return () => {
      window.ryu?.setNotices?.([])
    }
  }, [])

  return null
}
