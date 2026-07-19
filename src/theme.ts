export const theme = {
  // Near-opaque “glass” — real backdrop-filter can't sample the desktop
  // through a transparent Electron window on Windows, so translucency
  // just shows Cursor/IDE text underneath (looks like a double overlay).
  glass: 'rgba(32, 32, 34, 0.94)',
  glassStrong: 'rgba(28, 28, 30, 0.97)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  glassHighlight: 'rgba(255, 255, 255, 0.08)',
  // Single soft shadow — stacked shadows read as a second outline
  glassShadow: '0 12px 40px rgba(0, 0, 0, 0.55)',

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
  glow: 'rgba(255, 255, 255, 0.55)',
  glowSoft: 'rgba(255, 255, 255, 0.18)',

  inset: 'rgba(0, 0, 0, 0.45)',
  insetBorder: 'rgba(255, 255, 255, 0.08)',

  font: '-apple-system, "SF Pro Text", "SF Pro Display", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
  mono: '"SF Mono", "Menlo", "Cascadia Code", "Consolas", ui-monospace, monospace',

  radiusPill: 999,
  radiusCard: 22,
  radiusControl: 12
} as const
