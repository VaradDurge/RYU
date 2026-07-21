import type { RyuDecision, RyuEvent } from './types'

export const initialIslandState: {
  mode: 'idle' | 'attention' | 'expanded' | 'resolved'
  current: RyuEvent | null
  queue: RyuEvent[]
  lastDecision: RyuDecision['decision'] | null
  actionError: string | null
  actionPending: boolean
}

export function reduceIsland(
  state: typeof initialIslandState | undefined,
  action: Record<string, unknown>
): typeof initialIslandState
