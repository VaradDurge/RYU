import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

/** Tucked lip / hit sensor under the notch */
const TUCKED_W = 140
const TUCKED_H = 36
/** Max island chrome while expanded (dock + permission card) */
const EXPANDED_W = 420
const EXPANDED_H = 360
/** Clear the hardware notch cutout */
const NOTCH_CLEAR_Y = 34

/**
 * Compact Mac island shell — a small panel under the notch, NOT a
 * full-screen transparent overlay. Full-screen + click-through cannot
 * receive hover on macOS over transparent pixels, so the island never woke.
 *
 * This window is always mouse-interactive; it only covers its own bounds,
 * so the rest of the desktop stays usable.
 */
export function createNotchWindow(): BrowserWindow {
  const b = islandBounds(TUCKED_W, TUCKED_H)

  const win = new BrowserWindow({
    width: b.width,
    height: b.height,
    x: b.x,
    y: b.y,
    show: false,
    frame: false,
    transparent: true,
    type: 'panel',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    focusable: true,
    enableLargerThanScreen: true,
    backgroundColor: '#00000000',
    acceptFirstMouse: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver', 1)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Always capture — window is small, so it won't block the desktop
  win.setIgnoreMouseEvents(false)

  try {
    win.setWindowButtonVisibility(false)
  } catch {
    // ignore
  }

  win.once('ready-to-show', () => {
    win.showInactive()
    forceIslandBounds(win, TUCKED_W, TUCKED_H)
    console.log('[ryu] island window ready', win.getBounds())
  })

  return win
}

export function setWindowInteractive(win: BrowserWindow, _interactive: boolean): void {
  // Compact shell is always interactive within its bounds.
  if (win.isDestroyed()) return
  win.setIgnoreMouseEvents(false)
}

export function setIslandContentSize(
  win: BrowserWindow,
  width: number,
  height: number
): void {
  if (win.isDestroyed()) return
  const w = Math.max(TUCKED_W, Math.min(EXPANDED_W, Math.ceil(width)))
  const h = Math.max(TUCKED_H, Math.min(EXPANDED_H, Math.ceil(height)))
  forceIslandBounds(win, w, h)
}

export function repositionNotchWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  const { width, height } = win.getBounds()
  forceIslandBounds(win, width, height)
}

function islandBounds(
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  const { x, y, width: dw } = screen.getPrimaryDisplay().bounds
  return {
    x: Math.round(x + (dw - width) / 2),
    y: Math.round(y + NOTCH_CLEAR_Y),
    width: Math.round(width),
    height: Math.round(height)
  }
}

function forceIslandBounds(win: BrowserWindow, width: number, height: number): void {
  const b = islandBounds(width, height)
  win.setBounds(b, false)
  win.setPosition(b.x, b.y, false)
  setTimeout(() => {
    if (win.isDestroyed()) return
    win.setBounds(b, false)
    win.setPosition(b.x, b.y, false)
  }, 40)
}
