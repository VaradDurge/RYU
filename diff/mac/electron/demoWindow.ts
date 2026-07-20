import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

const W = 188
const H = 168

/** Small top-left injector panel for testing notch notice dots (dev). */
export function createDemoWindow(): BrowserWindow {
  const { x, y } = screen.getPrimaryDisplay().bounds

  const win = new BrowserWindow({
    width: W,
    height: H,
    x: x + 14,
    y: y + 36,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    acceptFirstMouse: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'floating', 1)
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(false)

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
