import type { CSSProperties } from 'react'
import type { RyuAgent } from '../../../shared/types'
import type { DockStatus } from '../types'
import { AGENT_LABELS } from '../types'
import { AgentIcon } from './AgentIcon'
import { StatusRing } from './GlowRing'
import { macTheme } from './theme'

const copy: Record<DockStatus, string> = {
  idle: 'Idle — waiting for the next task.',
  running: 'Working — agent is processing right now.',
  approval: 'Needs your approval to continue.',
  error: 'Something went wrong or was denied.'
}

export function AgentStatusCard({
  agent,
  status
}: {
  agent: RyuAgent
  status: DockStatus
}) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ position: 'relative', width: 28, height: 28 }}>
          <StatusRing status={status} />
          <AgentIcon agent={agent} size={28} />
        </div>
        <div>
          <div
            style={{
              color: macTheme.text,
              fontSize: 13,
              fontWeight: 590,
              fontFamily: macTheme.font,
              letterSpacing: '-0.01em'
            }}
          >
            {AGENT_LABELS[agent]}
          </div>
          <div style={{ color: macTheme.textMuted, fontSize: 12, marginTop: 2 }}>
            {statusLabel(status)}
          </div>
        </div>
      </div>
      <p style={{ margin: 0, color: macTheme.textDim, fontSize: 12.5, lineHeight: 1.45 }}>
        {copy[status]}
      </p>
    </div>
  )
}

function statusLabel(status: DockStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'running':
      return 'Running'
    case 'approval':
      return 'Needs approval'
    case 'error':
      return 'Error'
  }
}

const card: CSSProperties = {
  width: 300,
  padding: 16,
  pointerEvents: 'auto'
}
