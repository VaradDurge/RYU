import type { AgentStatusUpdate, RyuAgent, RyuDecision, RyuEvent } from '../shared/types'

export {}

type NoticePayload = {
  id: string
  agent: RyuAgent
  kind: 'finished' | 'failed'
  ts: number
}

declare global {
  interface Window {
    ryu: {
      setInteractive: (interactive: boolean) => void
      setIslandSize?: (size: { width: number; height: number }) => void
      decide: (decision: RyuDecision) => void
      onEvent: (handler: (event: RyuEvent) => void) => () => void
      onAgentStatus: (handler: (update: AgentStatusUpdate) => void) => () => void
      setNotices?: (notices: NoticePayload[]) => void
      onNotices?: (handler: (notices: NoticePayload[]) => void) => () => void
      noticesReady?: () => void
      noticeClicked?: (payload: { id: string; agent: RyuAgent }) => void
      onNoticeClicked?: (
        handler: (payload: { id: string; agent: RyuAgent }) => void
      ) => () => void
      isDev: () => boolean
      platform: 'darwin' | 'win32' | 'linux'
      isNoticeSurface?: () => boolean
    }
  }
}
