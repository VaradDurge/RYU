import { useEffect } from 'react'
import type { RyuDecision } from '../shared/types'
import { IslandMac } from '../diff/mac/island/IslandMac'
import { NoticeSurface } from '../diff/mac/island/NoticeSurface'
import { Island } from './island/Island'
import { useIsland } from './state/useIsland'

const isMac =
  typeof window !== 'undefined' &&
  (window.ryu?.platform === 'darwin' ||
    (typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)))

const isNoticeSurface =
  typeof window !== 'undefined' &&
  (window.ryu?.isNoticeSurface?.() === true ||
    new URLSearchParams(window.location.search).get('surface') === 'notices')

export default function App() {
  if (isNoticeSurface) {
    return <NoticeSurface />
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
