import { useEffect } from 'react'
import type { RyuDecision } from '../shared/types'
import { DemoHarness } from './demo/harness'
import { Island } from './island/Island'
import { resetInteractiveHover } from './lib/interactiveHover'
import { useIsland } from './state/useIsland'

const isDev =
  typeof window !== 'undefined' &&
  (import.meta.env.DEV || window.ryu?.isDev?.() === true)

export default function App() {
  const { state, waitingCount, ingestEvent, expand, resolve, advance, drop } = useIsland()

  useEffect(() => {
    if (!window.ryu?.onEvent) return
    return window.ryu.onEvent((event) => {
      ingestEvent(event)
    })
  }, [ingestEvent])

  useEffect(() => {
    if (!window.ryu?.onCancel) return
    return window.ryu.onCancel((id) => drop(id))
  }, [drop])

  useEffect(() => {
    const onBlur = () => resetInteractiveHover()
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])

  useEffect(() => {
    if (state.mode !== 'resolved') return
    const t = window.setTimeout(() => advance(), 900)
    return () => clearTimeout(t)
  }, [state.mode, advance])

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

  const dismiss = () => {
    if (!state.current) return
    window.ryu?.dismiss?.(state.current.id)
    drop(state.current.id)
  }

  return (
    <>
      <Island
        mode={state.mode}
        event={state.current}
        waitingCount={waitingCount}
        lastDecision={state.lastDecision}
        onExpand={expand}
        onAllow={() => decide('allow')}
        onDeny={() => decide('deny')}
        onDismiss={dismiss}
        onHoverChange={() => {
          /* Island owns interactiveEnter/Force; parent only needs the callback for API parity */
        }}
      />
      <DemoHarness visible={isDev} onInject={ingestEvent} />
    </>
  )
}
