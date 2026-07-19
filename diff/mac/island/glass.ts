import type { CSSProperties } from 'react'
import { macTheme } from './theme'

/**
 * Dark surface with a light glass wash (~30% glass / 70% black).
 */
export const macGlassSurface = (strong = false): CSSProperties => ({
  background: strong
    ? `linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%), ${macTheme.glassStrong}`
    : `linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 45%), ${macTheme.glass}`,
  border: `0.5px solid ${macTheme.glassBorder}`,
  boxShadow: macTheme.glassShadow,
  backdropFilter: macTheme.glassBlur,
  WebkitBackdropFilter: macTheme.glassBlur,
  isolation: 'isolate'
})
