import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type CSSProperties } from 'react'
import { AGENT_LABELS } from '../types'
import type { NotchNoticeKind } from './NotchNotices'
import { macTheme } from './theme'

type Notice = {
  id: string
  agent: 'cursor' | 'claude' | 'codex'
  kind: NotchNoticeKind
  ts: number
}

/**
 * Sequential Apple-style status dots — right of the notch.
 * Green = running · Yellow = permission · Red = error · Blue = finished
 */
export function NoticeSurface() {
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    if (!window.ryu?.onNotices) return
    const unsub = window.ryu.onNotices((next) => setNotices(next as Notice[]))
    window.ryu.noticesReady?.()
    return unsub
  }, [])

  useEffect(() => {
    const id = 'ryu-notice-dot-style'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes ryu-dot-blink {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.22; }
      }
      .ryu-dot-blink {
        animation: ryu-dot-blink 0.6s ease-in-out infinite;
      }
    `
    document.head.appendChild(style)
  }, [])

  return (
    <div style={root}>
      <AnimatePresence initial={false}>
        {notices.map((n) => {
          const failed = n.kind === 'failed'
          return (
            <motion.button
              key={n.id}
              type="button"
              title={labelFor(n)}
              aria-label={labelFor(n)}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: failed ? 0.16 : 0.55, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => {
                e.preventDefault()
                window.ryu?.noticeClicked?.({ id: n.id, agent: n.agent })
              }}
              style={hit}
            >
              <span
                className={failed ? 'ryu-dot-blink' : undefined}
                style={{
                  ...dot,
                  background: colorFor(n.kind),
                  boxShadow: softGlow(n.kind)
                }}
              />
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function colorFor(kind: NotchNoticeKind): string {
  switch (kind) {
    case 'running':
      return macTheme.success
    case 'permission':
      return macTheme.waiting
    case 'failed':
      return macTheme.danger
    case 'finished':
      return macTheme.idle
  }
}

function labelFor(n: Notice): string {
  const name = AGENT_LABELS[n.agent]
  switch (n.kind) {
    case 'running':
      return `${name} running`
    case 'permission':
      return `${name} needs permission`
    case 'failed':
      return `${name} failed`
    case 'finished':
      return `${name} finished`
  }
}

function softGlow(kind: NotchNoticeKind): string {
  switch (kind) {
    case 'running':
      return '0 0 5px rgba(48, 209, 88, 0.45)'
    case 'permission':
      return '0 0 5px rgba(255, 214, 10, 0.35)'
    case 'failed':
      return '0 0 5px rgba(255, 69, 58, 0.45)'
    case 'finished':
      return '0 0 5px rgba(10, 132, 255, 0.4)'
  }
}

const root: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  paddingTop: 2,
  gap: 3,
  background: 'transparent',
  pointerEvents: 'auto'
}

const hit: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 1,
  margin: 0,
  borderRadius: 999,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 0
}

const dot: CSSProperties = {
  width: 4,
  height: 4,
  borderRadius: 999,
  display: 'block'
}
