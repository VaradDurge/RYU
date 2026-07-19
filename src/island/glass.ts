import type { CSSProperties } from 'react'
import { theme } from '../theme'

/**
 * Frosted look without relying on desktop backdrop sampling.
 * On Windows + transparent BrowserWindow, backdrop-filter usually
 * cannot blur what's behind the app — keep surfaces opaque enough
 * that IDE chrome doesn't show through the card.
 */
export const glassSurface = (strong = false): CSSProperties => ({
  background: strong
    ? `linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 40%), ${theme.glassStrong}`
    : `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 50%), ${theme.glass}`,
  border: `1px solid ${theme.glassBorder}`,
  boxShadow: theme.glassShadow,
  isolation: 'isolate'
})
