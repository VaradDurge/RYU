import type { CSSProperties } from 'react'
import type { RyuEvent } from '../../shared/types'
import { interactiveEnter, interactiveLeave } from '../../diff/mac/island/interactive'
import { theme } from '../theme'

function uid(): string {
  return crypto.randomUUID()
}

export function makePermissionEvent(overrides?: Partial<RyuEvent>): RyuEvent {
  return {
    id: uid(),
    agent: 'claude',
    sessionLabel: 'claude · ryu',
    tool: 'Bash',
    preview: 'Bash: git push origin main',
    path: '~/Projects/ryu',
    risk: 'normal',
    ts: Date.now(),
    ...overrides
  }
}

export function makeScaryEvent(): RyuEvent {
  return makePermissionEvent({
    preview: 'Bash: rm -rf ./dist node_modules/.cache',
    risk: 'destructive',
    sessionLabel: 'claude · cleanup',
    path: '~/Projects/ryu'
  })
}

export function makeCodexEvent(): RyuEvent {
  return makePermissionEvent({
    agent: 'codex',
    sessionLabel: 'codex · ryu',
    preview: 'Bash: npm test -- --watch'
  })
}

export function makeCursorEvent(): RyuEvent {
  return makePermissionEvent({
    agent: 'cursor',
    sessionLabel: 'cursor · ryu',
    preview: 'Bash: pnpm lint',
    path: '~/Projects/ryu'
  })
}

/** ~90s pitch timeline — injects attention, waits for user decide, etc. */
export function runPitchTimeline(inject: (e: RyuEvent) => void): () => void {
  const timers: number[] = []
  const later = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms))
  }

  later(1500, () => inject(makePermissionEvent()))
  later(25000, () => inject(makeScaryEvent()))

  return () => timers.forEach((t) => clearTimeout(t))
}

export function DemoHarness({
  onInject,
  visible
}: {
  onInject: (e: RyuEvent) => void
  visible: boolean
}) {
  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        top: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        zIndex: 50,
        fontFamily: theme.font,
        pointerEvents: 'auto'
      }}
      onMouseEnter={() => interactiveEnter()}
      onMouseLeave={() => interactiveLeave()}
    >
      <button type="button" style={btn} onClick={() => onInject(makePermissionEvent())}>
        Inject permission
      </button>
      <button type="button" style={btn} onClick={() => onInject(makeCodexEvent())}>
        Inject Codex
      </button>
      <button type="button" style={btn} onClick={() => onInject(makeCursorEvent())}>
        Inject Cursor
      </button>
      <button type="button" style={btn} onClick={() => onInject(makeScaryEvent())}>
        Inject scary rm
      </button>
      <button
        type="button"
        style={btn}
        onClick={() => {
          runPitchTimeline(onInject)
        }}
      >
        Run pitch timeline
      </button>
    </div>
  )
}

const btn: CSSProperties = {
  border: `1px solid ${theme.glassBorder}`,
  background: theme.glass,
  color: theme.text,
  borderRadius: 10,
  padding: '7px 11px',
  fontSize: 11,
  cursor: 'pointer',
  textAlign: 'left',
  backdropFilter: 'blur(16px)'
}
