import { useCallback, useReducer } from 'react'
import type { IslandMode, RyuDecision, RyuEvent } from '../../shared/types'

export interface IslandState {
  mode: IslandMode
  current: RyuEvent | null
  lastDecision: RyuDecision['decision'] | null
}

type Action =
  | { type: 'event'; event: RyuEvent }
  | { type: 'expand' }
  | { type: 'collapse' }
  | { type: 'resolved'; decision: RyuDecision['decision'] }
  | { type: 'idle' }

const initial: IslandState = {
  mode: 'idle',
  current: null,
  lastDecision: null
}

function reducer(state: IslandState, action: Action): IslandState {
  switch (action.type) {
    case 'event':
      return {
        mode: 'attention',
        current: action.event,
        lastDecision: null
      }
    case 'expand':
      if (!state.current) return state
      return { ...state, mode: 'expanded' }
    case 'collapse':
      // Tuck UI under notch but keep pending event (attention glow)
      if (state.mode === 'expanded' && state.current) {
        return { ...state, mode: 'attention' }
      }
      if (state.mode === 'expanded') return { ...state, mode: 'idle' }
      return state
    case 'resolved':
      return {
        ...state,
        mode: 'resolved',
        lastDecision: action.decision
      }
    case 'idle':
      return initial
    default:
      return state
  }
}

export function useIsland() {
  const [state, dispatch] = useReducer(reducer, initial)

  const ingestEvent = useCallback((event: RyuEvent) => {
    dispatch({ type: 'event', event })
  }, [])

  const expand = useCallback(() => dispatch({ type: 'expand' }), [])
  const collapse = useCallback(() => dispatch({ type: 'collapse' }), [])

  const resolve = useCallback((decision: RyuDecision['decision']) => {
    dispatch({ type: 'resolved', decision })
  }, [])

  const goIdle = useCallback(() => dispatch({ type: 'idle' }), [])

  return { state, ingestEvent, expand, collapse, resolve, goIdle }
}
