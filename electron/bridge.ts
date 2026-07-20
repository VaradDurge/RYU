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
  private startError: string | null = null

  attachWindow(win: BrowserWindow): void {
    this.win = win
  }

  async start(preferredPort = DEFAULT_PORT): Promise<number> {
    this.startError = null
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
    try {
      return await this.core.start()
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code
      this.startError = code || (err as Error)?.message || 'start_failed'
      this.core = null
      throw err
    }
  }

  stop(): void {
    this.core?.stop()
    this.core = null
  }

  getSnapshot() {
    if (this.core) return this.core.getSnapshot()
    return {
      revision: 0,
      events: [] as RyuEvent[],
      ids: [] as string[],
      agents: { cursor: 'idle' as const, claude: 'idle' as const, codex: 'idle' as const },
      agentMeta: {
        cursor: { revision: 0, lastSeenAt: 0, integration: 'unknown' as const },
        claude: { revision: 0, lastSeenAt: 0, integration: 'unknown' as const },
        codex: { revision: 0, lastSeenAt: 0, integration: 'unknown' as const }
      },
      health: {
        bridge: 'unavailable' as const,
        port: DEFAULT_PORT,
        reason: this.startError || 'not_started',
        startedAt: null
      }
    }
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
