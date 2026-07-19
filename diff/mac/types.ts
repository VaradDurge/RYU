import type { RyuAgent } from '../../shared/types'

/** Presentational dock slots (demo + real agents). Real events still use RyuAgent. */
export type DockSlotId = RyuAgent | 'cube' | 'sparkle' | 'terminal' | 'sailboat' | 'add'

export type DockStatus = 'idle' | 'ok' | 'waiting' | 'danger' | 'muted'

export interface DockSlot {
  id: DockSlotId
  /** Maps to a real RyuEvent agent when applicable */
  agent?: RyuAgent
  label: string
  status: DockStatus
  selectable: boolean
}
