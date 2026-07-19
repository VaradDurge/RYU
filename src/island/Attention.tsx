import type { RyuEvent } from '../../shared/types'
import { theme } from '../theme'
import { AgentIcon } from './AgentIcon'
import { GlowRing } from './GlowRing'

/** Compact glass pill with the waiting agent icon + soft ring. */
export function Attention({
  event,
  onExpand
}: {
  event: RyuEvent
  onExpand: () => void
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        minWidth: 56,
        height: 44,
        padding: '0 14px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer'
      }}
      aria-label="Permission required — expand"
    >
      <div style={{ position: 'relative', width: 28, height: 28 }}>
        <GlowRing active destructive={event.risk === 'destructive'} />
        <AgentIcon agent={event.agent} size={28} />
      </div>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: event.risk === 'destructive' ? theme.danger : theme.waiting,
          boxShadow: `0 0 8px ${event.risk === 'destructive' ? theme.danger : theme.waiting}`
        }}
      />
    </button>
  )
}
