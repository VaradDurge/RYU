import { motion, useReducedMotion } from 'framer-motion'
import { macTheme } from './theme'

/** Glowing white dot that sits under the hardware notch. */
export function NotchAnchor({
  attention = false,
  showStem = false
}: {
  attention?: boolean
  showStem?: boolean
}) {
  const reduce = useReducedMotion()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none'
      }}
    >
      <motion.div
        aria-hidden
        style={{
          width: attention ? 7 : 5,
          height: attention ? 7 : 5,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: attention
            ? `0 0 14px rgba(255,255,255,0.85), 0 0 4px ${macTheme.waiting}`
            : '0 0 10px rgba(255,255,255,0.65)'
        }}
        animate={
          reduce
            ? { opacity: 1 }
            : attention
              ? { opacity: [0.7, 1, 0.7], scale: [1, 1.08, 1] }
              : { opacity: 0.9 }
        }
        transition={
          reduce || !attention
            ? { duration: 0.2 }
            : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      {showStem && (
        <div
          aria-hidden
          style={{
            width: 1,
            height: 10,
            marginTop: 2,
            borderLeft: '1.5px dashed rgba(255,255,255,0.28)'
          }}
        />
      )}
    </div>
  )
}
