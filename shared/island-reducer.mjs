/** Pure island reducer for renderer + headless tests. */

export const initialIslandState = {
  mode: 'idle',
  current: null,
  queue: [],
  lastDecision: null,
  actionError: null,
  actionPending: false
}

function advanceFrom(state) {
  const next = state.queue[0]
  if (next) {
    return {
      mode: 'attention',
      current: next,
      queue: state.queue.slice(1),
      lastDecision: null,
      actionError: null,
      actionPending: false
    }
  }
  return { ...initialIslandState }
}

function hydrateFrom(events) {
  if (!events.length) return { ...initialIslandState }
  return {
    mode: 'attention',
    current: events[0],
    queue: events.slice(1),
    lastDecision: null,
    actionError: null,
    actionPending: false
  }
}

export function reduceIsland(state = initialIslandState, action) {
  switch (action.type) {
    case 'hydrate':
      return hydrateFrom(action.events || [])
    case 'event': {
      if (!state.current) {
        return {
          mode: 'attention',
          current: action.event,
          queue: [],
          lastDecision: null,
          actionError: null,
          actionPending: false
        }
      }
      if (state.current.id === action.event.id) {
        return { ...state, current: action.event, actionError: null }
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
        lastDecision: action.decision,
        actionError: null,
        actionPending: false
      }
    case 'advance':
      return advanceFrom(state)
    case 'drop': {
      if (state.current?.id === action.id) return advanceFrom(state)
      return {
        ...state,
        queue: state.queue.filter((e) => e.id !== action.id),
        actionPending: false,
        actionError: null
      }
    }
    case 'actionStart':
      return { ...state, actionPending: true, actionError: null }
    case 'actionFail':
      return { ...state, actionPending: false, actionError: action.reason }
    case 'idle':
      return { ...initialIslandState }
    default:
      return state
  }
}
