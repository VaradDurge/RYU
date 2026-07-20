import { app, ipcMain, screen, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { RyuBridge, computeInteractiveBounds } from './bridge'
import type { RyuDecision } from '../shared/types'
import * as windowWin from './window'
import * as windowMac from '../diff/mac/electron/window'

// Windows: help transparency / click-through in some GPU setups
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-direct-composition')
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  const bridge = new RyuBridge()
  const windowApi = process.platform === 'darwin' ? windowMac : windowWin
  let notchWindow: BrowserWindow | null = null

  app.on('second-instance', () => {
    if (!notchWindow || notchWindow.isDestroyed()) return
    if (notchWindow.isMinimized()) notchWindow.restore()
    notchWindow.showInactive()
  })

  app.whenReady().then(async () => {
    notchWindow = windowApi.createNotchWindow()
    bridge.attachWindow(notchWindow)

    try {
      const port = await bridge.start(41999)
      console.log(`[ryu] bridge listening on 127.0.0.1:${port}`)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code === 'EADDRINUSE') {
        console.error(
          '[ryu] bridge port 41999 already in use — another RYU instance may be running. Quit it and retry.'
        )
      } else {
        console.error('[ryu] bridge failed to start', err)
      }
    }

    if (process.env.ELECTRON_RENDERER_URL) {
      await notchWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      await notchWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    ipcMain.on('ryu:setInteractive', (_e, interactive: boolean) => {
      if (!notchWindow || notchWindow.isDestroyed()) return
      windowApi.setWindowInteractive(notchWindow, Boolean(interactive))
    })

    ipcMain.on(
      'ryu:setInteractiveBounds',
      (_e, bounds: { x: number; y: number; width: number; height: number } | null) => {
        if (!notchWindow || notchWindow.isDestroyed()) return
        if (bounds && typeof windowApi.setInteractiveRegion === 'function') {
          windowApi.setInteractiveRegion(notchWindow, bounds)
        }
      }
    )

    ipcMain.handle('ryu:decision', (_e, decision: RyuDecision) => {
      return bridge.resolveDecision(decision)
    })

    ipcMain.handle('ryu:dismiss', (_e, id: string) => {
      if (typeof id !== 'string' || !id) return { ok: false, reason: 'invalid' }
      return bridge.dismiss(id)
    })

    ipcMain.handle('ryu:snapshot', () => {
      return bridge.getSnapshot()
    })

    // Expose bounds helper for future region updates (P1.4 remote unit coverage).
    ipcMain.handle('ryu:computeBounds', (_e, mode: 'idle' | 'dock' | 'expanded') => {
      const area =
        process.platform === 'darwin'
          ? screen.getPrimaryDisplay().bounds
          : screen.getPrimaryDisplay().workArea
      return computeInteractiveBounds(area, mode)
    })

    screen.on('display-metrics-changed', () => {
      if (notchWindow && !notchWindow.isDestroyed()) windowApi.repositionNotchWindow(notchWindow)
    })
  })

  app.on('window-all-closed', () => {
    bridge.stop()
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    bridge.stop()
  })
}
