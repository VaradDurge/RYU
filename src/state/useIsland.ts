import { useCallback, useReducer } from 'react'
import type { RyuDecision, RyuEvent } from '../../shared/types'
import { reduceIsland, initialIslandState } from '../../shared/island-reducer.mjs'

export type IslandState = typeof initialIslandState

export function useIsland() {
  const [state, dispatch] = useReducer(
    (s: IslandState, a: Parameters<typeof reduceIsland>[1]) => reduceIsland(s, a),
    initialIslandState
  )

  const ingestEvent = useCallback((event: RyuEvent) => {
    dispatch({ type: 'event', event })
  }, [])

  const hydrate = useCallback((events: RyuEvent[]) => {
    dispatch({ type: 'hydrate', events })
  }, [])

  const expand = useCallback(() => dispatch({ type: 'expand' }), [])
  const collapse = useCallback(() => dispatch({ type: 'collapse' }), [])

  const resolve = useCallback((decision: RyuDecision['decision']) => {
    dispatch({ type: 'resolved', decision })
  }, [])

  const advance = useCallback(() => dispatch({ type: 'advance' }), [])
  const drop = useCallback((id: string) => dispatch({ type: 'drop', id }), [])
  const goIdle = useCallback(() => dispatch({ type: 'idle' }), [])
  const beginAction = useCallback(() => dispatch({ type: 'actionStart' }), [])
  const failAction = useCallback((reason: string) => {
    dispatch({ type: 'actionFail', reason })
  }, [])

  const waitingCount = (state.current ? 1 : 0) + state.queue.length

  return {
    state,
    waitingCount,
    ingestEvent,
    hydrate,
    expand,
    collapse,
    resolve,
    advance,
    drop,
    goIdle,
    beginAction,
    failAction
  }
}
