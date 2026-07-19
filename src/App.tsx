import { useEffect } from 'react'
import type { RyuDecision } from '../shared/types'
import { DemoHarness } from './demo/harness'
import { Island } from './island/Island'
import { useIsland } from './state/useIsland'

const isDev =
  typeof window !== 'undefined' &&
  (import.meta.env.DEV || window.ryu?.isDev?.() === true)

export default function App() {
  const { state, ingestEvent, expand, resolve, goIdle } = useIsland()

  useEffect(() => {
    if (!window.ryu?.onEvent) return
    return window.ryu.onEvent((event) => {
      ingestEvent(event)
    })
  }, [ingestEvent])

  useEffect(() => {
    if (state.mode !== 'resolved') return
    const t = window.setTimeout(() => goIdle(), 900)
    return () => clearTimeout(t)
  }, [state.mode, goIdle])

  const decide = (decision: RyuDecision['decision']) => {
    if (!state.current) return
    const payload: RyuDecision = {
      id: state.current.id,
      decision,
      reason: decision === 'allow' ? 'Approved via RYU' : 'Denied via RYU'
    }
    window.ryu?.decide?.(payload)
    resolve(decision)
  }

  return (
    <>
      <Island
        mode={state.mode}
        event={state.current}
        lastDecision={state.lastDecision}
        onExpand={expand}
        onAllow={() => decide('allow')}
        onDeny={() => decide('deny')}
        onHoverChange={(hovering) => window.ryu?.setInteractive?.(hovering)}
      />
      <DemoHarness visible={isDev} onInject={ingestEvent} />
    </>
  )
}
