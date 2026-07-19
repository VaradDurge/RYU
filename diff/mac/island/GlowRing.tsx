import { motion, useReducedMotion } from 'framer-motion'
import { macTheme } from './theme'

export function GlowRing({
  active,
  destructive = false
}: {
  active: boolean
  destructive?: boolean
}) {
  const reduce = useReducedMotion()
  if (!active) return null
  const color = destructive ? macTheme.danger : macTheme.glow

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
          background: `radial-gradient(circle, ${macTheme.glowSoft} 0%, transparent 70%)`,
          pointerEvents: 'none'
        }}
        animate={reduce ? { opacity: 0.25 } : { opacity: [0.35, 0.15, 0.35] }}
        transition={reduce ? { duration: 0 } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  )
}
