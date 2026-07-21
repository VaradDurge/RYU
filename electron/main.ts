import { app, ipcMain, screen, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { RyuBridge, computeInteractiveBounds, DEFAULT_PORT } from './bridge'
import type { RyuDecision } from '../shared/types'
import * as windowWin from './window'
import * as windowMac from '../diff/mac/electron/window'

const smoke = process.env.RYU_SMOKE === '1'
const preferredPort = Number(process.env.RYU_PORT) || DEFAULT_PORT

// Isolated userData for smoke / proof runs (never share production profile).
if (process.env.RYU_USER_DATA?.trim()) {
  const dir = process.env.RYU_USER_DATA.trim()
  mkdirSync(dir, { recursive: true })
  app.setPath('userData', dir)
}

// Windows: help transparency / click-through in some GPU setups
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-direct-composition')
}

// Smoke runs skip the single-instance lock so parallel proof fixtures can start.
const gotSingleInstanceLock = smoke ? true : app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  const bridge = new RyuBridge()
  const windowApi = process.platform === 'darwin' ? windowMac : windowWin
  let notchWindow: BrowserWindow | null = null

  if (!smoke) {
    app.on('second-instance', () => {
      if (!notchWindow || notchWindow.isDestroyed()) return
      if (notchWindow.isMinimized()) notchWindow.restore()
      notchWindow.showInactive()
    })
  }

  app.whenReady().then(async () => {
    notchWindow = windowApi.createNotchWindow()
    bridge.attachWindow(notchWindow)

    try {
      const port = await bridge.start(preferredPort)
      console.log(`[ryu] bridge listening on 127.0.0.1:${port}`)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code === 'EADDRINUSE') {
        console.error(
          `[ryu] bridge port ${preferredPort} already in use — another RYU instance may be running. Quit it and retry.`
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
      bridge.setInteractiveState(Boolean(interactive), bridge.getDiagnostics().lastInteractiveBounds)
    })

    ipcMain.on(
      'ryu:setInteractiveBounds',
      (_e, bounds: { x: number; y: number; width: number; height: number; mode?: string } | null) => {
        if (!notchWindow || notchWindow.isDestroyed()) return
        if (bounds && typeof windowApi.setInteractiveRegion === 'function') {
          windowApi.setInteractiveRegion(notchWindow, bounds)
        }
        if (bounds) {
          const mode = bounds.mode || 'dock'
          bridge.setInteractiveState(true, {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            mode
          })
        } else {
          bridge.setInteractiveState(false, null)
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

    ipcMain.handle('ryu:diagnostics', () => {
      return bridge.getDiagnostics()
    })

    ipcMain.handle('ryu:retryBridge', async () => {
      return bridge.retryStart()
    })

    ipcMain.handle(
      'ryu:computeBounds',
      (_e, mode: 'idle' | 'dock' | 'attention' | 'expanded' | 'resolved' | 'unavailable') => {
        const area =
          process.platform === 'darwin'
            ? screen.getPrimaryDisplay().bounds
            : screen.getPrimaryDisplay().workArea
        const bounds = computeInteractiveBounds(area, mode)
        bridge.setInteractiveState(bridge.getDiagnostics().interactive ?? false, bounds)
        return bounds
      }
    )

    // Smoke-only: expose whether wrapper uses shared core (never the token).
    if (smoke) {
      ipcMain.handle('ryu:smokeProbe', () => {
        const diag = bridge.getDiagnostics()
        return {
          ok: true,
          usesSharedCore: bridge.usesSharedCore(),
          core: diag.core,
          lifecycle: diag.lifecycle,
          port: diag.port,
          boundPort: diag.boundPort,
          reason: diag.reason,
          hasTokenField: Object.prototype.hasOwnProperty.call(diag, 'token') === false
        }
      })
    }

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
