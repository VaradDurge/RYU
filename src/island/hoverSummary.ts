import type { RyuAgent, RyuEvent } from '../../shared/types'
import type { LiveAgentStatus } from './dockTypes'
import { AGENT_LABELS } from './dockTypes'

const MAX = 72

/** Truncate for the icon hover chip */
export function clipSummary(text: string, max = MAX): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** Fallback line when hooks haven't sent a detail yet */
export function fallbackSummary(agent: RyuAgent, status: LiveAgentStatus): string {
  const name = AGENT_LABELS[agent]
  switch (status) {
    case 'idle':
      return `${name} · Idle`
    case 'running':
      return `${name} · Working…`
    case 'approval':
      return `${name} · Needs approval`
    case 'error':
      return `${name} · Error`
    case 'stale':
      return `${name} · Status stale`
  }
}

/** Short line from a pending permission event */
export function summaryFromEvent(event: RyuEvent): string {
  const preview = event.preview?.trim()
  if (preview) return clipSummary(preview)
  if (event.tool) return clipSummary(`${event.tool} — waiting for approval`)
  return clipSummary(`${AGENT_LABELS[event.agent]} · Needs approval`)
}
