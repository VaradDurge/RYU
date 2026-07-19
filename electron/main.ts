import { app, ipcMain, screen, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { RyuBridge } from './bridge'
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

    ipcMain.on('ryu:decision', (_e, decision: RyuDecision) => {
      bridge.resolveDecision(decision)
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
