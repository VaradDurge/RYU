import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { IslandMode, RyuAgent, RyuEvent } from '../../shared/types'
import { theme } from '../theme'
import {
  interactiveEnter,
  interactiveForce,
  interactiveLeave
} from '../lib/interactiveHover'
import { AgentDock } from './AgentDock'
import { AgentStatusCard } from './AgentStatusCard'
import { Expanded } from './Expanded'
import { glassSurface } from './glass'
import { TopAnchor } from './TopAnchor'
import { Resolved } from './Resolved'
import { anyAgentActive, useAgentStatuses } from './useAgentStatuses'

const LEAVE_GRACE_MS = 220

/** Multi-agent dock island (shared Windows + Mac UI). */
export function Island({
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
  const [topHover, setTopHover] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<RyuAgent | null>(null)
  const leaveTimer = useRef<number | null>(null)
  const insideRef = useRef(false)

  const { statuses, summaries } = useAgentStatuses(mode, event, lastDecision)
  const ambient = anyAgentActive(statuses)

  const pendingAttention = mode === 'attention'
  const lockedOpen = mode === 'expanded' || mode === 'resolved'
  const showDock = topHover || lockedOpen || pendingAttention || ambient
  const showPermissionCard = mode === 'expanded' && Boolean(event)
  const showStatusCard =
    Boolean(selectedAgent) &&
    !showPermissionCard &&
    mode !== 'resolved' &&
    !(event && selectedAgent === event.agent && (mode === 'attention' || mode === 'expanded'))
  const showResolvedInDock = mode === 'resolved' && Boolean(lastDecision)

  useEffect(() => {
    const needsClicks =
      mode === 'expanded' || mode === 'resolved' || mode === 'attention' || showStatusCard
    interactiveForce(needsClicks)
    onHoverChange(needsClicks || insideRef.current)
    return () => interactiveForce(false)
  }, [mode, onHoverChange, showStatusCard])

  useEffect(() => {
    if (mode === 'attention' && event) {
      setSelectedAgent(event.agent)
      onExpand()
    }
  }, [mode, event, onExpand])

  useEffect(() => {
    if (mode === 'idle' && !ambient) setSelectedAgent(null)
  }, [mode, ambient])

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
      setTopHover(true)
      onHoverChange(true)
      return
    }
    leaveTimer.current = window.setTimeout(() => {
      if (insideRef.current) {
        insideRef.current = false
        interactiveLeave()
      }
      setTopHover(false)
      onHoverChange(
        mode === 'expanded' || mode === 'attention' || mode === 'resolved' || ambient
      )
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

  const onSelectAgent = (agent: RyuAgent) => {
    setSelectedAgent(agent)
    if (event && event.agent === agent) onExpand()
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: theme.font,
        userSelect: 'none',
        WebkitAppRegion: 'no-drag',
        pointerEvents: 'none',
        position: 'relative'
      } as CSSProperties}
    >
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: Math.max(theme.topHitWidth, 420),
          height: showDock ? 56 : theme.topHitHeight,
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
          interactiveForce(true)
          onHoverChange(true)
        }}
      >
        <TopAnchor attention={Boolean(event) && mode !== 'idle'} showStem={showDock} />

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
                <div style={{ ...glassSurface(false), borderRadius: theme.radiusPill }}>
                  <Resolved decision={lastDecision} />
                </div>
              ) : (
                <AgentDock
                  statuses={statuses}
                  summaries={summaries}
                  selectedAgent={selectedAgent}
                  onSelectAgent={onSelectAgent}
                />
              )}

              <AnimatePresence>
                {showPermissionCard && event && (
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
                        ...glassSurface(true),
                        borderRadius: theme.radiusCard,
                        overflow: 'hidden',
                        pointerEvents: 'auto'
                      }}
                    >
                      <Expanded event={event} onAllow={onAllow} onDeny={onDeny} />
                    </div>
                  </motion.div>
                )}

                {showStatusCard && selectedAgent && (
                  <motion.div
                    key={`status-${selectedAgent}`}
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
                    <AgentStatusCard
                      agent={selectedAgent}
                      status={statuses[selectedAgent]}
                      summary={summaries[selectedAgent]}
                    />
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
