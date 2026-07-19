/** Apple-leaning tokens for the Mac dock (slightly more translucent than Windows). */
export const macTheme = {
  glass: 'rgba(28, 28, 30, 0.78)',
  glassStrong: 'rgba(20, 20, 22, 0.88)',
  glassBorder: 'rgba(255, 255, 255, 0.16)',
  glassHighlight: 'rgba(255, 255, 255, 0.12)',
  glassShadow: '0 18px 50px rgba(0, 0, 0, 0.5)',
  glassBlur: 'blur(32px) saturate(1.5)',

  text: 'rgba(255, 255, 255, 0.94)',
  textMuted: 'rgba(255, 255, 255, 0.55)',
  textDim: 'rgba(255, 255, 255, 0.38)',

  approveBg: 'rgba(255, 255, 255, 0.96)',
  approveText: 'rgba(10, 10, 12, 0.92)',
  denyBg: 'rgba(255, 255, 255, 0.06)',
  denyBorder: 'rgba(255, 255, 255, 0.14)',
  denyText: 'rgba(255, 255, 255, 0.88)',

  waiting: '#F5C542',
  success: '#34C759',
  danger: '#FF453A',
  glow: 'rgba(255, 255, 255, 0.7)',
  glowSoft: 'rgba(255, 255, 255, 0.22)',

  inset: 'rgba(0, 0, 0, 0.45)',
  insetBorder: 'rgba(255, 255, 255, 0.08)',

  font: '-apple-system, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
  mono: '"SF Mono", "Menlo", ui-monospace, monospace',

  radiusPill: 999,
  radiusCard: 22,
  radiusControl: 12,

  notchHitWidth: 200,
  notchHitHeight: 36
} as const
