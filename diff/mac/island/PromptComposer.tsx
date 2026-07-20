import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent
} from 'react'
import type { RyuAgent } from '../../../shared/types'
import { AGENT_LABELS } from '../types'
import { macTheme } from './theme'

/**
 * Follow-up prompt — embedded in the activity sheet footer (Apple/Linear quiet).
 */
export function PromptComposer({
  agent,
  cwd,
  disabled,
  onFocusChange,
  onError,
  embedded = false
}: {
  agent: RyuAgent
  cwd?: string | null
  disabled?: boolean
  onFocusChange?: (focused: boolean) => void
  onError?: (message: string | null) => void
  /** Flush inset style when nested in ActivityPanel footer */
  embedded?: boolean
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const prevAgent = useRef(agent)

  const label = AGENT_LABELS[agent]
  const busy = Boolean(disabled || sending)
  const canSend = Boolean(text.trim()) && !busy

  useEffect(() => {
    if (prevAgent.current !== agent) {
      setText('')
      setHint(null)
      prevAgent.current = agent
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(t)
  }, [agent])

  const send = async () => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    if (agent === 'codex') {
      setHint('Codex prompt not wired yet')
      return
    }
    if (!window.ryu?.sendPrompt) {
      setHint('Prompt API unavailable')
      return
    }

    setSending(true)
    setHint(null)
    onError?.(null)
    try {
      const result = await window.ryu.sendPrompt({
        agent,
        text: trimmed,
        cwd: cwd || undefined
      })
      if (!result.ok) {
        const msg = result.error || 'Failed to send'
        setHint(msg)
        onError?.(msg)
      } else {
        setText('')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send'
      setHint(msg)
      onError?.(msg)
    } finally {
      setSending(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const setFocus = (next: boolean) => {
    setFocused(next)
    onFocusChange?.(next)
  }

  return (
    <form onSubmit={onSubmit} style={embedded ? wrapEmbedded : wrap}>
      <div
        style={{
          ...(embedded ? fieldEmbedded : field),
          borderColor: focused
            ? 'rgba(255, 255, 255, 0.16)'
            : embedded
              ? 'rgba(255, 255, 255, 0.07)'
              : macTheme.dockBorder
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={text}
          disabled={busy}
          placeholder={`Message ${label}…`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={input}
          aria-label={`Prompt ${label}`}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={`Send to ${label}`}
          title={`Send to ${label}`}
          style={{
            ...sendBtn,
            opacity: canSend ? 1 : 0.28,
            cursor: canSend ? 'pointer' : 'default',
            background: canSend ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.08)',
            color: canSend ? 'rgba(0, 0, 0, 0.88)' : 'rgba(255, 255, 255, 0.45)'
          }}
        >
          <SendArrow />
        </button>
      </div>
      {hint && <div style={hintStyle}>{hint}</div>}
    </form>
  )
}

function SendArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 11.5V2.5M7 2.5L3.25 6.25M7 2.5L10.75 6.25"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const wrap: CSSProperties = {
  width: '100%',
  maxWidth: 392,
  marginTop: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  pointerEvents: 'auto'
}

const wrapEmbedded: CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  pointerEvents: 'auto',
  margin: 0
}

const field: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  boxSizing: 'border-box',
  border: `0.5px solid ${macTheme.dockBorder}`,
  background: macTheme.dockBg,
  borderRadius: 12,
  padding: '4px 4px 4px 12px',
  backdropFilter: macTheme.dockBlur,
  WebkitBackdropFilter: macTheme.dockBlur,
  boxShadow: macTheme.dockShadow,
  transition: 'border-color 140ms ease'
}

const fieldEmbedded: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  boxSizing: 'border-box',
  border: '0.5px solid rgba(255, 255, 255, 0.07)',
  background: 'rgba(255, 255, 255, 0.04)',
  borderRadius: 11,
  padding: '3px 3px 3px 11px',
  transition: 'border-color 140ms ease'
}

const input: CSSProperties = {
  flex: 1,
  minWidth: 0,
  boxSizing: 'border-box',
  border: 'none',
  background: 'transparent',
  color: macTheme.text,
  padding: '7px 0',
  fontSize: 13,
  fontWeight: 400,
  letterSpacing: '-0.015em',
  fontFamily: macTheme.font,
  outline: 'none'
}

const sendBtn: CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: 8,
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'opacity 120ms ease, background 120ms ease'
}

const hintStyle: CSSProperties = {
  color: 'rgba(255, 69, 58, 0.85)',
  fontSize: 10.5,
  paddingLeft: 4,
  fontFamily: macTheme.font,
  letterSpacing: '-0.01em'
}
