import type { CSSProperties, MouseEvent } from 'react'
import type { RyuEvent } from '../../shared/types'
import { AgentIcon } from './AgentIcon'
import { theme } from '../theme'

const agentNames = {
  claude: 'Claude',
  codex: 'Codex',
  cursor: 'Cursor'
} as const

/** Permission card under the multi-agent dock. */
export function Expanded({
  event,
  waitingCount = 1,
  onAllow,
  onDeny,
  onDismiss
}: {
  event: RyuEvent
  waitingCount?: number
  onAllow: () => void
  onDeny: () => void
  onDismiss?: () => void
}) {
  const name = agentNames[event.agent]
  const command = stripToolPrefix(event.preview)
  const path = event.path || '~/Projects/ryu'
  const queuedBehind = Math.max(0, waitingCount - 1)

  const handle = (fn: () => void) => (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    fn()
  }

  return (
    <div style={{ width: 400, padding: 20, pointerEvents: 'auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WarningGlyph />
          <span style={{ color: theme.text, fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>
            Tool Permission Required
          </span>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 999,
            background: 'rgba(245, 197, 66, 0.14)',
            border: '1px solid rgba(245, 197, 66, 0.32)',
            color: theme.waiting,
            fontSize: 11.5,
            fontWeight: 600
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: theme.waiting,
              boxShadow: `0 0 6px ${theme.waiting}`
            }}
          />
          {queuedBehind > 0 ? `${waitingCount} waiting` : 'Waiting'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14
        }}
      >
        <AgentIcon agent={event.agent} size={36} />
        <span style={{ color: theme.text, fontSize: 14 }}>
          <strong style={{ fontWeight: 650 }}>{name}</strong>
          <span style={{ color: theme.textMuted }}> wants to run a command.</span>
        </span>
      </div>

      <div
        style={{
          background: theme.inset,
          border: `1px solid ${theme.insetBorder}`,
          borderRadius: 14,
          padding: '12px 14px',
          marginBottom: 10
        }}
      >
        <code
          style={{
            color: theme.text,
            fontFamily: theme.mono,
            fontSize: 12.5,
            lineHeight: 1.45,
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap'
          }}
        >
          {command}
        </code>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: theme.textDim,
          fontSize: 12,
          marginBottom: 10,
          paddingLeft: 2
        }}
      >
        <FolderGlyph />
        <span style={{ fontFamily: theme.mono }}>{path}</span>
      </div>

      <button type="button" style={detailsRow} tabIndex={-1}>
        <ChevronGlyph />
        Details
      </button>

      <div style={{ display: 'flex', gap: 10, marginBottom: onDismiss ? 8 : 14, marginTop: 2 }}>
        <button type="button" onMouseDown={handle(onDeny)} onClick={handle(onDeny)} style={denyBtn}>
          Deny
        </button>
        <button type="button" onMouseDown={handle(onAllow)} onClick={handle(onAllow)} style={approveBtn}>
          Approve
        </button>
      </div>

      {onDismiss ? (
        <button
          type="button"
          onMouseDown={handle(onDismiss)}
          onClick={handle(onDismiss)}
          style={dismissBtn}
        >
          Dismiss
        </button>
      ) : null}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          color: theme.textDim,
          fontSize: 11
        }}
      >
        <LockGlyph />
        Local mode — All data stays on this device
      </div>
    </div>
  )
}

function stripToolPrefix(preview: string): string {
  const m = preview.match(/^Bash:\s*(.+)$/i)
  if (m) {
    const cmd = m[1]
    if (cmd.includes('"') || cmd.startsWith('bash')) return cmd
    return `bash -lc "${cmd.replace(/"/g, '\\"')}"`
  }
  return preview
}

function WarningGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.6 14.6 13.2H1.4L8 1.6Z"
        stroke={theme.waiting}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8 6.2v3.2" stroke={theme.waiting} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.4" r="0.7" fill={theme.waiting} />
    </svg>
  )
}

function FolderGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 4.5h4l1.2 1.3H14v6.2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  )
}

function LockGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ChevronGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 3.5 11 8 6 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

const detailsRow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: 'none',
  background: 'transparent',
  color: theme.textDim,
  fontSize: 12,
  fontWeight: 500,
  padding: '0 2px 14px',
  cursor: 'default'
}

const denyBtn: CSSProperties = {
  flex: 1,
  border: `1px solid ${theme.denyBorder}`,
  background: 'rgba(255,255,255,0.08)',
  color: theme.denyText,
  borderRadius: 14,
  padding: '12px 14px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  pointerEvents: 'auto'
}

const approveBtn: CSSProperties = {
  flex: 1,
  border: 'none',
  background: theme.approveBg,
  color: theme.approveText,
  borderRadius: 14,
  padding: '12px 14px',
  fontSize: 14,
  fontWeight: 650,
  cursor: 'pointer',
  pointerEvents: 'auto'
}

const dismissBtn: CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  color: theme.textDim,
  borderRadius: 10,
  padding: '6px 8px 12px',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  pointerEvents: 'auto',
  marginBottom: 4
}
