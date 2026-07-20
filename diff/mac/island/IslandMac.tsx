import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { IslandMode, RyuAgent, RyuEvent } from '../../../shared/types'
import { ActivityPanel } from './ActivityPanel'
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
  activityFromDock,
  stemGrow
} from './motion'
import { NotchNotices } from './NotchNotices'
import { PromptComposer } from './PromptComposer'
import { Resolved } from './Resolved'
import { macTheme } from './theme'
import { useAgentActivity } from './useAgentActivity'
import { useAgentStatuses } from './useAgentStatuses'
import { visibleAgents } from './noticesFromStatuses'

const LEAVE_GRACE_MS = 320
/** Fixed shell sizes — never measure mid-animation (that resized the OS window every frame). */
const TUCKED_SIZE = { width: 240, height: 40 }
/** Dock + scrollable activity + prompt */
const ACTIVITY_SIZE = { width: 440, height: 520 }
const PERMISSION_SIZE = { width: 440, height: 400 }

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
  /** Icon under cursor — drives temporary activity + prompt stack */
  const [hoveredIcon, setHoveredIcon] = useState<RyuAgent | null>(null)
  /** Sticky while typing / send error so panel doesn’t vanish mid-follow-up */
  const [composerAgent, setComposerAgent] = useState<RyuAgent | null>(null)
  const [composerFocused, setComposerFocused] = useState(false)
  const [errorAgent, setErrorAgent] = useState<RyuAgent | null>(null)
  const leaveTimer = useRef<number | null>(null)
  const hoverClearTimer = useRef<number | null>(null)
  const errorTimer = useRef<number | null>(null)
  const insideRef = useRef(false)
  const lastEventId = useRef<string | null>(null)

  const { statuses, summaries, sessionOpen, lastWorkspace } = useAgentStatuses(
    mode,
    event,
    lastDecision
  )
  const dockAgents = visibleAgents(sessionOpen, statuses)
  const showResolved = mode === 'resolved' && Boolean(lastDecision)
  const panelAgent = hoveredIcon ?? composerAgent ?? errorAgent
  const showDock =
    peek || Boolean(selectedAgent) || showResolved || Boolean(panelAgent)

  const showPermission = Boolean(
    selectedAgent &&
      event &&
      event.agent === selectedAgent &&
      (mode === 'expanded' || mode === 'attention')
  )
  const showActivity =
    Boolean(panelAgent) && !showResolved && !showPermission

  const { events: activityEvents, loading: activityLoading } = useAgentActivity(
    showActivity ? panelAgent : null,
    lastWorkspace || event?.path,
    showActivity
  )

  const onComposerError = (message: string | null) => {
    if (errorTimer.current) {
      window.clearTimeout(errorTimer.current)
      errorTimer.current = null
    }
    if (!message) {
      setErrorAgent(null)
      return
    }
    setErrorAgent(panelAgent)
    errorTimer.current = window.setTimeout(() => {
      setErrorAgent(null)
      errorTimer.current = null
    }, 5000)
  }

  const onIconHover = (agent: RyuAgent | null) => {
    if (hoverClearTimer.current) {
      window.clearTimeout(hoverClearTimer.current)
      hoverClearTimer.current = null
    }
    if (agent) {
      setHoveredIcon(agent)
      setComposerAgent(agent)
      return
    }
    // Leaving the dock icons — delay clear so a brief gap never collapses UI
    if (composerFocused) return
    hoverClearTimer.current = window.setTimeout(() => {
      setHoveredIcon(null)
      if (!composerFocused) setComposerAgent(null)
      hoverClearTimer.current = null
    }, 280)
  }

  const onPanelZoneEnter = () => {
    if (hoverClearTimer.current) {
      window.clearTimeout(hoverClearTimer.current)
      hoverClearTimer.current = null
    }
  }

  const onPanelZoneLeave = () => {
    if (composerFocused) return
    if (hoverClearTimer.current) window.clearTimeout(hoverClearTimer.current)
    hoverClearTimer.current = window.setTimeout(() => {
      if (!hoveredIcon && !composerFocused) setComposerAgent(null)
      hoverClearTimer.current = null
    }, 160)
  }

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
    setComposerAgent(agent)
    setHoveredIcon(agent)
    setPeek(true)
    if (event && event.agent === agent) onExpand()
  }

  const tuck = () => {
    if (insideRef.current) {
      insideRef.current = false
      interactiveLeave()
    }
    setSelectedAgent(null)
    setHoveredIcon(null)
    setComposerAgent(null)
    setComposerFocused(false)
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
      if (hoverClearTimer.current) window.clearTimeout(hoverClearTimer.current)
      if (errorTimer.current) window.clearTimeout(errorTimer.current)
      interactiveReset()
      window.ryu?.setIslandSize?.(TUCKED_SIZE)
    }
  }, [])

  useEffect(() => {
    if (!window.ryu?.setIslandSize) return
    if (showPermission) {
      window.ryu.setIslandSize(PERMISSION_SIZE)
      return
    }
    if (showActivity) {
      window.ryu.setIslandSize(ACTIVITY_SIZE)
      return
    }
    if (showDock || showResolved) {
      window.ryu.setIslandSize({ width: 420, height: 200 })
      return
    }
    const t = window.setTimeout(() => {
      window.ryu?.setIslandSize?.(TUCKED_SIZE)
    }, 280)
    return () => window.clearTimeout(t)
  }, [showDock, showPermission, showResolved, showActivity])

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
        statuses={statuses}
        sessionOpen={sessionOpen}
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
                  agents={dockAgents}
                  statuses={statuses}
                  summaries={summaries}
                  selectedAgent={selectedAgent ?? panelAgent}
                  onSelectAgent={selectAgent}
                  onHoverAgent={onIconHover}
                  hideTip={Boolean(showActivity)}
                  animateIn={!reduce}
                />
              )}

              <AnimatePresence mode="sync">
                {showActivity && panelAgent && (
                  <motion.div
                    key="activity-stack"
                    variants={reduce ? undefined : activityFromDock}
                    initial={reduce ? false : 'hidden'}
                    animate="show"
                    exit="exit"
                    onMouseEnter={onPanelZoneEnter}
                    onMouseLeave={onPanelZoneLeave}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      paddingTop: 8,
                      marginTop: -2,
                      paddingLeft: 12,
                      paddingRight: 12,
                      paddingBottom: 4,
                      transformOrigin: '50% 0%',
                      willChange: 'transform, opacity'
                    }}
                  >
                    <ActivityPanel
                      agent={panelAgent}
                      status={statuses[panelAgent]}
                      events={activityEvents}
                      loading={activityLoading}
                      footer={
                        <PromptComposer
                          agent={panelAgent}
                          cwd={lastWorkspace || event?.path}
                          disabled={Boolean(showPermission)}
                          onFocusChange={setComposerFocused}
                          onError={onComposerError}
                          embedded
                        />
                      }
                    />
                  </motion.div>
                )}
              </AnimatePresence>

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
