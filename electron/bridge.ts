import type { BrowserWindow } from 'electron'
import { RyuBridgeCore, DEFAULT_PORT, computeInteractiveBounds } from '../shared/bridge-core.mjs'
import type { AgentStatusUpdate, RyuDecision, RyuEvent } from '../shared/types'

export { DEFAULT_PORT, computeInteractiveBounds }

/**
 * Electron wrapper around shared bridge core.
 * UI notifications go through BrowserWindow IPC.
 */
export class RyuBridge {
  private core: RyuBridgeCore | null = null
  private win: BrowserWindow | null = null

  attachWindow(win: BrowserWindow): void {
    this.win = win
  }

  async start(preferredPort = DEFAULT_PORT): Promise<number> {
    this.core = new RyuBridgeCore({
      port: preferredPort,
      headless: false,
      requireAuth: true,
      onEvent: (event: RyuEvent) => {
        this.win?.webContents.send('ryu:event', event)
      },
      onCancel: (id: string) => {
        this.win?.webContents.send('ryu:cancel', id)
      },
      onAgentStatus: (update: AgentStatusUpdate) => {
        this.win?.webContents.send('ryu:agentStatus', update)
      }
    })
    return this.core.start()
  }

  stop(): void {
    this.core?.stop()
    this.core = null
  }

  getSnapshot() {
    return (
      this.core?.getSnapshot() || {
        revision: 0,
        events: [] as RyuEvent[],
        ids: [] as string[],
        agents: { cursor: 'idle' as const, claude: 'idle' as const, codex: 'idle' as const }
      }
    )
  }

  getToken(): string {
    return this.core?.getToken() || ''
  }

  resolveDecision(decision: RyuDecision): { ok: boolean; reason?: string } {
    if (!this.core) return { ok: false, reason: 'unavailable' }
    return this.core.resolveDecision(decision)
  }

  dismiss(id: string): { ok: boolean; reason?: string } {
    if (!this.core) return { ok: false, reason: 'unavailable' }
    return this.core.dismiss(id)
  }
}
