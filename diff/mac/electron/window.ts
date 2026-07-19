import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

/**
 * Mac notch shell — covers full display bounds (including menubar / notch)
 * so the renderer can receive hover in the notch hit zone.
 */
export function createNotchWindow(): BrowserWindow {
  const { bounds } = screen.getPrimaryDisplay()

  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
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

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Default click-through; renderer enables interaction when over UI
  win.setIgnoreMouseEvents(true, { forward: true })

  try {
    win.setWindowButtonVisibility(false)
  } catch {
    // ignore
  }

  win.once('ready-to-show', () => {
    win.showInactive()
  })

  return win
}

export function setWindowInteractive(win: BrowserWindow, interactive: boolean): void {
  if (interactive) {
    // Full mouse capture — required for reliable Approve/Deny clicks on macOS
    win.setIgnoreMouseEvents(false)
    if (!win.isFocused()) {
      win.focus()
    }
  } else {
    win.setIgnoreMouseEvents(true, { forward: true })
  }
}

export function repositionNotchWindow(win: BrowserWindow): void {
  const { bounds } = screen.getPrimaryDisplay()
  win.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  })
}
