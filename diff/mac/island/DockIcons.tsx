import type { CSSProperties } from 'react'
import type { DockSlotId } from '../types'
import { macTheme } from './theme'
import { AgentIcon } from './AgentIcon'

export function DockIcon({ id, size = 26 }: { id: DockSlotId; size?: number }) {
  if (id === 'claude' || id === 'codex' || id === 'cursor') {
    return <AgentIcon agent={id} size={size} />
  }

  const wrap: CSSProperties = {
    width: size,
    height: size,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.9)'
  }

  const s = Math.round(size * 0.7)

  return (
    <span style={wrap} aria-hidden>
      {id === 'cube' && <CubeIcon size={s} />}
      {id === 'sparkle' && <SparkleIcon size={s} />}
      {id === 'terminal' && <TerminalIcon size={s} />}
      {id === 'sailboat' && <TrayIcon size={s} />}
      {id === 'add' && <AddIcon size={s} />}
    </span>
  )
}

function CubeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 12V21M12 12 20 7.5M12 12 4 7.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function SparkleIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.5 13.6 9.2 19 10.5l-4.5 3.7L15.8 20 12 16.8 8.2 20l1.3-5.8L5 10.5l5.4-1.3L12 3.5Z"
        stroke={macTheme.waiting}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TerminalIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M7 10.5 9.5 12.5 7 14.5M12 14.5h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Download / tray icon matching the reference dock */
function TrayIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4v10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 10.5 12 14.5 16 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 17.5h14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M6.5 17.5v1.2a1.3 1.3 0 0 0 1.3 1.3h8.4a1.3 1.3 0 0 0 1.3-1.3v-1.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AddIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
