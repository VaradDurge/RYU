import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActionResult,
  AgentStatusUpdate,
  BridgeDiagnostics,
  BridgeHealth,
  BridgeSnapshot,
  RyuDecision,
  RyuEvent
} from '../shared/types'

const smoke = process.env.RYU_SMOKE === '1'
const isDev =
  process.env.NODE_ENV === 'development' || Boolean(process.env.ELECTRON_RENDERER_URL) || smoke

contextBridge.exposeInMainWorld('ryu', {
  setInteractive: (interactive: boolean) => {
    ipcRenderer.send('ryu:setInteractive', interactive)
  },
  setInteractiveBounds: (
    bounds: { x: number; y: number; width: number; height: number; mode?: string } | null
  ) => {
    ipcRenderer.send('ryu:setInteractiveBounds', bounds)
  },
  decide: (decision: RyuDecision): Promise<ActionResult> => {
    return ipcRenderer.invoke('ryu:decision', decision)
  },
  dismiss: (id: string): Promise<ActionResult> => {
    return ipcRenderer.invoke('ryu:dismiss', id)
  },
  getSnapshot: (): Promise<BridgeSnapshot> => {
    return ipcRenderer.invoke('ryu:snapshot')
  },
  getDiagnostics: (): Promise<BridgeDiagnostics> => {
    return ipcRenderer.invoke('ryu:diagnostics')
  },
  retryBridge: (): Promise<{ ok: boolean; reason?: string; port?: number }> => {
    return ipcRenderer.invoke('ryu:retryBridge')
  },
  onEvent: (handler: (event: RyuEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: RyuEvent) => handler(event)
    ipcRenderer.on('ryu:event', listener)
    return () => {
      ipcRenderer.removeListener('ryu:event', listener)
    }
  },
  onCancel: (handler: (id: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, id: string) => handler(id)
    ipcRenderer.on('ryu:cancel', listener)
    return () => {
      ipcRenderer.removeListener('ryu:cancel', listener)
    }
  },
  onAgentStatus: (handler: (update: AgentStatusUpdate) => void) => {
    const listener = (_: Electron.IpcRendererEvent, update: AgentStatusUpdate) => handler(update)
    ipcRenderer.on('ryu:agentStatus', listener)
    return () => {
      ipcRenderer.removeListener('ryu:agentStatus', listener)
    }
  },
  onHealth: (handler: (health: BridgeHealth) => void) => {
    const listener = (_: Electron.IpcRendererEvent, health: BridgeHealth) => handler(health)
    ipcRenderer.on('ryu:health', listener)
    return () => {
      ipcRenderer.removeListener('ryu:health', listener)
    }
  },
  isDev: () => isDev,
  platform: process.platform as 'darwin' | 'win32' | 'linux',
  ...(smoke
    ? {
        smokeProbe: (): Promise<{
          ok: boolean
          usesSharedCore: boolean
          core: string
          lifecycle: string
          port: number
          boundPort: number | null
          reason: string | null
          hasTokenField: boolean
        }> => ipcRenderer.invoke('ryu:smokeProbe')
      }
    : {})
})
