import type { BrowserWindow } from 'electron'
import { RyuBridgeCore, DEFAULT_PORT, computeInteractiveBounds } from '../shared/bridge-core.mjs'
import type {
  AgentStatusUpdate,
  BridgeDiagnostics,
  BridgeLifecycle,
  RyuDecision,
  RyuEvent
} from '../shared/types'

export { DEFAULT_PORT, computeInteractiveBounds }

const RETRY_COOLDOWN_MS = 1500

/**
 * Electron wrapper around shared bridge core.
 * UI notifications go through BrowserWindow IPC.
 * Lifecycle: stopped → starting → started | unavailable → stopped
 */
export class RyuBridge {
  private core: RyuBridgeCore | null = null
  private win: BrowserWindow | null = null
  private startError: string | null = null
  private lifecycle: BridgeLifecycle = 'stopped'
  private preferredPort = DEFAULT_PORT
  private startedAt: number | null = null
  private retrying = false
  private lastRetryAt: number | null = null
  private interactive: boolean | null = null
  private lastInteractiveBounds: BridgeDiagnostics['lastInteractiveBounds'] = null
  private readonly smoke = process.env.RYU_SMOKE === '1'

  attachWindow(win: BrowserWindow): void {
    this.win = win
  }

  async start(preferredPort = Number(process.env.RYU_PORT) || DEFAULT_PORT): Promise<number> {
    this.preferredPort = preferredPort
    this.startError = null
    this.lifecycle = 'starting'
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
      const port = await this.core.start()
      this.lifecycle = 'started'
      this.startedAt = Date.now()
      this.startError = null
      this.notifyHealth()
      return port
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code
      this.startError = code || (err as Error)?.message || 'start_failed'
      this.lifecycle = 'unavailable'
      this.core = null
      this.notifyHealth()
      throw err
    }
  }

  /**
   * Retry binding the same configured loopback port only.
   * Rate-limited; never falls back to a random port.
   */
  async retryStart(): Promise<{ ok: boolean; reason?: string; port?: number }> {
    if (this.retrying) return { ok: false, reason: 'retry_in_progress' }
    if (this.lifecycle === 'started' && this.core) {
      return { ok: true, port: this.preferredPort }
    }
    const now = Date.now()
    if (this.lastRetryAt && now - this.lastRetryAt < RETRY_COOLDOWN_MS) {
      return { ok: false, reason: 'retry_cooldown' }
    }
    this.retrying = true
    this.lastRetryAt = now
    this.notifyHealth()
    try {
      this.core?.stop()
      this.core = null
      const port = await this.start(this.preferredPort)
      return { ok: true, port }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code
      return { ok: false, reason: code || (err as Error)?.message || 'start_failed' }
    } finally {
      this.retrying = false
      this.notifyHealth()
    }
  }

  stop(): void {
    this.core?.stop()
    this.core = null
    this.lifecycle = 'stopped'
    this.notifyHealth()
  }

  setInteractiveState(
    interactive: boolean,
    bounds: BridgeDiagnostics['lastInteractiveBounds'] = null
  ): void {
    this.interactive = interactive
    if (bounds) this.lastInteractiveBounds = bounds
    if (this.smoke || process.env.NODE_ENV === 'development') {
      const b = bounds
        ? `${b.mode}:${b.width}x${b.height}@${b.x},${b.y}`
        : 'none'
      console.log(`[ryu:diag] interactive=${interactive} bounds=${b}`)
    }
  }

  getSnapshot() {
    if (this.core) {
      const snap = this.core.getSnapshot()
      return {
        ...snap,
        health: {
          ...snap.health,
          bridge: 'started' as const,
          lifecycle: this.lifecycle,
          retrying: this.retrying,
          lastRetryAt: this.lastRetryAt
        }
      }
    }
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
        port: this.preferredPort,
        reason: this.startError || 'not_started',
        startedAt: this.startedAt,
        lifecycle: this.lifecycle === 'stopped' ? ('unavailable' as const) : this.lifecycle,
        retrying: this.retrying,
        lastRetryAt: this.lastRetryAt
      }
    }
  }

  /** Read-only diagnostics — never includes the token. */
  getDiagnostics(): BridgeDiagnostics {
    const snap = this.getSnapshot()
    return {
      core: 'shared/bridge-core',
      lifecycle: this.lifecycle,
      port: this.preferredPort,
      boundPort: this.lifecycle === 'started' ? this.preferredPort : null,
      revision: snap.revision,
      reason: snap.health?.reason ?? this.startError,
      startedAt: this.startedAt,
      retrying: this.retrying,
      lastRetryAt: this.lastRetryAt,
      interactive: this.interactive,
      lastInteractiveBounds: this.lastInteractiveBounds,
      smoke: this.smoke
    }
  }

  getToken(): string {
    return this.core?.getToken() || ''
  }

  usesSharedCore(): boolean {
    return true
  }

  resolveDecision(decision: RyuDecision): { ok: boolean; reason?: string } {
    if (!this.core) return { ok: false, reason: 'unavailable' }
    return this.core.resolveDecision(decision)
  }

  dismiss(id: string): { ok: boolean; reason?: string } {
    if (!this.core) return { ok: false, reason: 'unavailable' }
    return this.core.dismiss(id)
  }

  private notifyHealth(): void {
    try {
      this.win?.webContents.send('ryu:health', this.getSnapshot().health)
    } catch {
      // window may be gone
    }
  }
}
