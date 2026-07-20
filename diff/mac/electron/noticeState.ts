import type { AgentLiveStatus, RyuAgent } from '../../../shared/types'
import type { NoticePayload } from './noticeWindow'

const ORDER: RyuAgent[] = ['cursor', 'claude', 'codex']

/**
 * Main-process tracker for notch-right status dots.
 * One dot per agent, sequential. Idle agents are omitted unless they
 * just finished (sticky blue until cleared).
 */
export class NoticeState {
  private live: Record<RyuAgent, AgentLiveStatus> = {
    cursor: 'idle',
    claude: 'idle',
    codex: 'idle'
  }
  /** Sticky blue after running → idle */
  private finished = new Set<RyuAgent>()
  /** Sticky red after error until cleared / island open */
  private failed = new Set<RyuAgent>()

  apply(agent: RyuAgent, status: AgentLiveStatus): NoticePayload[] {
    const prev = this.live[agent]
    this.live[agent] = status

    if (status === 'running' || status === 'approval') {
      this.finished.delete(agent)
      this.failed.delete(agent)
    }

    if (status === 'error') {
      this.finished.delete(agent)
      this.failed.add(agent)
    }

    if (status === 'idle') {
      if (prev === 'running') this.finished.add(agent)
      if (prev === 'approval') {
        // permission resolved without error — drop yellow, no blue
      }
    }

    return this.snapshot()
  }

  /** Clear sticky finished/failed (island opened) */
  clearSticky(): NoticePayload[] {
    this.finished.clear()
    this.failed.clear()
    return this.snapshot()
  }

  clearAgent(agent: RyuAgent): NoticePayload[] {
    this.finished.delete(agent)
    this.failed.delete(agent)
    if (this.live[agent] === 'error') this.live[agent] = 'idle'
    return this.snapshot()
  }

  snapshot(): NoticePayload[] {
    const out: NoticePayload[] = []
    for (const agent of ORDER) {
      const s = this.live[agent]
      if (s === 'running') {
        out.push(dot(agent, 'running'))
      } else if (s === 'approval') {
        out.push(dot(agent, 'permission'))
      } else if (s === 'error' || this.failed.has(agent)) {
        out.push(dot(agent, 'failed'))
      } else if (this.finished.has(agent)) {
        out.push(dot(agent, 'finished'))
      }
    }
    return out
  }
}

function dot(
  agent: RyuAgent,
  kind: NoticePayload['kind']
): NoticePayload {
  return { id: `${agent}-${kind}`, agent, kind, ts: Date.now() }
}
