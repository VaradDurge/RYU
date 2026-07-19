import { motion, useReducedMotion } from 'framer-motion'
import { theme } from '../theme'
import type { LiveAgentStatus } from './dockTypes'

const COLORS: Record<LiveAgentStatus, string> = {
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
  status: LiveAgentStatus
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

/** Attention pulse used when a permission card is focused. */
export function GlowRing({
  active,
  destructive = false
}: {
  active: boolean
  destructive?: boolean
}) {
  const reduce = useReducedMotion()
  if (!active) return null
  const color = destructive ? theme.danger : theme.glow

  return (
    <>
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -5,
          borderRadius: '50%',
          border: `1.5px solid ${color}`,
          pointerEvents: 'none',
          boxShadow: `0 0 12px ${destructive ? 'rgba(255,69,58,0.35)' : 'rgba(255,255,255,0.28)'}`
        }}
        animate={reduce ? { opacity: 0.85 } : { opacity: [0.55, 1, 0.55], scale: [1, 1.04, 1] }}
        transition={reduce ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -12,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.glowSoft} 0%, transparent 70%)`,
          pointerEvents: 'none'
        }}
        animate={reduce ? { opacity: 0.25 } : { opacity: [0.35, 0.15, 0.35] }}
        transition={reduce ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  )
}
