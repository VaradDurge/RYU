import { useEffect } from 'react'
import type { RyuDecision } from '../shared/types'
import { DemoInjectSurface } from '../diff/mac/island/DemoInjectSurface'
import { IslandMac } from '../diff/mac/island/IslandMac'
import { NoticeSurface } from '../diff/mac/island/NoticeSurface'
import { Island } from './island/Island'
import { useIsland } from './state/useIsland'

const isMac =
  typeof window !== 'undefined' &&
  (window.ryu?.platform === 'darwin' ||
    (typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)))

const surface =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('surface')
    : null

const isNoticeSurface =
  typeof window !== 'undefined' &&
  (window.ryu?.isNoticeSurface?.() === true || surface === 'notices')

const isDemoSurface =
  typeof window !== 'undefined' &&
  (window.ryu?.isDemoSurface?.() === true || surface === 'demo')

export default function App() {
  if (isNoticeSurface) {
    return <NoticeSurface />
  }
  if (isDemoSurface) {
    return <DemoInjectSurface />
  }

  return <IslandApp />
}

function IslandApp() {
  const { state, ingestEvent, expand, collapse, resolve, goIdle } = useIsland()

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

  const sharedProps = {
    mode: state.mode,
    event: state.current,
    lastDecision: state.lastDecision,
    onExpand: expand,
    onAllow: () => decide('allow'),
    onDeny: () => decide('deny'),
    onHoverChange: (hovering: boolean) => {
      if (isMac) return
      window.ryu?.setInteractive?.(hovering)
    }
  }

  return (
    <>
      {isMac ? (
        <IslandMac {...sharedProps} onCollapse={collapse} />
      ) : (
        <Island {...sharedProps} />
      )}
    </>
  )
}
