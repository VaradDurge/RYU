import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AGENT_LABELS } from '../types'
import type { NotchNotice, NotchNoticeKind } from './NotchNotices'
import { macTheme } from './theme'

/**
 * Vertical menu-bar status dots — right of the notch.
 * Only visible agents. Pulse while working; soft ping when work finishes.
 */
export function NoticeSurface() {
  const [notices, setNotices] = useState<NotchNotice[]>([])
  /** One-shot “done” ping after running → idle */
  const [doneFlash, setDoneFlash] = useState<Partial<Record<string, boolean>>>({})
  const prevKind = useRef<Partial<Record<string, NotchNoticeKind>>>({})

  useEffect(() => {
    if (!window.ryu?.onNotices) return
    const unsub = window.ryu.onNotices((next) => setNotices(next as NotchNotice[]))
    window.ryu.noticesReady?.()
    return unsub
  }, [])

  useEffect(() => {
    const timers: number[] = []
    for (const n of notices) {
      const prev = prevKind.current[n.id]
      if (prev === 'running' && n.kind === 'idle') {
        setDoneFlash((f) => ({ ...f, [n.id]: true }))
        const t = window.setTimeout(() => {
          setDoneFlash((f) => {
            const next = { ...f }
            delete next[n.id]
            return next
          })
        }, 1800)
        timers.push(t)
      }
      prevKind.current[n.id] = n.kind
    }
    // Drop stale prev entries for removed agents
    const ids = new Set(notices.map((n) => n.id))
    for (const id of Object.keys(prevKind.current)) {
      if (!ids.has(id)) delete prevKind.current[id]
    }
    return () => {
      for (const t of timers) window.clearTimeout(t)
    }
  }, [notices])

  useEffect(() => {
    const id = 'ryu-notice-dot-style'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes ryu-dot-pulse {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
          filter: brightness(1);
        }
        50% {
          transform: scale(1.55);
          opacity: 0.55;
          filter: brightness(1.25);
        }
      }
      @keyframes ryu-dot-blink-soft {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.35; }
      }
      @keyframes ryu-dot-blink-fast {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.18; }
      }
      @keyframes ryu-dot-done {
        0%   { transform: scale(1);    opacity: 1; box-shadow: 0 0 0 0 rgba(10, 132, 255, 0.55); }
        35%  { transform: scale(1.7);  opacity: 1; box-shadow: 0 0 0 4px rgba(10, 132, 255, 0); }
        100% { transform: scale(1);    opacity: 1; box-shadow: 0 0 0 0 rgba(10, 132, 255, 0); }
      }
      .ryu-dot-pulse {
        animation: ryu-dot-pulse 1.15s ease-in-out infinite;
      }
      .ryu-dot-blink-soft {
        animation: ryu-dot-blink-soft 1.1s ease-in-out infinite;
      }
      .ryu-dot-blink-fast {
        animation: ryu-dot-blink-fast 0.55s ease-in-out infinite;
      }
      .ryu-dot-done {
        animation: ryu-dot-done 0.9s ease-out 1;
      }
    `
    document.head.appendChild(style)
  }, [])

  return (
    <div style={root}>
      <AnimatePresence initial={false}>
        {notices.map((n) => {
          const animClass = doneFlash[n.id]
            ? 'ryu-dot-done'
            : n.kind === 'running'
              ? 'ryu-dot-pulse'
              : n.kind === 'failed'
                ? 'ryu-dot-blink-fast'
                : n.kind === 'permission'
                  ? 'ryu-dot-blink-soft'
                  : undefined

          return (
            <motion.button
              key={n.id}
              type="button"
              title={labelFor(n, Boolean(doneFlash[n.id]))}
              aria-label={labelFor(n, Boolean(doneFlash[n.id]))}
              initial={{ opacity: 0, scale: 0.45 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.45 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => {
                e.preventDefault()
                window.ryu?.noticeClicked?.({ id: n.id, agent: n.agent })
              }}
              style={hit}
            >
              <span
                className={animClass}
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
    case 'idle':
      return macTheme.idle
    case 'running':
      return macTheme.success
    case 'permission':
      return macTheme.waiting
    case 'failed':
      return macTheme.danger
  }
}

function labelFor(n: NotchNotice, justFinished: boolean): string {
  const name = AGENT_LABELS[n.agent]
  if (justFinished) return `${name} finished`
  switch (n.kind) {
    case 'idle':
      return `${name} ready`
    case 'running':
      return `${name} working`
    case 'permission':
      return `${name} needs permission`
    case 'failed':
      return `${name} failed`
  }
}

function softGlow(kind: NotchNoticeKind): string {
  switch (kind) {
    case 'idle':
      return '0 0 5px rgba(10, 132, 255, 0.5)'
    case 'running':
      return '0 0 6px rgba(48, 209, 88, 0.65)'
    case 'permission':
      return '0 0 5px rgba(255, 214, 10, 0.55)'
    case 'failed':
      return '0 0 5px rgba(255, 69, 58, 0.55)'
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
  width: 5,
  height: 5,
  borderRadius: 999,
  display: 'block',
  transformOrigin: 'center'
}
