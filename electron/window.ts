import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

export function createNotchWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()

  const win = new BrowserWindow({
    width: workArea.width,
    height: workArea.height,
    x: workArea.x,
    y: workArea.y,
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
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Default: click-through so desktop stays usable
  win.setIgnoreMouseEvents(true, { forward: true })

  win.once('ready-to-show', () => {
    win.showInactive()
    setWindowInteractive(win, false)
  })

  win.webContents.on('did-finish-load', () => {
    setWindowInteractive(win, false)
  })

  return win
}

export function setWindowInteractive(win: BrowserWindow, interactive: boolean): void {
  if (interactive) {
    // Capture only while pointer is over dock/card (hover-driven). Do not steal focus.
    win.setIgnoreMouseEvents(false)
  } else {
    win.setIgnoreMouseEvents(true, { forward: true })
  }
}

/** Optional region hint for future split-window work; keeps full-screen hit layer for hover. */
export function setInteractiveRegion(
  _win: BrowserWindow,
  _bounds: { x: number; y: number; width: number; height: number } | null
): void {
  // Windows keeps a full-screen click-through shell; interaction is hover-gated only.
}

export function repositionNotchWindow(win: BrowserWindow): void {
  const { workArea } = screen.getPrimaryDisplay()
  win.setBounds({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height
  })
}
