import { app, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { RyuBridge } from './bridge'
import { readAgentTranscript } from './agentTranscript'
import type { AgentActivityEvent, RyuAgent, RyuDecision } from '../shared/types'
import * as windowWin from './window'
import * as windowMac from '../diff/mac/electron/window'
import { createDemoWindow } from '../diff/mac/electron/demoWindow'
import {
  createNoticeWindow,
  raiseNoticeWindow,
  repositionNoticeWindow,
  showNotices,
  type NoticePayload
} from '../diff/mac/electron/noticeWindow'
import { spawnAgentPrompt } from '../diff/mac/electron/promptSpawn'

// Windows: help transparency / click-through in some GPU setups
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-direct-composition')
}

const bridge = new RyuBridge()
const windowApi = process.platform === 'darwin' ? windowMac : windowWin

function mergeActivity(
  transcript: AgentActivityEvent[],
  live: AgentActivityEvent[]
): AgentActivityEvent[] {
  const seen = new Set(transcript.map((e) => `${e.kind}|${e.title}|${e.detail || ''}`))
  const extras = live.filter((e) => {
    const key = `${e.kind}|${e.title}|${e.detail || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return [...transcript, ...extras].slice(-100)
}

app.whenReady().then(async () => {
  const win = windowApi.createNotchWindow()
  bridge.attachWindow(win)

  let noticeWin: Electron.BrowserWindow | null = null
  let demoWin: Electron.BrowserWindow | null = null
  let lastNotices: NoticePayload[] = []
  if (process.platform === 'darwin') {
    noticeWin = createNoticeWindow()
    if (!app.isPackaged || Boolean(process.env.ELECTRON_RENDERER_URL)) {
      demoWin = createDemoWindow()
    }
  }

  const pushNotices = (notices: NoticePayload[]) => {
    lastNotices = notices
    if (!noticeWin || noticeWin.isDestroyed()) return
    showNotices(noticeWin, notices)
  }

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

  ipcMain.on('ryu:setNotices', (_e, notices: NoticePayload[]) => {
    pushNotices(Array.isArray(notices) ? notices : [])
  })

  ipcMain.on('ryu:setIslandSize', (_e, size: { width: number; height: number }) => {
    if (process.platform !== 'darwin') return
    if (win.isDestroyed()) return
    const w = Number(size?.width) || 240
    const h = Number(size?.height) || 40
    windowMac.setIslandContentSize(win, w, h)
    if (noticeWin && !noticeWin.isDestroyed() && lastNotices.length > 0) {
      raiseNoticeWindow(noticeWin)
    }
  })

  await loadRenderer(win)

  if (process.platform === 'darwin') {
    let wasInside = false
    win.webContents.on('did-finish-load', () => {
      wasInside = false
    })
    const hoverPoll = setInterval(() => {
      if (win.isDestroyed() || win.webContents.isDestroyed()) return
      const cursor = screen.getCursorScreenPoint()
      const display = screen.getDisplayNearestPoint(cursor)
      const bounds = win.getBounds()
      // Reveal from anywhere on the hardware notch — not only the small lip window.
      const inside =
        windowMac.pointInRect(cursor, bounds) ||
        windowMac.pointInRect(cursor, windowMac.notchHitRect(display))

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

  ipcMain.on(
    'ryu:noticeClicked',
    (_e, payload: { id: string; agent: RyuAgent }) => {
      if (!win.isDestroyed()) {
        win.webContents.send('ryu:noticeClicked', payload)
      }
    }
  )

  ipcMain.handle(
    'ryu:sendPrompt',
    async (_e, payload: { agent: RyuAgent; text: string; cwd?: string }) => {
      return spawnAgentPrompt(bridge, payload)
    }
  )

  ipcMain.handle(
    'ryu:getAgentActivity',
    async (
      _e,
      payload: { agent: RyuAgent; workspace?: string | null }
    ): Promise<AgentActivityEvent[]> => {
      const agent = payload?.agent
      if (agent !== 'cursor' && agent !== 'claude' && agent !== 'codex') return []
      const workspace = payload?.workspace || bridge.lastWorkspace
      const transcript = readAgentTranscript(agent, workspace)
      const live = bridge.getActivity(agent)
      return mergeActivity(transcript, live)
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
