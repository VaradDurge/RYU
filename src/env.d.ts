import type { AgentActivityEvent, AgentStatusUpdate, RyuAgent, RyuDecision, RyuEvent } from '../shared/types'

export {}

type NoticePayload = {
  id: string
  agent: RyuAgent
  kind: 'idle' | 'running' | 'permission' | 'failed'
  ts: number
}

type SendPromptResult = { ok: boolean; error?: string }

declare global {
  interface Window {
    ryu: {
      setInteractive: (interactive: boolean) => void
      setIslandSize?: (size: { width: number; height: number }) => void
      onIslandHover?: (handler: (inside: boolean) => void) => () => void
      decide: (decision: RyuDecision) => void
      onEvent: (handler: (event: RyuEvent) => void) => () => void
      onAgentStatus: (handler: (update: AgentStatusUpdate) => void) => () => void
      onAgentActivity?: (handler: (event: AgentActivityEvent) => void) => () => void
      getAgentActivity?: (payload: {
        agent: RyuAgent
        workspace?: string | null
      }) => Promise<AgentActivityEvent[]>
      setNotices?: (notices: NoticePayload[]) => void
      onNotices?: (handler: (notices: NoticePayload[]) => void) => () => void
      noticesReady?: () => void
      noticeClicked?: (payload: { id: string; agent: RyuAgent }) => void
      onNoticeClicked?: (
        handler: (payload: { id: string; agent: RyuAgent }) => void
      ) => () => void
      sendPrompt?: (payload: {
        agent: RyuAgent
        text: string
        cwd?: string
      }) => Promise<SendPromptResult>
      isDev: () => boolean
      platform: 'darwin' | 'win32' | 'linux'
      isNoticeSurface?: () => boolean
      isDemoSurface?: () => boolean
    }
  }
}
