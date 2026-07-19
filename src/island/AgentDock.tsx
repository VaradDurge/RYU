import type { CSSProperties } from 'react'
import type { RyuAgent } from '../../shared/types'
import { theme } from '../theme'
import type { AgentStatusMap, DockSlotId, LiveAgentStatus } from './dockTypes'
import { AGENT_LABELS, DOCK_AGENTS } from './dockTypes'
import { AgentIcon } from './AgentIcon'
import { DockIcon } from './DockIcons'
import { StatusRing } from './GlowRing'
import { glassSurface } from './glass'
import type { AgentSummaryMap } from './useAgentStatuses'

const DECOR: { id: DockSlotId; label: string }[] = [
  { id: 'cube', label: 'Cube' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'add', label: 'Add' }
]

function statusLabel(status: LiveAgentStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'running':
      return 'Active'
    case 'approval':
      return 'Waiting'
    case 'error':
      return 'Error'
  }
}

export function AgentDock({
  statuses,
  summaries,
  selectedAgent,
  onSelectAgent
}: {
  statuses: AgentStatusMap
  summaries: AgentSummaryMap
  selectedAgent: RyuAgent | null
  onSelectAgent: (agent: RyuAgent) => void
}) {
  return (
    <div
      style={{
        ...glassSurface(false),
        borderRadius: theme.radiusPill,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        pointerEvents: 'auto'
      }}
      role="toolbar"
      aria-label="Agents"
    >
      {DECOR.slice(0, 1).map((slot) => (
        <DecorSlot key={slot.id} id={slot.id} label={slot.label} />
      ))}

      {DOCK_AGENTS.map((agent) => {
        const status = statuses[agent]
        const selected = selectedAgent === agent
        const title = `${AGENT_LABELS[agent]} — ${statusLabel(status)}. ${summaries[agent]}`

        return (
          <button
            key={agent}
            type="button"
            title={title}
            aria-label={title}
            onClick={() => onSelectAgent(agent)}
            style={{
              ...slotBtn,
              cursor: 'pointer',
              opacity: selected ? 1 : status === 'idle' ? 0.72 : 0.92
            }}
          >
            <div style={{ position: 'relative', width: 26, height: 26 }}>
              <StatusRing status={status} size={26} />
              <AgentIcon agent={agent} size={26} />
            </div>
          </button>
        )
      })}

      {DECOR.slice(1).map((slot) => (
        <DecorSlot key={slot.id} id={slot.id} label={slot.label} />
      ))}
    </div>
  )
}

function DecorSlot({ id, label }: { id: DockSlotId; label: string }) {
  return (
    <button type="button" title={label} disabled style={{ ...slotBtn, cursor: 'default', opacity: 0.55 }}>
      <div style={{ position: 'relative', width: 26, height: 26 }}>
        <DockIcon id={id} size={26} />
      </div>
    </button>
  )
}

const slotBtn: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  padding: '2px 4px',
  color: 'inherit',
  pointerEvents: 'auto'
}
