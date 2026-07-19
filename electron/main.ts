import { app, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { RyuBridge } from './bridge'
import type { RyuAgent, RyuDecision } from '../shared/types'
import * as windowWin from './window'
import * as windowMac from '../diff/mac/electron/window'
import {
  createNoticeWindow,
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
  let lastNotices: NoticePayload[] = []
  if (process.platform === 'darwin') {
    noticeWin = createNoticeWindow()
  }

  try {
    const port = await bridge.start(41999)
    console.log(`[ryu] bridge listening on 127.0.0.1:${port}`)
  } catch (err) {
    console.error('[ryu] bridge failed to start', err)
  }

  const loadRenderer = async (target: Electron.BrowserWindow, surface?: 'notices') => {
    if (process.env.ELECTRON_RENDERER_URL) {
      const base = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, '')
      const url =
        surface === 'notices' ? `${base}/?surface=notices` : base
      await target.loadURL(url)
    } else if (surface === 'notices') {
      await target.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { surface: 'notices' }
      })
    } else {
      await target.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  const pushNotices = (notices: NoticePayload[]) => {
    lastNotices = notices
    if (!noticeWin || noticeWin.isDestroyed()) return
    showNotices(noticeWin, notices)
    console.log(`[ryu] notices → ${notices.length} @ notch-right`)
  }

  await loadRenderer(win)
  if (noticeWin) {
    await loadRenderer(noticeWin, 'notices')
    // Re-send after React mounts (avoids missing the first IPC)
    noticeWin.webContents.on('did-finish-load', () => {
      if (lastNotices.length) showNotices(noticeWin!, lastNotices)
    })
  }

  ipcMain.on('ryu:setInteractive', (_e, interactive: boolean) => {
    windowApi.setWindowInteractive(win, Boolean(interactive))
  })

  // Mac compact island: resize the panel to hug visible content
  ipcMain.on('ryu:setIslandSize', (_e, size: { width: number; height: number }) => {
    if (process.platform !== 'darwin') return
    if (win.isDestroyed()) return
    const w = Number(size?.width) || 140
    const h = Number(size?.height) || 36
    windowMac.setIslandContentSize(win, w, h)
  })

  ipcMain.on('ryu:decision', (_e, decision: RyuDecision) => {
    bridge.resolveDecision(decision)
  })

  ipcMain.on('ryu:setNotices', (_e, notices: NoticePayload[]) => {
    pushNotices(Array.isArray(notices) ? notices : [])
  })

  // Notice surface ready — flush any buffered dots
  ipcMain.on('ryu:noticesReady', () => {
    if (!noticeWin || noticeWin.isDestroyed()) return
    showNotices(noticeWin, lastNotices)
  })

  ipcMain.on(
    'ryu:noticeClicked',
    (_e, payload: { id: string; agent: RyuAgent }) => {
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
