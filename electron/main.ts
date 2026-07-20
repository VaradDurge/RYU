import { app, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { RyuBridge } from './bridge'
import type { RyuAgent, RyuDecision } from '../shared/types'
import * as windowWin from './window'
import * as windowMac from '../diff/mac/electron/window'
import { createDemoWindow } from '../diff/mac/electron/demoWindow'
import { NoticeState } from '../diff/mac/electron/noticeState'
import {
  createNoticeWindow,
  raiseNoticeWindow,
  repositionNoticeWindow,
  showNotices,
  type NoticePayload
} from '../diff/mac/electron/noticeWindow'

// Windows: help transparency / click-through in some GPU setups
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-direct-composition')
}

const bridge = new RyuBridge()
const windowApi = process.platform === 'darwin' ? windowMac : windowWin

app.whenReady().then(async () => {
  const win = windowApi.createNotchWindow()
  bridge.attachWindow(win)

  let noticeWin: Electron.BrowserWindow | null = null
  let demoWin: Electron.BrowserWindow | null = null
  let lastNotices: NoticePayload[] = []
  const noticeState = new NoticeState()
  if (process.platform === 'darwin') {
    noticeWin = createNoticeWindow()
    // Top-left inject panel for testing notch dots (dev)
    if (!app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL)) {
      demoWin = createDemoWindow()
    }
  }

  const pushNotices = (notices: NoticePayload[]) => {
    lastNotices = notices
    if (!noticeWin || noticeWin.isDestroyed()) return
    showNotices(noticeWin, notices)
  }

  // Notch dots driven from bridge /status (not island React) so injects always work
  bridge.setStatusListener((update) => {
    if (process.platform !== 'darwin') return
    pushNotices(noticeState.apply(update.agent, update.status))
  })

  try {
    const port = await bridge.start(41999)
    console.log(`[ryu] bridge listening on 127.0.0.1:${port}`)
  } catch (err) {
    console.error('[ryu] bridge failed to start', err)
  }

  const loadRenderer = async (
    target: Electron.BrowserWindow,
    surface?: 'notices' | 'demo'
  ) => {
    if (process.env.ELECTRON_RENDERER_URL) {
      const base = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, '')
      const url = surface ? `${base}/?surface=${surface}` : base
      await target.loadURL(url)
    } else if (surface) {
      await target.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { surface }
      })
    } else {
      await target.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  // Register sizing before React mounts so the first layout isn't dropped.
  ipcMain.on('ryu:setIslandSize', (_e, size: { width: number; height: number }) => {
    if (process.platform !== 'darwin') return
    if (win.isDestroyed()) return
    const w = Number(size?.width) || 140
    const h = Number(size?.height) || 36
    windowMac.setIslandContentSize(win, w, h)
    // Island resize can cover the notch-right strip — keep dots on top
    if (noticeWin && !noticeWin.isDestroyed() && lastNotices.length > 0) {
      raiseNoticeWindow(noticeWin)
    }
  })

  await loadRenderer(win)

  // Native cursor vs window-bounds — Chromium hover on transparent macOS
  // windows is unreliable. Only emit enter/leave transitions.
  if (process.platform === 'darwin') {
    let wasInside = false
    win.webContents.on('did-finish-load', () => {
      wasInside = false
    })
    const hoverPoll = setInterval(() => {
      if (win.isDestroyed() || win.webContents.isDestroyed()) return
      const cursor = screen.getCursorScreenPoint()
      const bounds = win.getBounds()
      const inside =
        cursor.x >= bounds.x &&
        cursor.x < bounds.x + bounds.width &&
        cursor.y >= bounds.y &&
        cursor.y < bounds.y + bounds.height

      if (inside === wasInside) return
      wasInside = inside
      win.webContents.send('ryu:islandHover', inside)
    }, 50)
    hoverPoll.unref()
    win.once('closed', () => clearInterval(hoverPoll))
  }

  if (noticeWin) {
    await loadRenderer(noticeWin, 'notices')
    noticeWin.webContents.on('did-finish-load', () => {
      if (lastNotices.length) showNotices(noticeWin!, lastNotices)
    })
  }

  if (demoWin) {
    await loadRenderer(demoWin, 'demo')
  }

  ipcMain.on('ryu:setInteractive', (_e, interactive: boolean) => {
    windowApi.setWindowInteractive(win, Boolean(interactive))
  })

  ipcMain.on('ryu:decision', (_e, decision: RyuDecision) => {
    bridge.resolveDecision(decision)
  })

  ipcMain.on('ryu:noticesReady', () => {
    if (!noticeWin || noticeWin.isDestroyed()) return
    showNotices(noticeWin, lastNotices)
  })

  ipcMain.on('ryu:clearNotices', () => {
    pushNotices(noticeState.clearSticky())
  })

  ipcMain.on(
    'ryu:noticeClicked',
    (_e, payload: { id: string; agent: RyuAgent }) => {
      pushNotices(noticeState.clearAgent(payload.agent))
      if (!win.isDestroyed()) {
        win.webContents.send('ryu:noticeClicked', payload)
      }
    }
  )

  screen.on('display-metrics-changed', () => {
    windowApi.repositionNotchWindow(win)
    if (noticeWin && !noticeWin.isDestroyed()) {
      repositionNoticeWindow(noticeWin)
    }
  })
})

app.on('window-all-closed', () => {
  bridge.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  bridge.stop()
})
