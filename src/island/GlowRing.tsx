import { motion } from 'framer-motion'
import { theme } from '../theme'

/** Soft selection ring around the active agent icon (inside the pill — not a hanging badge). */
export function GlowRing({
  active,
  destructive = false
}: {
  active: boolean
  destructive?: boolean
}) {
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
          boxShadow: `0 0 12px ${destructive ? 'rgba(255,69,58,0.35)' : 'rgba(255,255,255,0.25)'}`
        }}
        animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.04, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
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
        animate={{ opacity: [0.35, 0.15, 0.35] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </>
  )
}
