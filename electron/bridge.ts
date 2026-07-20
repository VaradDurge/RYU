import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { BrowserWindow } from 'electron'
import type {
  AgentActivityEvent,
  AgentActivityKind,
  AgentStatusUpdate,
  BridgeDecisionResponse,
  RyuAgent,
  RyuDecision,
  RyuEvent
} from '../shared/types'

const DEFAULT_PORT = 41999
const DECISION_TIMEOUT_MS = 5 * 60 * 1000
const ACTIVITY_MAX = 80

interface Pending {
  event: RyuEvent
  res: ServerResponse
  timer: NodeJS.Timeout
}

const ACTIVITY_KINDS: AgentActivityKind[] = [
  'prompt',
  'message',
  'tool',
  'shell',
  'edit',
  'status',
  'error',
  'permission'
]

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
  /** Live activity ring buffer per agent (hook stream) */
  private activity: Record<RyuAgent, AgentActivityEvent[]> = {
    cursor: [],
    claude: [],
    codex: []
  }
  /** Last workspace path seen on /status or /event */
  lastWorkspace: string | null = null

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

  /** Push a status update to the island (used by prompt spawn, etc.) */
  publishStatus(update: AgentStatusUpdate): void {
    this.agentStatus[update.agent] = update.status
    this.win?.webContents.send('ryu:agentStatus', update)
    // Mirror meaningful work lines into the live activity feed (skip idle / quiet)
    if (
      !update.quiet &&
      update.detail?.trim() &&
      (update.status === 'running' ||
        update.status === 'approval' ||
        update.status === 'error')
    ) {
      const kind: AgentActivityKind =
        update.status === 'error'
          ? 'error'
          : update.status === 'approval'
            ? 'permission'
            : 'status'
      this.publishActivity({
        id: `${update.agent}-status-${Date.now()}`,
        agent: update.agent,
        kind,
        title: update.detail.trim(),
        ts: Date.now(),
        path: update.path
      })
    }
  }

  getActivity(agent: RyuAgent): AgentActivityEvent[] {
    return this.activity[agent] ?? []
  }

  publishActivity(event: AgentActivityEvent): void {
    const list = this.activity[event.agent] ?? []
    const last = list[list.length - 1]
    // Dedupe identical consecutive titles
    if (
      last &&
      last.title === event.title &&
      last.kind === event.kind &&
      (last.detail || '') === (event.detail || '')
    ) {
      return
    }
    const next = [...list, event].slice(-ACTIVITY_MAX)
    this.activity[event.agent] = next
    this.win?.webContents.send('ryu:agentActivity', event)
  }

  private writePortFile(port: number): void {
    const dir = join(homedir(), '.ryu')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'port'), String(port), 'utf8')
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

    if (req.method === 'GET' && req.url?.startsWith('/activity')) {
      const u = new URL(req.url, 'http://127.0.0.1')
      const agent = u.searchParams.get('agent') as RyuAgent | null
      const agents: RyuAgent[] = ['claude', 'codex', 'cursor']
      if (agent && agents.includes(agent)) {
        this.json(res, 200, { agent, events: this.getActivity(agent) })
        return
      }
      this.json(res, 200, { activity: this.activity })
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
        this.pending.delete(event.id)
        this.respondFailOpen(item.res)
      }, DECISION_TIMEOUT_MS)

      this.pending.set(event.id, { event, res, timer })
      if (event.path) this.lastWorkspace = event.path
      this.win?.webContents.send('ryu:event', event)
      this.publishStatus({
        agent: event.agent,
        status: 'approval',
        detail: event.preview,
        session: 'open',
        path: event.path
      })
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

    if (req.method === 'POST' && req.url === '/activity') {
      const body = await this.readBody(req)
      let event: AgentActivityEvent
      try {
        event = JSON.parse(body) as AgentActivityEvent
      } catch {
        this.json(res, 400, { error: 'invalid json' })
        return
      }
      const agents: RyuAgent[] = ['claude', 'codex', 'cursor']
      if (
        !agents.includes(event.agent) ||
        !event.title ||
        !ACTIVITY_KINDS.includes(event.kind)
      ) {
        this.json(res, 400, { error: 'invalid activity' })
        return
      }
      if (typeof event.path === 'string' && event.path.trim()) {
        this.lastWorkspace = event.path.trim()
      }
      this.publishActivity({
        ...event,
        id: event.id || `${event.agent}-${Date.now()}`,
        ts: event.ts || Date.now()
      })
      this.json(res, 200, { ok: true })
      return
    }

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
      const sessions = ['open', 'closed'] as const
      if (!agents.includes(update.agent) || !statuses.includes(update.status as (typeof statuses)[number])) {
        this.json(res, 400, { error: 'invalid agent or status' })
        return
      }
      if (
        update.session != null &&
        !sessions.includes(update.session as (typeof sessions)[number])
      ) {
        this.json(res, 400, { error: 'invalid session' })
        return
      }
      if (typeof update.path === 'string' && update.path.trim()) {
        this.lastWorkspace = update.path.trim()
      }
      this.publishStatus(update)
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
