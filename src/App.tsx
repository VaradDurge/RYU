import { useCallback, useEffect, useRef, useState } from 'react'
import type { BridgeHealth, RyuDecision } from '../shared/types'
import { DemoHarness } from './demo/harness'
import { Island } from './island/Island'
import { resetInteractiveHover } from './lib/interactiveHover'
import { useIsland } from './state/useIsland'

const isDev =
  typeof window !== 'undefined' &&
  (import.meta.env.DEV || window.ryu?.isDev?.() === true)

export default function App() {
  const {
    state,
    waitingCount,
    ingestEvent,
    expand,
    resolve,
    advance,
    drop,
    beginAction,
    failAction
  } = useIsland()
  const seenIds = useRef(new Set<string>())
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealth | null>(null)
  const [bridgeRetrying, setBridgeRetrying] = useState(false)

  useEffect(() => {
    if (!window.ryu?.onEvent) return

    const unsub = window.ryu.onEvent((event) => {
      seenIds.current.add(event.id)
      ingestEvent(event)
    })

    // Subscribe first, then fill any missed pendings from bridge snapshot (P1.1).
    void (async () => {
      try {
        const snap = await window.ryu?.getSnapshot?.()
        if (snap?.health) setBridgeHealth(snap.health)
        if (!snap?.events?.length) return
        for (const event of snap.events) {
          seenIds.current.add(event.id)
          ingestEvent(event)
        }
      } catch {
        setBridgeHealth({
          bridge: 'unavailable',
          reason: 'snapshot_failed',
          lifecycle: 'unavailable'
        })
      }
    })()

    return unsub
  }, [ingestEvent])

  useEffect(() => {
    if (!window.ryu?.onHealth) return
    return window.ryu.onHealth((health) => {
      setBridgeHealth(health)
      setBridgeRetrying(Boolean(health.retrying))
    })
  }, [])

  const retryBridge = useCallback(async () => {
    if (!window.ryu?.retryBridge || bridgeRetrying) return
    setBridgeRetrying(true)
    try {
      const result = await window.ryu.retryBridge()
      const snap = await window.ryu.getSnapshot?.()
      if (snap?.health) setBridgeHealth(snap.health)
      if (!result.ok && !snap?.health) {
        setBridgeHealth({
          bridge: 'unavailable',
          reason: result.reason || 'retry_failed',
          lifecycle: 'unavailable'
        })
      }
    } finally {
      setBridgeRetrying(false)
    }
  }, [bridgeRetrying])

  useEffect(() => {
    if (!window.ryu?.onCancel) return
    return window.ryu.onCancel((id) => {
      seenIds.current.delete(id)
      drop(id)
    })
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

  const decide = async (decision: RyuDecision['decision']) => {
    if (!state.current || state.actionPending) return
    const id = state.current.id
    const payload: RyuDecision = {
      id,
      decision,
      reason: decision === 'allow' ? 'Approved via RYU' : 'Denied via RYU'
    }
    beginAction()
    try {
      const result = await window.ryu?.decide?.(payload)
      if (result?.ok) {
        seenIds.current.delete(id)
        resolve(decision)
      } else {
        failAction(result?.reason || 'unavailable')
      }
    } catch {
      failAction('unavailable')
    }
  }

  const dismiss = async () => {
    if (!state.current || state.actionPending) return
    const id = state.current.id
    beginAction()
    try {
      const result = await window.ryu?.dismiss?.(id)
      if (result?.ok) {
        seenIds.current.delete(id)
        drop(id)
      } else {
        failAction(result?.reason || 'unavailable')
      }
    } catch {
      failAction('unavailable')
    }
  }

  return (
    <>
      <Island
        mode={state.mode}
        event={state.current}
        waitingCount={waitingCount}
        lastDecision={state.lastDecision}
        actionPending={state.actionPending}
        actionError={state.actionError}
        onExpand={expand}
        onAllow={() => void decide('allow')}
        onDeny={() => void decide('deny')}
        onDismiss={() => void dismiss()}
        onHoverChange={() => {
          /* Island owns interactiveEnter/Leave */
        }}
        bridgeReason={bridgeHealth?.reason ?? null}
        bridgeRetrying={bridgeRetrying || Boolean(bridgeHealth?.retrying)}
        onRetryBridge={() => void retryBridge()}
      />
      <DemoHarness visible={isDev} onInject={ingestEvent} />
    </>
  )
}
