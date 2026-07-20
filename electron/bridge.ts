import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { BrowserWindow } from 'electron'
import {
  AGENT_STATUS_WATCHDOG_MS,
  type AgentStatusUpdate,
  type BridgeDecisionResponse,
  type RyuAgent,
  type RyuDecision,
  type RyuEvent
} from '../shared/types'

const DEFAULT_PORT = 41999
const DECISION_TIMEOUT_MS = 5 * 60 * 1000

interface Waiter {
  res: ServerResponse
  timer: NodeJS.Timeout
}

interface Pending {
  event: RyuEvent
  waiters: Waiter[]
}

function watchdogMs(): number {
  const n = Number(process.env.RYU_WATCHDOG_MS)
  if (Number.isFinite(n) && n > 0) return n
  return AGENT_STATUS_WATCHDOG_MS
}

export class RyuBridge {
  private server: Server | null = null
  private pending = new Map<string, Pending>()
  private port = DEFAULT_PORT
  private win: BrowserWindow | null = null
  /** Last-known agent ring statuses (debug / GET /agents) */
  private agentStatus: Record<RyuAgent, AgentStatusUpdate['status']> = {
    cursor: 'idle',
    claude: 'idle',
    codex: 'idle'
  }
  private statusWatchdogs = new Map<RyuAgent, NodeJS.Timeout>()

  attachWindow(win: BrowserWindow): void {
    this.win = win
  }

