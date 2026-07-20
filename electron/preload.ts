import { contextBridge, ipcRenderer } from 'electron'
import type {
  AgentActivityEvent,
  AgentStatusUpdate,
  RyuAgent,
  RyuDecision,
  RyuEvent
} from '../shared/types'

type NoticePayload = {
  id: string
  agent: RyuAgent
  kind: 'idle' | 'running' | 'permission' | 'failed'
  ts: number
}

type SendPromptResult = { ok: boolean; error?: string }

contextBridge.exposeInMainWorld('ryu', {
  setInteractive: (interactive: boolean) => {
    ipcRenderer.send('ryu:setInteractive', interactive)
  },
  /** Mac: resize the compact island panel to content */
  setIslandSize: (size: { width: number; height: number }) => {
    ipcRenderer.send('ryu:setIslandSize', size)
  },
  /** Main → island: native cursor entered/left compact window bounds */
  onIslandHover: (handler: (inside: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, inside: boolean) =>
      handler(Boolean(inside))
    ipcRenderer.on('ryu:islandHover', listener)
    return () => {
      ipcRenderer.removeListener('ryu:islandHover', listener)
    }
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
  onAgentStatus: (handler: (update: AgentStatusUpdate) => void) => {
    const listener = (_: Electron.IpcRendererEvent, update: AgentStatusUpdate) =>
      handler(update)
    ipcRenderer.on('ryu:agentStatus', listener)
    return () => {
      ipcRenderer.removeListener('ryu:agentStatus', listener)
    }
  },
  /** Live activity push from bridge /status + /activity */
  onAgentActivity: (handler: (event: AgentActivityEvent) => void) => {
    const listener = (_: Electron.IpcRendererEvent, event: AgentActivityEvent) =>
      handler(event)
    ipcRenderer.on('ryu:agentActivity', listener)
    return () => {
      ipcRenderer.removeListener('ryu:agentActivity', listener)
    }
  },
  /** Snapshot: transcript + live ring buffer for hover panel */
  getAgentActivity: (payload: {
    agent: RyuAgent
    workspace?: string | null
  }): Promise<AgentActivityEvent[]> => {
    return ipcRenderer.invoke('ryu:getAgentActivity', payload)
  },
  setNotices: (notices: NoticePayload[]) => {
    ipcRenderer.send('ryu:setNotices', notices)
  },
  onNotices: (handler: (notices: NoticePayload[]) => void) => {
    const listener = (_: Electron.IpcRendererEvent, notices: NoticePayload[]) =>
      handler(notices)
    ipcRenderer.on('ryu:notices', listener)
    return () => {
      ipcRenderer.removeListener('ryu:notices', listener)
    }
  },
  noticesReady: () => {
    ipcRenderer.send('ryu:noticesReady')
  },
  noticeClicked: (payload: { id: string; agent: RyuAgent }) => {
    ipcRenderer.send('ryu:noticeClicked', payload)
  },
  onNoticeClicked: (handler: (payload: { id: string; agent: RyuAgent }) => void) => {
    const listener = (
      _: Electron.IpcRendererEvent,
      payload: { id: string; agent: RyuAgent }
    ) => handler(payload)
    ipcRenderer.on('ryu:noticeClicked', listener)
    return () => {
      ipcRenderer.removeListener('ryu:noticeClicked', listener)
    }
  },
  isDev: () =>
    process.env.NODE_ENV === 'development' || Boolean(process.env.ELECTRON_RENDERER_URL),
  platform: process.platform as 'darwin' | 'win32' | 'linux',
  isNoticeSurface: () => new URLSearchParams(location.search).get('surface') === 'notices',
  isDemoSurface: () => new URLSearchParams(location.search).get('surface') === 'demo',
  sendPrompt: (payload: {
    agent: RyuAgent
    text: string
    cwd?: string
  }): Promise<SendPromptResult> => {
    return ipcRenderer.invoke('ryu:sendPrompt', payload)
  }
})
