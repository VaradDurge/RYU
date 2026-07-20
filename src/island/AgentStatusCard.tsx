import type { CSSProperties } from 'react'
import type { RyuAgent } from '../../shared/types'
import { theme } from '../theme'
import type { LiveAgentStatus } from './dockTypes'
import { AGENT_LABELS } from './dockTypes'
import { AgentIcon } from './AgentIcon'
import { StatusRing } from './GlowRing'
import { glassSurface } from './glass'

const copy: Record<LiveAgentStatus, string> = {
  idle: 'Idle — waiting for the next task.',
  running: 'Working — agent is processing right now.',
  approval: 'Needs your approval to continue.',
  error: 'Something went wrong or was denied.',
  stale: 'Status stale — RYU has no fresh evidence from this agent.'
}

export function AgentStatusCard({
  agent,
  status,
  summary,
  bridgeUnavailable = false
}: {
  agent: RyuAgent
  status: LiveAgentStatus
  summary?: string
  bridgeUnavailable?: boolean
}) {
  return (
    <div style={{ ...glassSurface(true), ...card }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ position: 'relative', width: 28, height: 28 }}>
          <StatusRing status={status} size={28} />
          <AgentIcon agent={agent} size={28} />
        </div>
        <div>
          <div
            style={{
              color: theme.text,
              fontSize: 13,
              fontWeight: 590,
              fontFamily: theme.font,
              letterSpacing: '-0.01em'
            }}
          >
            {AGENT_LABELS[agent]}
          </div>
          <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
            {bridgeUnavailable ? 'Bridge unavailable' : statusLabel(status)}
          </div>
        </div>
      </div>
      <p style={{ margin: 0, color: theme.textDim, fontSize: 12.5, lineHeight: 1.45 }}>
        {bridgeUnavailable
          ? 'Local bridge is not running on this machine. Start RYU or free port 41999.'
          : summary?.trim() || copy[status]}
      </p>
    </div>
  )
}

function statusLabel(status: LiveAgentStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'running':
      return 'Running'
    case 'approval':
      return 'Needs approval'
    case 'error':
      return 'Error'
    case 'stale':
      return 'Status stale'
  }
}

const card: CSSProperties = {
  width: 300,
  padding: 16,
  borderRadius: theme.radiusCard,
  pointerEvents: 'auto'
}
