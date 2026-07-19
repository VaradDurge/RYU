import { contextBridge, ipcRenderer } from 'electron'
import type { RyuDecision, RyuEvent } from '../shared/types'

contextBridge.exposeInMainWorld('ryu', {
  setInteractive: (interactive: boolean) => {
    ipcRenderer.send('ryu:setInteractive', interactive)
  },
  decide: (decision: RyuDecision) => {
    ipcRenderer.send('ryu:decision', decision)
  },
  onEvent: (handler: (event: RyuEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: RyuEvent) => handler(event)
    ipcRenderer.on('ryu:event', listener)
    return () => {
      ipcRenderer.removeListener('ryu:event', listener)
    }
  },
  isDev: () => process.env.NODE_ENV === 'development' || Boolean(process.env.ELECTRON_RENDERER_URL)
})
