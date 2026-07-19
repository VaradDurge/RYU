import type { CSSProperties } from 'react'
import { macTheme } from './theme'

export const macGlassSurface = (strong = false): CSSProperties => ({
  background: strong
    ? `linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 42%), ${macTheme.glassStrong}`
    : `linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 50%), ${macTheme.glass}`,
  border: `1px solid ${macTheme.glassBorder}`,
  boxShadow: macTheme.glassShadow,
  backdropFilter: macTheme.glassBlur,
  WebkitBackdropFilter: macTheme.glassBlur,
  isolation: 'isolate'
})
