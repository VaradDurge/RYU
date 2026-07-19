import type { DockStatus } from '../types'

const COLORS: Record<DockStatus, string> = {
  idle: 'rgba(10, 132, 255, 0.75)',
  running: 'rgba(48, 209, 88, 0.95)',
  approval: 'rgba(255, 214, 10, 0.85)',
  error: 'rgba(255, 69, 58, 0.85)'
}

/**
 * Status ring around agent icons.
 * Running → spinner: starts nearly full, gap opens from the end and rotates.
 */
export function StatusRing({
  status,
  size = 16
}: {
  status: DockStatus
  size?: number
}) {
  const color = COLORS[status]
  const box = size + 6
  const stroke = 1.4
  const r = (box - stroke) / 2 - 0.4

  if (status === 'running') {
    return (
      <svg
        aria-hidden
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
        className="ryu-ring-spin"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          marginLeft: -box / 2,
          marginTop: -box / 2,
          pointerEvents: 'none',
          overflow: 'visible'
        }}
      >
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke="rgba(48, 209, 88, 0.2)"
          strokeWidth={stroke}
          pathLength={1}
        />
        <circle
          className="ryu-ring-dash"
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          // start near-full; CSS animates the break
          strokeDasharray="0.92 0.08"
          style={{ transformOrigin: `${box / 2}px ${box / 2}px` }}
        />
      </svg>
    )
  }

  return (
    <svg
      aria-hidden
      width={box}
      height={box}
      viewBox={`0 0 ${box} ${box}`}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        marginLeft: -box / 2,
        marginTop: -box / 2,
        pointerEvents: 'none'
      }}
    >
      <circle
        cx={box / 2}
        cy={box / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
      />
    </svg>
  )
}

/** @deprecated */
export function GlowRing({
  active,
  destructive = false
}: {
  active: boolean
  destructive?: boolean
}) {
  if (!active) return null
  return <StatusRing status={destructive ? 'error' : 'approval'} />
}
