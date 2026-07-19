import { AnimatePresence, motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import type { IslandMode, RyuEvent } from '../../shared/types'
import { theme } from '../theme'
import { Attention } from './Attention'
import { Expanded } from './Expanded'
import { glassSurface } from './glass'
import { GlowRing } from './GlowRing'
import { AgentIcon } from './AgentIcon'
import { Idle } from './Idle'
import { Resolved } from './Resolved'

export function Island({
  mode,
  event,
  lastDecision,
  onExpand,
  onAllow,
  onDeny,
  onHoverChange
}: {
  mode: IslandMode
  event: RyuEvent | null
  lastDecision: 'allow' | 'deny' | null
  onExpand: () => void
  onAllow: () => void
  onDeny: () => void
  onHoverChange: (hovering: boolean) => void
}) {
  const showCard = mode === 'expanded' && event

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 10,
        fontFamily: theme.font,
        userSelect: 'none',
        WebkitAppRegion: 'no-drag',
        pointerEvents: 'none'
      } as CSSProperties}
    >
      <div
        style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
      >
        {/* Top glass pill */}
        <motion.div
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          style={{
            ...glassSurface(false),
            borderRadius: theme.radiusPill,
            overflow: 'hidden',
            minHeight: 36
          }}
        >
          <AnimatePresence mode="wait">
            {mode === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ padding: 3 }}
              >
                <Idle />
              </motion.div>
            )}

            {mode === 'attention' && event && (
              <motion.div
                key="attention"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <Attention event={event} onExpand={onExpand} />
              </motion.div>
            )}

            {mode === 'expanded' && event && (
              <motion.div
                key="pill-expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 16px',
                  minWidth: 56
                }}
              >
                <div style={{ position: 'relative', width: 26, height: 26 }}>
                  <GlowRing active destructive={event.risk === 'destructive'} />
                  <AgentIcon agent={event.agent} size={26} />
                </div>
              </motion.div>
            )}

            {mode === 'resolved' && lastDecision && (
              <motion.div
                key="resolved"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Resolved decision={lastDecision} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Dashed connector + permission card (reference layout) */}
        <AnimatePresence>
          {showCard && (
            <motion.div
              key="card-stack"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div
                aria-hidden
                style={{
                  width: 1,
                  height: 22,
                  borderLeft: '1.5px dashed rgba(255,255,255,0.28)',
                  marginTop: 2,
                  marginBottom: 2
                }}
              />
              <div
                style={{
                  ...glassSurface(true),
                  borderRadius: theme.radiusCard,
                  overflow: 'hidden'
                }}
              >
                <Expanded event={event} onAllow={onAllow} onDeny={onDeny} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
