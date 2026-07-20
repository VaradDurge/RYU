import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { IslandMode, RyuAgent, RyuEvent } from '../../../shared/types'
import { AgentDock } from './AgentDock'
import { Expanded } from './Expanded'
import { macGlassSurface } from './glass'
import {
  interactiveEnter,
  interactiveLeave,
  interactiveReset,
  recentlyCaptured
} from './interactive'
import {
  islandFromNotch,
  islandFromNotchReduced,
  panelFromDock,
  stemGrow
} from './motion'
import { NotchNotices } from './NotchNotices'
import { Resolved } from './Resolved'
import { macTheme } from './theme'
import { useAgentStatuses } from './useAgentStatuses'

const LEAVE_GRACE_MS = 320
/** Fixed shell sizes — never measure mid-animation (that resized the OS window every frame). */
const TUCKED_SIZE = { width: 140, height: 36 }
/** Wide enough for hover tips that size to their summary text */
const DOCK_SIZE = { width: 420, height: 200 }
const PERMISSION_SIZE = { width: 440, height: 360 }

export function IslandMac({
  mode,
  event,
  lastDecision,
  onExpand,
  onCollapse,
  onAllow,
  onDeny,
  onHoverChange
}: {
  mode: IslandMode
  event: RyuEvent | null
  lastDecision: 'allow' | 'deny' | null
  onExpand: () => void
  onCollapse: () => void
  onAllow: () => void
  onDeny: () => void
  onHoverChange: (hovering: boolean) => void
}) {
  const reduce = useReducedMotion()
  const [peek, setPeek] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<RyuAgent | null>(null)
  const leaveTimer = useRef<number | null>(null)
  const insideRef = useRef(false)
  const lastEventId = useRef<string | null>(null)

  const { statuses, summaries } = useAgentStatuses(mode, event, lastDecision)
  const showResolved = mode === 'resolved' && Boolean(lastDecision)
  const showDock = peek || Boolean(selectedAgent) || showResolved

  const showPermission =
    selectedAgent &&
    event &&
    event.agent === selectedAgent &&
    (mode === 'expanded' || mode === 'attention')

  useEffect(() => {
    if (event?.id && event.id !== lastEventId.current) {
      lastEventId.current = event.id
      setSelectedAgent(event.agent)
      setPeek(true)
      onExpand()
      const autoTuck = window.setTimeout(() => {
        if (!insideRef.current) {
          setSelectedAgent(null)
          setPeek(false)
          onCollapse()
          interactiveReset()
        }
      }, 4500)
      return () => window.clearTimeout(autoTuck)
    }
    if (!event && mode === 'idle') {
      lastEventId.current = null
    }
  }, [event, mode, onExpand, onCollapse])

  const selectAgent = (agent: RyuAgent) => {
    setSelectedAgent(agent)
    setPeek(true)
    if (event && event.agent === agent) onExpand()
  }

  const tuck = () => {
    if (insideRef.current) {
      insideRef.current = false
      interactiveLeave()
    }
    setSelectedAgent(null)
    setPeek(false)
    onCollapse()
    interactiveReset()
    onHoverChange(false)
  }

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
      setPeek(true)
      onHoverChange(true)
      return
    }

    if (recentlyCaptured()) return

    leaveTimer.current = window.setTimeout(() => {
      if (recentlyCaptured()) {
        leaveTimer.current = null
        return
      }
      tuck()
      leaveTimer.current = null
    }, LEAVE_GRACE_MS)
  }

  // Native cursor tracking (main process) — Chromium hover on transparent
  // windows is unreliable. This is the sole hover source on Mac.
  const setHoveringRef = useRef(setHovering)
  setHoveringRef.current = setHovering

  useEffect(() => {
    if (!window.ryu?.onIslandHover) return
    return window.ryu.onIslandHover((inside) => {
      setHoveringRef.current(inside)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current)
      interactiveReset()
      window.ryu?.setIslandSize?.(TUCKED_SIZE)
    }
  }, [])

  // Discrete shell sizes only — grow before animate, shrink after tuck.
  useEffect(() => {
    if (!window.ryu?.setIslandSize) return
    if (showPermission) {
      window.ryu.setIslandSize(PERMISSION_SIZE)
      return
    }
    if (showDock || showResolved) {
      window.ryu.setIslandSize(DOCK_SIZE)
      return
    }
    // Let exit animation finish before shrinking the OS window
    const t = window.setTimeout(() => {
      window.ryu?.setIslandSize?.(TUCKED_SIZE)
    }, 280)
    return () => window.clearTimeout(t)
  }, [showDock, showPermission, showResolved])

  const stackVariants = reduce ? islandFromNotchReduced : islandFromNotch

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
        pointerEvents: 'auto',
        position: 'relative',
        background: 'transparent'
      } as CSSProperties}
    >
      <NotchNotices
        onSelect={(agent) => {
          selectAgent(agent)
          setPeek(true)
          setHovering(true)
        }}
      />

      <div
        data-ryu-island
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 4,
          zIndex: 10,
          minWidth: showDock ? 160 : 120
        }}
      >
        <AnimatePresence mode="popLayout">
          {showDock && (
            <motion.div
              key="dock-stack"
              variants={stackVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflow: 'visible',
                willChange: 'transform, opacity'
              }}
            >
              {showResolved && lastDecision ? (
                <motion.div
                  layout
                  style={{
                    ...macGlassSurface(false),
                    borderRadius: macTheme.radiusPill,
                    transformOrigin: '50% 0%'
                  }}
                  initial={reduce ? false : { scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  <Resolved decision={lastDecision} />
                </motion.div>
              ) : (
                <AgentDock
                  statuses={statuses}
                  summaries={summaries}
                  selectedAgent={selectedAgent}
                  onSelectAgent={selectAgent}
                  animateIn={!reduce}
                />
              )}

              <AnimatePresence mode="popLayout">
                {showPermission && selectedAgent && event && (
                  <motion.div
                    key={`panel-${selectedAgent}-perm`}
                    variants={reduce ? islandFromNotchReduced : panelFromDock}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      overflow: 'visible',
                      willChange: 'transform, opacity'
                    }}
                  >
                    <motion.div
                      aria-hidden
                      variants={stemGrow}
                      style={{
                        width: 1.5,
                        height: 12,
                        borderRadius: 999,
                        background:
                          'linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.06))',
                        marginTop: 5,
                        marginBottom: 5,
                        transformOrigin: '50% 0%'
                      }}
                    />
                    <motion.div
                      style={{
                        ...macGlassSurface(true),
                        borderRadius: macTheme.radiusCard,
                        overflow: 'hidden',
                        transformOrigin: '50% 0%'
                      }}
                      initial={reduce ? false : { y: -8, opacity: 0.85 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    >
                      <Expanded event={event} onAllow={onAllow} onDeny={onDeny} />
                    </motion.div>
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
