import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

/** Clear the black notch cutout — vertical stack sits tight to its right */
const NOTCH_WIDTH = 196
const NOTICE_GAP = 1
/** Narrow column — one small-dot wide, up to three stacked */
const NOTICE_WIN_W = 12
const NOTICE_WIN_H = 42

export type NoticePayload = {
  id: string
  agent: 'cursor' | 'claude' | 'codex'
  kind: 'idle' | 'running' | 'permission' | 'failed'
  ts: number
}

/**
 * Tiny strip immediately RIGHT of the notch.
 * Level 2 screen-saver so it stays above the island window (which covers
 * this x-range when the dock is expanded).
 */
export function createNoticeWindow(): BrowserWindow {
  const b = noticeBounds()

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
    focusable: false,
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

  raiseNoticeWindow(win)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true, { forward: true })

  try {
    win.setWindowButtonVisibility(false)
  } catch {
    // ignore
  }

  return win
}

export function noticeBounds(): { x: number; y: number; width: number; height: number } {
  const display = screen.getPrimaryDisplay()
  const { x, y, width } = display.bounds

  return {
    x: Math.round(x + width / 2 + NOTCH_WIDTH / 2 + NOTICE_GAP),
    y: Math.round(y + 1),
    width: NOTICE_WIN_W,
    height: NOTICE_WIN_H
  }
}

export function raiseNoticeWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  // Relative level above the island (island uses screen-saver, 1)
  win.setAlwaysOnTop(true, 'screen-saver', 2)
  win.moveTop()
}

export function repositionNoticeWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  forceBounds(win)
  raiseNoticeWindow(win)
}

export function showNotices(win: BrowserWindow, notices: NoticePayload[]): void {
  if (win.isDestroyed()) return

  if (!win.webContents.isDestroyed()) {
    win.webContents.send('ryu:notices', notices)
  }

  // Keep the strip visible; renderer draws zero dots when nothing is available.
  win.setIgnoreMouseEvents(false)
  if (!win.isVisible()) win.showInactive()
  forceBounds(win)
  raiseNoticeWindow(win)
  console.log(
    '[ryu] notices',
    notices.map((n) => `${n.agent}:${n.kind}`).join(', ') || '(none)',
    win.getBounds()
  )
}

function forceBounds(win: BrowserWindow): void {
  const b = noticeBounds()
  win.setBounds(b, false)
  win.setPosition(b.x, b.y, false)
  setTimeout(() => {
    if (win.isDestroyed()) return
    win.setBounds(b, false)
    win.setPosition(b.x, b.y, false)
    raiseNoticeWindow(win)
  }, 40)
}
