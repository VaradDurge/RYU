import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

/** Tucked lip / hit sensor under the notch — wide enough to match the cutout */
export const TUCKED_W = 240
export const TUCKED_H = 40
/** Dock + hover tip room (tips grow with summary text) */
export const DOCK_W = 420
export const DOCK_H = 200
/** Dock + activity panel + prompt composer */
export const EXPANDED_W = 460
export const EXPANDED_H = 580
/**
 * Content clears the hardware notch cutout.
 * Hover hit-testing for the notch itself uses `notchHitRect()` (y = 0).
 */
const NOTCH_CLEAR_Y = 34

/**
 * Full hardware-notch hover target (screen coords).
 * Wider/taller than the black cutout so entering from any side counts.
 */
export const NOTCH_HIT_W = 280
export const NOTCH_HIT_H = 44

export function notchHitRect(display = screen.getPrimaryDisplay()): {
  x: number
  y: number
  width: number
  height: number
} {
  const { x, y, width } = display.bounds
  return {
    x: Math.round(x + (width - NOTCH_HIT_W) / 2),
    y: Math.round(y),
    width: NOTCH_HIT_W,
    height: NOTCH_HIT_H
  }
}

export function pointInRect(
  pt: { x: number; y: number },
  r: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    pt.x >= r.x &&
    pt.x < r.x + r.width &&
    pt.y >= r.y &&
    pt.y < r.y + r.height
  )
}

/**
 * Compact Mac island shell — a small panel under the notch.
 * Always mouse-interactive within its own bounds so the desktop stays usable.
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
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    focusable: true,
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
  win.setIgnoreMouseEvents(false)

  try {
    win.setWindowButtonVisibility(false)
  } catch {
    // ignore
  }

  win.once('ready-to-show', () => {
    win.showInactive()
    forceIslandBounds(win, TUCKED_W, TUCKED_H)
  })

  return win
}

export function setWindowInteractive(win: BrowserWindow, _interactive: boolean): void {
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
  const cur = win.getBounds()
  if (cur.width === w && cur.height === h) return
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
}
