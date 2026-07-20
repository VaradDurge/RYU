import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { RyuAgent } from '../../../shared/types'
import type { AgentStatusMap, DockStatus } from '../types'
import { AGENT_LABELS } from '../types'
import type { AgentSummaryMap } from './useAgentStatuses'
import { AgentIcon } from './AgentIcon'
import { StatusRing } from './GlowRing'
import { dockIcon, dockPill } from './motion'
import { macTheme } from './theme'

const ICON = 26
const ICON_VIS = 17
const GAP = 12
const PAD_X = 14
const DOCK_H = 38

const dockShell: CSSProperties = {
  background: `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 42%), ${macTheme.dockBg}`,
  border: `0.5px solid ${macTheme.dockBorder}`,
  boxShadow: macTheme.dockShadow,
  borderRadius: macTheme.radiusPill,
  padding: `7px ${PAD_X}px`,
  display: 'flex',
  alignItems: 'center',
  gap: GAP,
  pointerEvents: 'auto',
  height: DOCK_H,
  backdropFilter: macTheme.dockBlur,
  WebkitBackdropFilter: macTheme.dockBlur,
  fontFamily: macTheme.font,
  transformOrigin: '50% 0%',
  overflow: 'hidden'
}

const slotBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  padding: 0,
  margin: 0,
  width: ICON,
  height: ICON,
  color: 'rgba(255,255,255,0.78)',
  pointerEvents: 'auto',
  flexShrink: 0,
  cursor: 'default',
  position: 'relative'
}

export function AgentDock({
  agents,
  statuses,
  summaries,
  selectedAgent,
  onSelectAgent,
  onHoverAgent,
  hideTip = false,
  animateIn = true
}: {
  /** Only agents with an open session / live activity */
  agents: RyuAgent[]
  statuses: AgentStatusMap
  summaries: AgentSummaryMap
  selectedAgent: RyuAgent | null
  onSelectAgent: (agent: RyuAgent) => void
  onHoverAgent?: (agent: RyuAgent | null) => void
  hideTip?: boolean
  animateIn?: boolean
}) {
  const [hovered, setHovered] = useState<RyuAgent | null>(null)
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null)
  const btnRefs = useRef<Partial<Record<RyuAgent, HTMLButtonElement | null>>>({})

  const placeTip = (agent: RyuAgent) => {
    const el = btnRefs.current[agent]
    if (!el) return
    const r = el.getBoundingClientRect()
    const half = 140
    const x = Math.min(
      Math.max(r.left + r.width / 2, half + 8),
      window.innerWidth - half - 8
    )
    setTipPos({ x, y: r.bottom + 6 })
  }

  const summary = hovered ? stripAgentPrefix(summaries[hovered], hovered) : ''

  if (agents.length === 0) return null

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <motion.div
        style={dockShell}
        role="toolbar"
        aria-label="Agents"
        variants={animateIn ? dockPill : undefined}
        initial={animateIn ? 'hidden' : false}
        animate="show"
        onMouseLeave={() => {
          setHovered(null)
          setTipPos(null)
          onHoverAgent?.(null)
        }}
      >
        {agents.map((agent, i) => {
          const status = statuses[agent]
          const selected = selectedAgent === agent
          const showTip = hovered === agent

          return (
            <motion.button
              key={agent}
              type="button"
              ref={(el) => {
                btnRefs.current[agent] = el
              }}
              variants={animateIn ? dockIcon : undefined}
              custom={i}
              aria-label={`${AGENT_LABELS[agent]} — ${statusLabel(status)}. ${summaries[agent]}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelectAgent(agent)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseEnter={() => {
                setHovered(agent)
                placeTip(agent)
                onHoverAgent?.(agent)
              }}
              // Do NOT clear on icon leave — sliding to the next icon would
              // flash-unmount the activity panel. Dock shell clears instead.
              style={{
                ...slotBtn,
                opacity: selected || showTip ? 1 : status === 'idle' ? 0.7 : 0.9
              }}
              whileHover={animateIn ? { scale: 1.12, y: -2 } : undefined}
              whileTap={animateIn ? { scale: 0.92 } : undefined}
              transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            >
              <div style={{ position: 'relative', width: ICON_VIS, height: ICON_VIS }}>
                <StatusRing status={status} size={ICON_VIS} />
                <AgentIcon agent={agent} size={ICON_VIS} />
              </div>
            </motion.button>
          )
        })}
      </motion.div>

      {typeof document !== 'undefined' &&
        !hideTip &&
        createPortal(
          <AnimatePresence>
            {hovered && tipPos && summary && (
              <motion.div
                key={`tip-${hovered}`}
                role="tooltip"
                initial={{ opacity: 0, y: 4, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: 2, x: '-50%' }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                style={{
                  ...tipShell,
                  left: tipPos.x,
                  top: tipPos.y
                }}
              >
                {summary}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}

function statusLabel(status: DockStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'running':
      return 'Active'
    case 'approval':
      return 'Waiting'
    case 'error':
      return 'Error'
  }
}

function stripAgentPrefix(summary: string, agent: RyuAgent): string {
  const name = AGENT_LABELS[agent]
  const re = new RegExp(`^${name}\\s*[·•\\-]\\s*`, 'i')
  return summary.replace(re, '').trim() || summary
}

const tipShell: CSSProperties = {
  position: 'fixed',
  width: 'max-content',
  maxWidth: 280,
  pointerEvents: 'none',
  zIndex: 2147483000,
  padding: '4px 9px',
  borderRadius: 8,
  background: 'rgba(0, 0, 0, 0.72)',
  border: '0.5px solid rgba(255, 255, 255, 0.08)',
  color: 'rgba(235, 235, 245, 0.62)',
  fontSize: 11,
  fontWeight: 400,
  letterSpacing: '-0.01em',
  lineHeight: 1.3,
  fontFamily: macTheme.font,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  backdropFilter: 'blur(10px) saturate(110%)',
  WebkitBackdropFilter: 'blur(10px) saturate(110%)'
}
