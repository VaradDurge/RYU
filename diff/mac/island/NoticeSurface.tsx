import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type CSSProperties } from 'react'
import { AGENT_LABELS } from '../types'
import type { NotchNotice } from './NotchNotices'
import { macTheme } from './theme'

/**
 * Tiny surface for the dedicated notice BrowserWindow —
 * lives in the menu-bar gap to the right of the notch.
 * Shows ONE dot, colored by highest-priority notice.
 * Blue = finished (slow fade-in), Red = failed (fast blink).
 */
export function NoticeSurface() {
  const [notices, setNotices] = useState<NotchNotice[]>([])

  useEffect(() => {
    if (!window.ryu?.onNotices) return
    const unsub = window.ryu.onNotices((next) => setNotices(next))
    window.ryu.noticesReady?.()
    return unsub
  }, [])

  // inject the blink keyframes once
  useEffect(() => {
    const id = 'ryu-notice-blink-style'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes ryu-dot-blink {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.18; }
      }
      .ryu-dot-blink {
        animation: ryu-dot-blink 0.55s ease-in-out infinite;
      }
      @keyframes ryu-dot-glow {
        0%   { box-shadow: 0 0 0 0 rgba(255,59,48,0.55); }
        70%  { box-shadow: 0 0 6px 3px rgba(255,59,48,0); }
        100% { box-shadow: 0 0 0 0 rgba(255,59,48,0); }
      }
      .ryu-dot-glow {
        animation: ryu-dot-glow 0.55s ease-in-out infinite;
      }
    `
    document.head.appendChild(style)
  }, [])

  return (
    <div style={root}>
      <AnimatePresence initial={false}>
        {notices.map((n) => {
          const failed = n.kind === 'failed'
          const color = failed ? macTheme.danger : macTheme.idle
          const label = failed
            ? `${AGENT_LABELS[n.agent]} failed`
            : `${AGENT_LABELS[n.agent]} finished`

          return (
            <motion.button
              key={n.id}
              type="button"
              title={label}
              aria-label={label}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={
                failed
                  ? { duration: 0.2 }
                  : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
              }
              onClick={(e) => {
                e.preventDefault()
                window.ryu?.noticeClicked?.({ id: n.id, agent: n.agent })
              }}
              style={dotBtn}
            >
              <span
                className={failed ? 'ryu-dot-blink ryu-dot-glow' : undefined}
                style={{ ...dot, background: color }}
              />
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

const root: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  paddingLeft: 2,
  gap: 6,
  background: 'transparent',
  pointerEvents: 'auto',
  fontFamily: macTheme.font
}

const dotBtn: CSSProperties = {
  border: '0.5px solid rgba(255,255,255,0.14)',
  background: 'rgba(0,0,0,0.55)',
  padding: 3,
  margin: 0,
  borderRadius: 999,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 0
}

const dot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  display: 'block'
}
