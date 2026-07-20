import { useCallback, useReducer } from 'react'
import type { IslandMode, RyuDecision, RyuEvent } from '../../shared/types'

export interface IslandState {
  mode: IslandMode
  current: RyuEvent | null
  /** Additional pending permissions behind `current` (FIFO). */
  queue: RyuEvent[]
  lastDecision: RyuDecision['decision'] | null
}

type Action =
  | { type: 'event'; event: RyuEvent }
  | { type: 'expand' }
  | { type: 'collapse' }
  | { type: 'resolved'; decision: RyuDecision['decision'] }
  | { type: 'advance' }
  | { type: 'drop'; id: string }
  | { type: 'idle' }

const initial: IslandState = {
  mode: 'idle',
  current: null,
  queue: [],
  lastDecision: null
}

function advanceFrom(state: IslandState): IslandState {
  const next = state.queue[0]
  if (next) {
    return {
      mode: 'attention',
      current: next,
      queue: state.queue.slice(1),
      lastDecision: null
    }
  }
  return initial
}

function reducer(state: IslandState, action: Action): IslandState {
  switch (action.type) {
    case 'event': {
      if (!state.current) {
        return {
          mode: 'attention',
          current: action.event,
          queue: [],
          lastDecision: null
        }
      }
      if (state.current.id === action.event.id) {
        return { ...state, current: action.event }
      }
      if (state.queue.some((e) => e.id === action.event.id)) return state
      return { ...state, queue: [...state.queue, action.event] }
    }
    case 'expand':
      if (!state.current) return state
      return { ...state, mode: 'expanded' }
    case 'collapse':
      if (state.mode === 'expanded') return { ...state, mode: 'attention' }
      return state
    case 'resolved':
      return {
        ...state,
        mode: 'resolved',
        lastDecision: action.decision
      }
    case 'advance':
      return advanceFrom(state)
    case 'drop': {
      if (state.current?.id === action.id) return advanceFrom(state)
      return { ...state, queue: state.queue.filter((e) => e.id !== action.id) }
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

  const advance = useCallback(() => dispatch({ type: 'advance' }), [])
  const drop = useCallback((id: string) => dispatch({ type: 'drop', id }), [])
  const goIdle = useCallback(() => dispatch({ type: 'idle' }), [])

  const waitingCount = (state.current ? 1 : 0) + state.queue.length

  return { state, waitingCount, ingestEvent, expand, collapse, resolve, advance, drop, goIdle }
}
