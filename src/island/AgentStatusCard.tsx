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
  bridgeUnavailable = false,
  bridgeReason = null,
  retrying = false,
  onRetryBridge
}: {
  agent: RyuAgent
  status: LiveAgentStatus
  summary?: string
  bridgeUnavailable?: boolean
  bridgeReason?: string | null
  retrying?: boolean
  onRetryBridge?: () => void
}) {
  return (
    <div style={{ ...glassSurface(true), ...card }} data-testid="agent-status-card">
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
          ? `Local bridge is not running on this machine${
              bridgeReason ? ` (${bridgeReason})` : ''
            }. Free port 41999, then retry.`
          : summary?.trim() || copy[status]}
      </p>
      {bridgeUnavailable && onRetryBridge ? (
        <button
          type="button"
          data-testid="retry-bridge"
          disabled={retrying}
          onClick={onRetryBridge}
          style={{
            marginTop: 12,
            width: '100%',
            border: `1px solid ${theme.glassBorder}`,
            background: 'rgba(255,255,255,0.08)',
            color: theme.text,
            borderRadius: 12,
            padding: '10px 12px',
            fontSize: 13,
            fontWeight: 600,
            cursor: retrying ? 'default' : 'pointer',
            opacity: retrying ? 0.6 : 1
          }}
        >
          {retrying ? 'Retrying…' : 'Retry bridge'}
        </button>
      ) : null}
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
