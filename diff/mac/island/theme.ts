/**
 * Mac island tokens — dark minimal Apple.
 * ~70% solid near-black, ~30% glass (light blur + hairline).
 */
export const macTheme = {
  /** Surfaces: mostly opaque black, slight lift on cards */
  black: '#000000',
  surface: 'rgba(8, 8, 10, 0.94)',
  surfaceRaised: 'rgba(14, 14, 16, 0.96)',
  surfaceInset: 'rgba(0, 0, 0, 0.55)',

  /** Legacy aliases used across island components */
  glass: 'rgba(8, 8, 10, 0.94)',
  glassStrong: 'rgba(6, 6, 8, 0.97)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassHighlight: 'rgba(255, 255, 255, 0.04)',
  glassShadow: '0 0 0 0.5px rgba(0,0,0,0.8), 0 10px 28px rgba(0,0,0,0.45)',
  /** Light glass — 30% of the look */
  glassBlur: 'blur(18px) saturate(120%)',

  /** Dock pill */
  dockBg: 'rgba(0, 0, 0, 0.92)',
  dockBorder: 'rgba(255, 255, 255, 0.09)',
  dockShadow: '0 0 0 0.5px rgba(0,0,0,0.9), 0 6px 18px rgba(0,0,0,0.4)',
  dockBlur: 'blur(16px) saturate(110%)',

  /** Hover tip */
  tipBg: 'rgba(0, 0, 0, 0.94)',
  tipBorder: 'rgba(255, 255, 255, 0.1)',
  tipShadow: '0 0 0 0.5px rgba(0,0,0,0.85), 0 8px 24px rgba(0,0,0,0.5)',
  tipBlur: 'blur(16px) saturate(110%)',

  text: 'rgba(255, 255, 255, 0.92)',
  textMuted: 'rgba(235, 235, 245, 0.55)',
  textDim: 'rgba(235, 235, 245, 0.35)',

  approveBg: 'rgba(255, 255, 255, 0.94)',
  approveText: 'rgba(0, 0, 0, 0.92)',
  denyBg: 'rgba(255, 255, 255, 0.06)',
  denyBorder: 'rgba(255, 255, 255, 0.12)',
  denyText: 'rgba(255, 255, 255, 0.86)',

  /** System-ish accents — muted, not neon */
  waiting: '#FFD60A',
  success: '#30D158',
  danger: '#FF453A',
  idle: '#0A84FF',
  glow: 'rgba(255, 255, 255, 0.35)',
  glowSoft: 'rgba(255, 255, 255, 0.12)',

  inset: 'rgba(0, 0, 0, 0.65)',
  insetBorder: 'rgba(255, 255, 255, 0.07)',

  font: '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
  mono: '"SF Mono", "Menlo", ui-monospace, monospace',

  radiusPill: 999,
  radiusCard: 18,
  radiusControl: 11,

  /** Must clear the hardware notch (~37 CSS px on 14"/16" MacBook Pro) */
  notchBand: 38,
  /** Generous hit target — full cutout + a little margin on each side */
  notchHitWidth: 280,
  notchHitHeight: 44,

  /**
   * Hardware notch width in CSS px (must CLEAR the black cutout).
   * Notices sit in the empty menu-bar gap just to its right (before CPU/date icons).
   * Tuned for 14"/16" notched MacBooks — bump if dots sit under the notch.
   */
  notchWidth: 220,
  notchNoticeGap: 4,
  menuBarBand: 24
} as const
