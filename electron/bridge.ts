import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { BrowserWindow } from 'electron'
import type {
  AgentStatusUpdate,
  BridgeDecisionResponse,
  RyuAgent,
  RyuDecision,
  RyuEvent
} from '../shared/types'

const DEFAULT_PORT = 41999
const DECISION_TIMEOUT_MS = 5 * 60 * 1000

interface Pending {
  event: RyuEvent
  res: ServerResponse
  timer: NodeJS.Timeout
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
  private onStatus?: (update: AgentStatusUpdate) => void

  attachWindow(win: BrowserWindow): void {
    this.win = win
  }

  /** Main process hook — drive notch dots from the same /status stream */
  setStatusListener(listener: (update: AgentStatusUpdate) => void): void {
    this.onStatus = listener
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

    this.writePortFile(this.port)
    return this.port
  }

  stop(): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer)
      this.respondFailOpen(p.res)
    }
    this.pending.clear()
    this.server?.close()
    this.server = null
  }

  resolveDecision(decision: RyuDecision): boolean {
    const item = this.pending.get(decision.id)
    if (!item) return false
    clearTimeout(item.timer)
    this.pending.delete(decision.id)
    this.json(item.res, 200, {
      status: decision.decision,
      decision
    } satisfies BridgeDecisionResponse)
    return true
  }

  private writePortFile(port: number): void {
    const dir = join(homedir(), '.ryu')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'port'), String(port), 'utf8')
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS not needed (localhost hook only); keep responses simple
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

      // Long-poll until decision or timeout
      const timer = setTimeout(() => {
        const item = this.pending.get(event.id)
        if (!item) return
        this.pending.delete(event.id)
        this.respondFailOpen(item.res)
      }, DECISION_TIMEOUT_MS)

      this.pending.set(event.id, { event, res, timer })
      this.win?.webContents.send('ryu:event', event)
      // Permission event also lights the yellow notch dot for that agent
      const approval: AgentStatusUpdate = {
        agent: event.agent,
        status: 'approval',
        detail: event.preview
      }
      this.agentStatus[event.agent] = 'approval'
      this.win?.webContents.send('ryu:agentStatus', approval)
      this.onStatus?.(approval)
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
      this.win?.webContents.send('ryu:agentStatus', update)
      this.onStatus?.(update)
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
