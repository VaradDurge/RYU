import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

/** Approx hardware notch width (logical px) — clear the black cutout */
const NOTCH_WIDTH = 200
const NOTICE_GAP = 3
const NOTICE_WIN_W = 80
const MENU_BAND = 24

export type NoticePayload = {
  id: string
  agent: 'cursor' | 'claude' | 'codex'
  kind: 'finished' | 'failed'
  ts: number
}

/**
 * Tiny panel in the menu-bar gap immediately RIGHT of the notch.
 * enableLargerThanScreen + panel lets us sit at y=0 (macOS otherwise clamps to workArea).
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
    type: 'panel',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    focusable: false,
    // Critical: allow y=0 inside the menu-bar band
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
    y, // display top — menu bar / green-circle zone
    width: NOTICE_WIN_W,
    height: MENU_BAND
  }
}

export function repositionNoticeWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  forceBounds(win)
}

export function showNotices(win: BrowserWindow, notices: NoticePayload[]): void {
  if (win.isDestroyed()) return

  win.webContents.send('ryu:notices', notices)

  if (notices.length === 0) {
    win.setIgnoreMouseEvents(true, { forward: true })
    win.hide()
    return
  }

  win.setIgnoreMouseEvents(false)
  win.setAlwaysOnTop(true, 'screen-saver', 1)
  win.showInactive()
  forceBounds(win)
  win.moveTop()
  console.log(`[ryu] notice window bounds`, win.getBounds())
}

function forceBounds(win: BrowserWindow): void {
  const b = noticeBounds()
  win.setBounds(b, false)
  win.setPosition(b.x, b.y, false)
  setTimeout(() => {
    if (win.isDestroyed()) return
    win.setBounds(b, false)
    win.setPosition(b.x, b.y, false)
  }, 50)
}
