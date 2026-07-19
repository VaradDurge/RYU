import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { IslandMode, RyuEvent } from '../../../shared/types'
import { AgentDock } from './AgentDock'
import { Expanded } from './Expanded'
import { macGlassSurface } from './glass'
import { interactiveEnter, interactiveForce, interactiveLeave } from './interactive'
import { NotchAnchor } from './NotchAnchor'
import { Resolved } from './Resolved'
import { macTheme } from './theme'

const LEAVE_GRACE_MS = 220

export function IslandMac({
  mode,
  event,
  lastDecision,
  onExpand,
  onAllow,
  onDeny,
  onHoverChange
}: {
  mode: IslandMode
  event: RyuEvent | null
  lastDecision: 'allow' | 'deny' | null
  onExpand: () => void
  onAllow: () => void
  onDeny: () => void
  onHoverChange: (hovering: boolean) => void
}) {
  const reduce = useReducedMotion()
  const [notchHover, setNotchHover] = useState(false)
  const leaveTimer = useRef<number | null>(null)
  const insideRef = useRef(false)

  const pendingAttention = mode === 'attention'
  const lockedOpen = mode === 'expanded' || mode === 'resolved'
  // Show dock on hover, or whenever a permission needs action
  const showDock = notchHover || lockedOpen || pendingAttention
  const showCard = mode === 'expanded' && Boolean(event)
  const showResolvedInDock = mode === 'resolved' && Boolean(lastDecision)

  // Keep Electron mouse capture ON while UI must accept clicks
  useEffect(() => {
    const needsClicks = mode === 'expanded' || mode === 'resolved' || mode === 'attention'
    interactiveForce(needsClicks)
    onHoverChange(needsClicks || insideRef.current)
    return () => interactiveForce(false)
  }, [mode, onHoverChange])

  // Pending permission → open card immediately (reference: expand to decide)
  useEffect(() => {
    if (mode === 'attention' && event) {
      onExpand()
    }
  }, [mode, event, onExpand])

  const setHovering = (next: boolean) => {
    if (leaveTimer.current) {
      window.clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
    if (next) {
      if (!insideRef.current) {
        insideRef.current = true
        interactiveEnter()
      }
      setNotchHover(true)
      onHoverChange(true)
      return
    }
    leaveTimer.current = window.setTimeout(() => {
      if (insideRef.current) {
        insideRef.current = false
        interactiveLeave()
      }
      setNotchHover(false)
      // Force flag still holds interactive while expanded/attention
      onHoverChange(mode === 'expanded' || mode === 'attention' || mode === 'resolved')
      leaveTimer.current = null
    }, LEAVE_GRACE_MS)
  }

  useEffect(() => {
    return () => {
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
      if (insideRef.current) interactiveLeave()
      interactiveForce(false)
    }
  }, [])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: macTheme.font,
        userSelect: 'none',
        WebkitAppRegion: 'no-drag',
        pointerEvents: 'none',
        position: 'relative'
      } as CSSProperties}
    >
      {/* Wide top hit strip so notch / menubar hover always works */}
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: Math.max(macTheme.notchHitWidth, 420),
          height: showDock ? 56 : macTheme.notchHitHeight,
          pointerEvents: 'auto',
          zIndex: 5
        }}
      />

      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 6,
          zIndex: 10
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseDown={() => {
          // Re-assert capture on any press (Approve/Deny / dock)
          interactiveForce(true)
          onHoverChange(true)
        }}
      >
        <NotchAnchor attention={Boolean(event) && mode !== 'idle'} showStem={showDock} />

        <AnimatePresence>
          {showDock && (
            <motion.div
              key="dock-stack"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                pointerEvents: 'auto'
              }}
            >
              {showResolvedInDock && lastDecision ? (
                <div style={{ ...macGlassSurface(false), borderRadius: macTheme.radiusPill }}>
                  <Resolved decision={lastDecision} />
                </div>
              ) : (
                <AgentDock
                  event={event}
                  onSelectAgent={(agent) => {
                    if (event && event.agent === agent) onExpand()
                  }}
                />
              )}

              <AnimatePresence>
                {showCard && event && (
                  <motion.div
                    key="card-stack"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      pointerEvents: 'auto'
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        width: 1,
                        height: 18,
                        borderLeft: '1.5px dashed rgba(255,255,255,0.32)',
                        marginTop: 2,
                        marginBottom: 2
                      }}
                    />
                    <div
                      style={{
                        ...macGlassSurface(true),
                        borderRadius: macTheme.radiusCard,
                        overflow: 'hidden',
                        pointerEvents: 'auto'
                      }}
                    >
                      <Expanded event={event} onAllow={onAllow} onDeny={onDeny} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
