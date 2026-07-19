import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { RyuAgent } from '../../../shared/types'
import type { AgentStatusMap, DockStatus } from '../types'
import { AGENT_LABELS, DOCK_AGENTS } from '../types'
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

const statusHue: Record<DockStatus, string> = {
  idle: macTheme.idle,
  running: macTheme.success,
  approval: macTheme.waiting,
  error: macTheme.danger
}

export function AgentDock({
  statuses,
  summaries,
  selectedAgent,
  onSelectAgent,
  animateIn = true
}: {
  statuses: AgentStatusMap
  summaries: AgentSummaryMap
  selectedAgent: RyuAgent | null
  onSelectAgent: (agent: RyuAgent) => void
  animateIn?: boolean
}) {
  const [hovered, setHovered] = useState<RyuAgent | null>(null)
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null)
  const btnRefs = useRef<Partial<Record<RyuAgent, HTMLButtonElement | null>>>({})

  const placeTip = (agent: RyuAgent) => {
    const el = btnRefs.current[agent]
    if (!el) return
    const r = el.getBoundingClientRect()
    setTipPos({ x: r.left + r.width / 2, y: r.bottom + 8 })
  }

  const summary = hovered ? stripAgentPrefix(summaries[hovered], hovered) : ''
  const statusText = hovered ? statusLabel(statuses[hovered]) : ''
  // Avoid "Idle" / "Idle" double line when summary matches status
  const showBody =
    Boolean(hovered) &&
    summary.length > 0 &&
    summary.toLowerCase() !== statusText.toLowerCase()

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
      >
        {DOCK_AGENTS.map((agent, i) => {
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
              }}
              onMouseLeave={() => {
                setHovered((h) => (h === agent ? null : h))
                setTipPos(null)
              }}
              style={{
                ...slotBtn,
                opacity: selected || showTip ? 1 : status === 'idle' ? 0.7 : 0.9
              }}
              whileHover={animateIn ? { scale: 1.08, y: -1 } : undefined}
              whileTap={animateIn ? { scale: 0.94 } : undefined}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
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
        createPortal(
          <AnimatePresence>
            {hovered && tipPos && (
              <motion.div
                key={`tip-${hovered}`}
                role="tooltip"
                initial={{ opacity: 0, y: 6, scale: 0.94, x: '-50%' }}
                animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
                exit={{ opacity: 0, y: 3, scale: 0.97, x: '-50%' }}
                transition={{ type: 'spring', stiffness: 520, damping: 36 }}
                style={{
                  ...tipShell,
                  left: tipPos.x,
                  top: tipPos.y
                }}
              >
                <div aria-hidden style={tipCaret} />
                <div style={tipInner}>
                  <div style={tipHeader}>
                    <span
                      aria-hidden
                      style={{
                        ...tipDot,
                        background: statusHue[statuses[hovered]]
                      }}
                    />
                    <span style={tipName}>{AGENT_LABELS[hovered]}</span>
                    <span style={tipStatus}>{statusText}</span>
                  </div>
                  {showBody && <div style={tipBody}>{summary}</div>}
                </div>
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
  minWidth: 148,
  maxWidth: 228,
  pointerEvents: 'none',
  zIndex: 2147483000,
  overflow: 'visible'
}

const tipCaret: CSSProperties = {
  position: 'absolute',
  top: -4,
  left: '50%',
  marginLeft: -4,
  width: 8,
  height: 8,
  background: macTheme.tipBg,
  borderLeft: `0.5px solid ${macTheme.tipBorder}`,
  borderTop: `0.5px solid ${macTheme.tipBorder}`,
  transform: 'rotate(45deg)'
}

const tipInner: CSSProperties = {
  position: 'relative',
  padding: '9px 12px 10px',
  borderRadius: 12,
  background: `linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 40%), ${macTheme.tipBg}`,
  border: `0.5px solid ${macTheme.tipBorder}`,
  boxShadow: macTheme.tipShadow,
  backdropFilter: macTheme.tipBlur,
  WebkitBackdropFilter: macTheme.tipBlur,
  textAlign: 'left',
  fontFamily: macTheme.font,
  overflow: 'visible'
}

const tipHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 0
}

const tipDot: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: 999,
  flexShrink: 0
}

const tipName: CSSProperties = {
  color: macTheme.text,
  fontSize: 12,
  fontWeight: 590,
  letterSpacing: '-0.01em',
  lineHeight: 1.2
}

const tipStatus: CSSProperties = {
  marginLeft: 'auto',
  color: macTheme.textDim,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  lineHeight: 1.2
}

const tipBody: CSSProperties = {
  color: macTheme.textMuted,
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 400,
  letterSpacing: '-0.01em',
  paddingLeft: 11,
  marginTop: 4
}
