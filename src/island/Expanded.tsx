import type { CSSProperties } from 'react'
import type { RyuEvent } from '../../shared/types'
import { theme } from '../theme'
import { AgentIcon } from './AgentIcon'

const agentNames = {
  claude: 'Claude',
  codex: 'Codex',
  cursor: 'Cursor'
} as const

/** Glassmorphic permission card — matches the reference card under the island. */
export function Expanded({
  event,
  onAllow,
  onDeny
}: {
  event: RyuEvent
  onAllow: () => void
  onDeny: () => void
}) {
  const name = agentNames[event.agent]
  const command = stripToolPrefix(event.preview)
  const path = event.path || '~/Projects/ryu'

  return (
    <div style={{ width: 380, padding: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WarningGlyph />
          <span style={{ color: theme.text, fontSize: 13.5, fontWeight: 600 }}>
            Tool Permission Required
          </span>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 9px',
            borderRadius: 999,
            background: 'rgba(245, 197, 66, 0.12)',
            border: '1px solid rgba(245, 197, 66, 0.28)',
            color: theme.waiting,
            fontSize: 11,
            fontWeight: 600
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: theme.waiting
            }}
          />
          Waiting
        </span>
      </div>

      {/* Agent line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12
        }}
      >
        <AgentIcon agent={event.agent} size={26} />
        <span style={{ color: theme.text, fontSize: 13.5 }}>
          <strong style={{ fontWeight: 650 }}>{name}</strong>
          <span style={{ color: theme.textMuted }}> wants to run a command.</span>
        </span>
      </div>

      {/* Command inset */}
      <div
        style={{
          background: theme.inset,
          border: `1px solid ${theme.insetBorder}`,
          borderRadius: theme.radiusControl,
          padding: '11px 12px',
          marginBottom: 8
        }}
      >
        <code
          style={{
            color: theme.text,
            fontFamily: theme.mono,
            fontSize: 12,
            lineHeight: 1.45,
            wordBreak: 'break-all',
            whiteSpace: 'pre-wrap'
          }}
        >
          {command}
        </code>
      </div>

      {/* Path */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: theme.textDim,
          fontSize: 11.5,
          marginBottom: 14,
          paddingLeft: 2
        }}
      >
        <FolderGlyph />
        <span style={{ fontFamily: theme.mono }}>{path}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={onDeny} style={denyBtn}>
          Deny
        </button>
        <button type="button" onClick={onAllow} style={approveBtn}>
          Approve
        </button>
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          color: theme.textDim,
          fontSize: 10.5
        }}
      >
        <LockGlyph />
        Local mode — All data stays on this device
      </div>
    </div>
  )
}

function stripToolPrefix(preview: string): string {
  // "Bash: npm test" → show as a shell-ish command for the card
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

const denyBtn: CSSProperties = {
  flex: 1,
  border: `1px solid ${theme.denyBorder}`,
  background: theme.denyBg,
  color: theme.denyText,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer'
}

const approveBtn: CSSProperties = {
  flex: 1,
  border: 'none',
  background: theme.approveBg,
  color: theme.approveText,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 650,
  cursor: 'pointer'
}
