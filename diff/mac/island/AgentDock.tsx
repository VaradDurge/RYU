import type { CSSProperties } from 'react'
import type { RyuAgent, RyuEvent } from '../../../shared/types'
import type { DockSlot, DockSlotId, DockStatus } from '../types'
import { macGlassSurface } from './glass'
import { DockIcon } from './DockIcons'
import { GlowRing } from './GlowRing'
import { macTheme } from './theme'

/** Reference order: cube · sparkle · active agent · terminal · tray · + */
function slotsFor(event: RyuEvent | null): DockSlot[] {
  const active: RyuAgent = event?.agent ?? 'cursor'
  const activeStatus: DockStatus = !event
    ? 'muted'
    : event.risk === 'destructive'
      ? 'danger'
      : 'waiting'

  return [
    { id: 'cube', label: 'Cube', status: 'ok', selectable: false },
    { id: 'sparkle', label: 'Sparkle', status: 'waiting', selectable: false },
    {
      id: active as DockSlotId,
      agent: active,
      label: active === 'claude' ? 'Claude' : active === 'codex' ? 'Codex' : 'Cursor',
      status: activeStatus,
      selectable: true
    },
    { id: 'terminal', label: 'Terminal', status: 'danger', selectable: false },
    { id: 'sailboat', label: 'Tray', status: 'danger', selectable: false },
    { id: 'add', label: 'Add', status: 'idle', selectable: false }
  ]
}

function statusColor(status: DockStatus, active: boolean): string {
  if (active && status === 'waiting') return 'rgba(255,255,255,0.92)'
  switch (status) {
    case 'ok':
      return macTheme.success
    case 'waiting':
      return macTheme.waiting
    case 'danger':
      return macTheme.danger
    case 'muted':
      return 'rgba(255,255,255,0.28)'
    default:
      return 'transparent'
  }
}

export function AgentDock({
  event,
  onSelectAgent
}: {
  event: RyuEvent | null
  onSelectAgent: (agent: RyuAgent) => void
}) {
  const slots = slotsFor(event)

  return (
    <div
      style={{
        ...macGlassSurface(false),
        borderRadius: macTheme.radiusPill,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        pointerEvents: 'auto'
      }}
    >
      {slots.map((slot, index) => {
        const isActive = Boolean(slot.agent && event && slot.agent === event.agent)
        const destructive = event?.risk === 'destructive' && isActive

        return (
          <button
            key={`${slot.id}-${index}`}
            type="button"
            title={slot.label}
            disabled={!slot.selectable || !slot.agent}
            onClick={() => {
              if (slot.agent && slot.selectable) onSelectAgent(slot.agent)
            }}
            style={{
              ...slotBtn,
              cursor: slot.selectable ? 'pointer' : 'default',
              opacity: slot.id === 'add' ? 0.8 : 1
            }}
          >
            <div style={{ position: 'relative', width: isActive ? 30 : 26, height: isActive ? 30 : 26 }}>
              <GlowRing active={isActive} destructive={destructive} />
              <DockIcon id={slot.id} size={isActive ? 30 : 26} />
            </div>
            {slot.status !== 'idle' ? (
              <span
                aria-hidden
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  marginTop: 5,
                  background: statusColor(slot.status, isActive),
                  boxShadow:
                    slot.status === 'danger'
                      ? `0 0 6px ${macTheme.danger}`
                      : isActive
                        ? '0 0 6px rgba(255,255,255,0.55)'
                        : slot.status === 'waiting'
                          ? `0 0 6px ${macTheme.waiting}`
                          : undefined
                }}
              />
            ) : (
              <span style={{ height: 5, marginTop: 5 }} />
            )}
          </button>
        )
      })}
    </div>
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
