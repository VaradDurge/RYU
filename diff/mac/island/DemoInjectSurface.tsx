import { useState, type CSSProperties } from 'react'
import { macTheme } from './theme'

const BRIDGE = 'http://127.0.0.1:41999'

/**
 * Top-left Mac test panel — posts /status so notch dots update from main.
 */
export function DemoInjectSurface() {
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (err) {
      console.error('[ryu demo]', err)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={root}>
      <div style={label}>RYU · notice tests</div>
      <button
        type="button"
        style={btn}
        disabled={busy !== null}
        onClick={() =>
          run('running', async () => {
            await postStatus('cursor', 'running', 'Editing · demo')
            await postStatus('claude', 'running', 'Working…')
          })
        }
      >
        <span style={{ ...swatch, background: macTheme.success }} />
        Inject running
      </button>
      <button
        type="button"
        style={btn}
        disabled={busy !== null}
        onClick={() =>
          run('permission', async () => {
            await postStatus('claude', 'approval', 'Bash: git push origin main')
          })
        }
      >
        <span style={{ ...swatch, background: macTheme.waiting }} />
        Inject permission badge
      </button>
      <button
        type="button"
        style={btn}
        disabled={busy !== null}
        onClick={() =>
          run('error', async () => {
            await postStatus('cursor', 'error', 'Cursor · Crashed')
            await postStatus('codex', 'error', 'Codex · Crashed')
          })
        }
      >
        <span style={{ ...swatch, background: macTheme.danger }} />
        Inject error batch
      </button>
      <button
        type="button"
        style={{ ...btn, opacity: 0.85 }}
        disabled={busy !== null}
        onClick={() =>
          run('done', async () => {
            await postStatus('cursor', 'running', 'Finishing…')
            await sleep(100)
            await postStatus('cursor', 'idle', 'Done')
          })
        }
      >
        <span style={{ ...swatch, background: macTheme.idle }} />
        Inject completion
      </button>
    </div>
  )
}

async function postStatus(
  agent: 'cursor' | 'claude' | 'codex',
  status: 'idle' | 'running' | 'approval' | 'error',
  detail: string
): Promise<void> {
  const res = await fetch(`${BRIDGE}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent, status, detail })
  })
  if (!res.ok) throw new Error(`status ${res.status}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const root: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontFamily: macTheme.font,
  pointerEvents: 'auto',
  background: 'rgba(0,0,0,0.72)',
  border: '0.5px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
}

const label: CSSProperties = {
  color: 'rgba(235,235,245,0.45)',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  padding: '0 2px 2px'
}

const btn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: '0.5px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.9)',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit'
}

const swatch: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  flexShrink: 0
}
