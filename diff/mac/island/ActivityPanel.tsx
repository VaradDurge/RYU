import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { AgentActivityEvent, AgentActivityKind, RyuAgent } from '../../../shared/types'
import type { DockStatus } from '../types'
import { AGENT_LABELS } from '../types'
import { feedRow } from './motion'
import { macTheme } from './theme'

const PANEL_W = 380
const FEED_H = 260

/** Badge labels only — slight display character */
const BADGE_FONT =
  '"SF Pro Display", "New York", "SF Pro Text", -apple-system, system-ui, sans-serif'

export function ActivityPanel({
  agent,
  status,
  events,
  loading,
  footer
}: {
  agent: RyuAgent
  status: DockStatus
  events: AgentActivityEvent[]
  loading?: boolean
  footer?: ReactNode
}) {
  const reduce = useReducedMotion()
  const scroller = useRef<HTMLDivElement>(null)
  const stickBottom = useRef(true)

  useEffect(() => {
    const el = scroller.current
    if (!el || !stickBottom.current) return
    el.scrollTop = el.scrollHeight
  }, [events])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickBottom.current = fromBottom < 40
  }

  return (
    <div style={shell} role="region" aria-label={`${AGENT_LABELS[agent]} activity`}>
      <motion.div
        style={header}
        initial={reduce ? false : { opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: 0.04 }}
      >
        <div style={headerLeft}>
          <motion.span
            aria-hidden
            style={{ ...statusDot, background: statusColor(status) }}
            animate={
              status === 'running'
                ? { scale: [1, 1.25, 1], opacity: [0.9, 1, 0.9] }
                : { scale: 1, opacity: 0.9 }
            }
            transition={
              status === 'running'
                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.2 }
            }
          />
          <span style={headerTitle}>{AGENT_LABELS[agent]}</span>
        </div>
        <span style={headerMeta}>{statusLabel(status)}</span>
      </motion.div>

      <div ref={scroller} style={list} onScroll={onScroll}>
        {events.length === 0 ? (
          <motion.div
            style={empty}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12 }}
          >
            {loading ? 'Loading…' : 'No activity yet'}
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((event, i) => (
              <ActivityRow
                key={event.id}
                event={event}
                index={i}
                animate={!reduce}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {footer && (
        <motion.div
          style={footerWrap}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {footer}
        </motion.div>
      )}
    </div>
  )
}

function ActivityRow({
  event,
  index,
  animate
}: {
  event: AgentActivityEvent
  index: number
  animate: boolean
}) {
  const role = messageRole(event.kind)
  const body = rowBodyText(event)
  const action = role === 'agent' && event.kind !== 'message' ? actionLabel(event) : null

  return (
    <motion.div
      style={row}
      variants={animate ? feedRow : undefined}
      initial={animate ? 'hidden' : false}
      animate="show"
      // Only cascade on first paint of new rows — avoid poll-driven flicker
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      layout={false}
    >
      <div style={badgeRow}>
        <span style={{ ...badge, ...badgeTone(role) }}>
          {role === 'user' ? 'User' : 'Agent'}
        </span>
        {action && <span style={actionMeta}>{action}</span>}
      </div>
      {body && (
        <div style={isCodeLike(event.kind) ? bodyMono : bodyText}>{body}</div>
      )}
    </motion.div>
  )
}

/** Every feed row is User or Agent so the transcript is always readable. */
function messageRole(kind: AgentActivityKind): 'user' | 'agent' {
  if (kind === 'prompt') return 'user'
  return 'agent'
}

function rowBodyText(event: AgentActivityEvent): string | null {
  if (event.kind === 'message' || event.kind === 'prompt') {
    return event.detail || event.title || null
  }
  if (event.detail && event.detail !== event.title) return event.detail
  if (event.kind === 'status' || event.kind === 'error' || event.kind === 'permission') {
    return event.title
  }
  return event.detail || event.title || null
}

function actionLabel(event: AgentActivityEvent): string {
  switch (event.kind) {
    case 'shell':
      return 'Shell'
    case 'edit':
      return 'Edit'
    case 'tool':
      return event.title || 'Tool'
    case 'permission':
      return 'Approval'
    case 'error':
      return 'Error'
    case 'status':
      return 'Status'
    case 'prompt':
      return ''
    default:
      return ''
  }
}