  async start(preferredPort = DEFAULT_PORT): Promise<number> {
    this.port = preferredPort
    this.server = createServer((req, res) => {
      void this.handle(req, res)
    })

    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(this.port, '127.0.0.1', () => resolve())
    })

    this.writeConfigFiles(this.port)
    return this.port
  }

  stop(): void {
    for (const [, pending] of this.pending) {
      for (const waiter of pending.waiters) {
        clearTimeout(waiter.timer)
        this.respondFailOpen(waiter.res)
      }
    }
    this.pending.clear()
    for (const t of this.statusWatchdogs.values()) clearTimeout(t)
    this.statusWatchdogs.clear()
    this.server?.close()
    this.server = null
  }

  resolveDecision(decision: RyuDecision): boolean {
    const item = this.pending.get(decision.id)
    if (!item) {
      console.warn(`[ryu] decision for unknown id ${decision.id}`)
      return false
    }

    const payload = {
      status: decision.decision,
      decision
    } satisfies BridgeDecisionResponse

    for (const waiter of item.waiters) {
      clearTimeout(waiter.timer)
      this.json(waiter.res, 200, payload)
    }

    this.pending.delete(decision.id)
    console.log(`[ryu] decision ${decision.decision} id=${decision.id}`)
    return true
  }

  /** Clear a stuck pending permission without allow/deny (fail-open for waiters). */
  dismiss(id: string): boolean {
    const item = this.pending.get(id)
    if (!item) {
      console.warn(`[ryu] dismiss for unknown id ${id}`)
      return false
    }

    const payload = { status: 'cancelled' as const } satisfies BridgeDecisionResponse
    for (const waiter of item.waiters) {
      clearTimeout(waiter.timer)
      this.json(waiter.res, 200, payload)
    }
    this.pending.delete(id)
    this.win?.webContents.send('ryu:cancel', id)
    console.log(`[ryu] dismiss id=${id}`)
    return true
  }

  private dropWaiter(id: string, res: ServerResponse): void {
    const item = this.pending.get(id)
    if (!item) return

    item.waiters = item.waiters.filter((waiter) => {
      if (waiter.res === res) clearTimeout(waiter.timer)
      return waiter.res !== res
    })

    if (item.waiters.length > 0) return

    this.pending.delete(id)
    this.win?.webContents.send('ryu:cancel', id)
  }

  private clearStatusWatchdog(agent: RyuAgent): void {
    const t = this.statusWatchdogs.get(agent)
    if (t) {
      clearTimeout(t)
      this.statusWatchdogs.delete(agent)
    }
  }

  private armStatusWatchdog(agent: RyuAgent): void {
    this.clearStatusWatchdog(agent)
    const ms = watchdogMs()
    this.statusWatchdogs.set(
      agent,
      setTimeout(() => {
        this.statusWatchdogs.delete(agent)
        if (this.agentStatus[agent] !== 'running' && this.agentStatus[agent] !== 'approval') return
        this.agentStatus[agent] = 'idle'
        const update: AgentStatusUpdate = { agent, status: 'idle', detail: `${agent} · Idle` }
        this.win?.webContents.send('ryu:agentStatus', update)
        console.log(`[ryu] watchdog idle agent=${agent}`)
      }, ms)
    )
  }

  private writeConfigFiles(port: number): void {
    const dir = join(homedir(), '.ryu')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'port'), String(port), 'utf8')
    writeFileSync(join(dir, 'host'), '127.0.0.1', 'utf8')
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'GET' && req.url === '/health') {
      this.json(res, 200, { ok: true, port: this.port })
      return
    }

    if (req.method === 'GET' && req.url === '/pending') {
      this.json(res, 200, {
        ids: [...this.pending.keys()],
        events: [...this.pending.values()].map((p) => p.event)
      })
      return
    }

    if (req.method === 'GET' && req.url === '/agents') {
      this.json(res, 200, { agents: this.agentStatus })
      return
    }

    if (req.method === 'POST' && req.url === '/event') {
      const body = await this.readBody(req)
      let event: RyuEvent
      try {
        event = JSON.parse(body) as RyuEvent
      } catch {
        this.json(res, 400, { error: 'invalid json' })
        return
      }

      if (!event?.id || !event.preview) {
        this.json(res, 400, { error: 'missing id or preview' })
        return
      }

      const timer = setTimeout(() => {
        const item = this.pending.get(event.id)
        if (!item) return
        for (const waiter of item.waiters) {
          clearTimeout(waiter.timer)
          this.respondFailOpen(waiter.res)
        }
        this.pending.delete(event.id)
        console.log(`[ryu] timeout fail-open id=${event.id}`)
      }, DECISION_TIMEOUT_MS)

      const existing = this.pending.get(event.id)
      if (existing) {
        existing.waiters.push({ res, timer })
        req.on('close', () => this.dropWaiter(event.id, res))
        return
      }

      this.pending.set(event.id, {
        event,
        waiters: [{ res, timer }]
      })
      req.on('close', () => this.dropWaiter(event.id, res))
      this.win?.webContents.send('ryu:event', event)
      return
    }

    if (req.method === 'POST' && req.url === '/decision') {
      const body = await this.readBody(req)
      let decision: RyuDecision
      try {
        decision = JSON.parse(body) as RyuDecision
      } catch {
        this.json(res, 400, { error: 'invalid json' })
        return
      }
      const ok = this.resolveDecision(decision)
      this.json(res, ok ? 200 : 404, { ok })
      return
    }

    if (req.method === 'POST' && req.url === '/dismiss') {
      const body = await this.readBody(req)
      let payload: { id?: string }
      try {
        payload = JSON.parse(body) as { id?: string }
      } catch {
        this.json(res, 400, { error: 'invalid json' })
        return
      }
      if (!payload?.id) {
        this.json(res, 400, { error: 'missing id' })
        return
      }
      const ok = this.dismiss(payload.id)
      this.json(res, ok ? 200 : 404, { ok })
      return
    }

    // Live agent ring status (Cursor hooks → green while working)
    if (req.method === 'POST' && req.url === '/status') {
      const body = await this.readBody(req)
      let update: AgentStatusUpdate
      try {
        update = JSON.parse(body) as AgentStatusUpdate
      } catch {
        this.json(res, 400, { error: 'invalid json' })
        return
      }
      const agents: RyuAgent[] = ['claude', 'codex', 'cursor']
      const statuses = ['idle', 'running', 'approval', 'error'] as const
      if (!agents.includes(update.agent) || !statuses.includes(update.status as (typeof statuses)[number])) {
        this.json(res, 400, { error: 'invalid agent or status' })
        return
      }
      this.agentStatus[update.agent] = update.status
      if (update.status === 'running' || update.status === 'approval') {
        this.armStatusWatchdog(update.agent)
      } else {
        this.clearStatusWatchdog(update.agent)
      }
      this.win?.webContents.send('ryu:agentStatus', update)
      this.json(res, 200, { ok: true, agents: this.agentStatus })
      return
    }

    this.json(res, 404, { error: 'not found' })
  }

  private respondFailOpen(res: ServerResponse): void {
    this.json(res, 200, { status: 'timeout' } satisfies BridgeDecisionResponse)
  }

  private json(res: ServerResponse, code: number, payload: unknown): void {
    if (res.writableEnded) return
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload))
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on('data', (c) => chunks.push(Buffer.from(c)))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
  }
}
