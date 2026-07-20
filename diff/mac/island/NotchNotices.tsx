import { useEffect } from 'react'
import type { RyuAgent } from '../../../shared/types'

export type NotchNoticeKind = 'running' | 'permission' | 'failed' | 'finished'

export interface NotchNotice {
  id: string
  agent: RyuAgent
  kind: NotchNoticeKind
  ts: number
}

/**
 * Island-side bridge for notch dots.
 * Dots stay visible while agents have status — opening the island
 * does NOT clear them (only a click or status change does).
 */
export function NotchNotices({
  onSelect
}: {
  notices?: NotchNotice[]
  onDismiss?: (id: string) => void
  onSelect: (agent: RyuAgent) => void
  islandOpen?: boolean
}) {
  useEffect(() => {
    if (!window.ryu?.onNoticeClicked) return
    return window.ryu.onNoticeClicked(({ agent }) => {
      onSelect(agent)
    })
  }, [onSelect])

  return null
}