function isCodeLike(kind: AgentActivityKind): boolean {
  return kind === 'shell' || kind === 'tool' || kind === 'edit'
}

function statusLabel(status: DockStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'running':
      return 'Running'
    case 'approval':
      return 'Waiting'
    case 'error':
      return 'Error'
  }
}

function statusColor(status: DockStatus): string {
  switch (status) {
    case 'idle':
      return macTheme.idle
    case 'running':
      return macTheme.success
    case 'approval':
      return macTheme.waiting
    case 'error':
      return macTheme.danger
  }
}

function badgeTone(role: 'user' | 'agent'): CSSProperties {
  if (role === 'user') {
    return {
      color: 'rgba(120, 190, 255, 0.95)',
      background: 'rgba(90, 160, 255, 0.14)',
      border: '0.5px solid rgba(120, 190, 255, 0.28)'
    }
  }
  return {
    color: 'rgba(140, 225, 170, 0.95)',
    background: 'rgba(80, 200, 130, 0.12)',
    border: '0.5px solid rgba(140, 225, 170, 0.26)'
  }
}

const shell: CSSProperties = {
  width: PANEL_W,
  marginTop: 0,
  borderRadius: 14,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  pointerEvents: 'auto',
  fontFamily: macTheme.font,
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 32%), rgba(10, 10, 12, 0.9)',
  border: '0.5px solid rgba(255, 255, 255, 0.09)',
  boxShadow:
    '0 0 0 0.5px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.06)',
  backdropFilter: 'blur(24px) saturate(140%)',
  WebkitBackdropFilter: 'blur(24px) saturate(140%)',
  transformOrigin: '50% 0%'
}

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 13px 9px',
  borderBottom: '0.5px solid rgba(255, 255, 255, 0.06)',
  flexShrink: 0
}

const headerLeft: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minWidth: 0
}

const statusDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  flexShrink: 0
}

const headerTitle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.9)',
  fontSize: 13,
  fontWeight: 510,
  letterSpacing: '-0.02em'
}

const headerMeta: CSSProperties = {
  color: 'rgba(235, 235, 245, 0.34)',
  fontSize: 11,
  fontWeight: 400,
  letterSpacing: '-0.01em'
}

const list: CSSProperties = {
  height: FEED_H,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '10px 12px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minHeight: 0,
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(255,255,255,0.12) transparent'
}

const empty: CSSProperties = {
  color: 'rgba(235, 235, 245, 0.28)',
  fontSize: 12,
  padding: '44px 8px',
  textAlign: 'center'
}

const row: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 5,
  minWidth: 0
}

const badgeRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minWidth: 0
}

const badge: CSSProperties = {
  fontFamily: BADGE_FONT,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  lineHeight: 1.2,
  padding: '3px 8px',
  borderRadius: 6,
  flexShrink: 0
}

const actionMeta: CSSProperties = {
  fontFamily: macTheme.font,
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  color: 'rgba(235, 235, 245, 0.36)',
  lineHeight: 1.2
}

const bodyText: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.76)',
  fontSize: 12.5,
  lineHeight: 1.45,
  letterSpacing: '-0.012em',
  fontWeight: 400,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 88,
  overflow: 'hidden',
  paddingLeft: 1
}

const bodyMono: CSSProperties = {
  color: 'rgba(235, 235, 245, 0.52)',
  fontSize: 11,
  fontFamily: macTheme.mono,
  lineHeight: 1.4,
  letterSpacing: '-0.01em',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 64,
  overflow: 'hidden',
  padding: '6px 8px',
  borderRadius: 7,
  background: 'rgba(0, 0, 0, 0.28)',
  border: '0.5px solid rgba(255, 255, 255, 0.05)'
}

const footerWrap: CSSProperties = {
  flexShrink: 0,
  borderTop: '0.5px solid rgba(255, 255, 255, 0.05)',
  padding: '8px',
  background: 'rgba(0, 0, 0, 0.2)'
}

export const ACTIVITY_PANEL_SIZE = { width: PANEL_W, height: FEED_H }
