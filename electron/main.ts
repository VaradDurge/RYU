import { app, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { RyuBridge } from './bridge'
import { createNotchWindow, repositionNotchWindow, setWindowInteractive } from './window'
import type { RyuDecision } from '../shared/types'

// Windows: help transparency / click-through in some GPU setups
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-direct-composition')
}

const bridge = new RyuBridge()

app.whenReady().then(async () => {
  const win = createNotchWindow()
  bridge.attachWindow(win)

  try {
    const port = await bridge.start(41999)
    console.log(`[ryu] bridge listening on 127.0.0.1:${port}`)
  } catch (err) {
    console.error('[ryu] bridge failed to start', err)
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  ipcMain.on('ryu:setInteractive', (_e, interactive: boolean) => {
    setWindowInteractive(win, Boolean(interactive))
  })

  ipcMain.on('ryu:decision', (_e, decision: RyuDecision) => {
    bridge.resolveDecision(decision)
  })

  screen.on('display-metrics-changed', () => repositionNotchWindow(win))
})

app.on('window-all-closed', () => {
  bridge.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  bridge.stop()
})
