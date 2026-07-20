/**
 * Shared RYU bridge HTTP core — used by Electron and headless verifies.
 * Single source of truth for pending/status/auth/snapshot/pairing.
 */

import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  applyStatusUpdate,
  boundDetail,
  initialStatusState,
  LIVE_STATUSES
} from './status-reducer.mjs'

export const DEFAULT_PORT = 41999
export const DECISION_TIMEOUT_MS = 5 * 60 * 1000
export const AGENT_STATUS_WATCHDOG_MS = 45_000
export const MAX_BODY_BYTES = 64 * 1024
export const MAX_EVENT_DETAIL_BYTES = 2048
export const PAIR_WINDOW_MS = 30_000
export const AGENTS = ['claude', 'codex', 'cursor']
export const STATUSES = [...LIVE_STATUSES]
export const HOOK_KINDS = ['PreToolUse', 'PermissionRequest']

function watchdogMs() {
  const n = Number(process.env.RYU_WATCHDOG_MS)
  if (Number.isFinite(n) && n > 0) return n
  return AGENT_STATUS_WATCHDOG_MS
}

function isLoopbackHost(host) {
  const h = String(host || '').trim().toLowerCase()
  return h === '127.0.0.1' || h === 'localhost' || h === '::1'
}

export function validateEvent(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid event' }
  if (typeof raw.id !== 'string' || !raw.id.trim()) return { ok: false, error: 'missing id' }
  if (typeof raw.preview !== 'string' || !raw.preview.trim()) return { ok: false, error: 'missing preview' }
  if (!AGENTS.includes(raw.agent)) return { ok: false, error: 'invalid agent' }
  if (typeof raw.sessionLabel !== 'string') return { ok: false, error: 'missing sessionLabel' }
  if (typeof raw.tool !== 'string') return { ok: false, error: 'missing tool' }
  if (typeof raw.ts !== 'number' || !Number.isFinite(raw.ts)) return { ok: false, error: 'missing ts' }
  if (raw.pairKey != null && typeof raw.pairKey !== 'string') return { ok: false, error: 'invalid pairKey' }
  if (raw.hookKind != null && !HOOK_KINDS.includes(raw.hookKind)) {
    return { ok: false, error: 'invalid hookKind' }
  }
  if (raw.risk != null && raw.risk !== 'normal' && raw.risk !== 'destructive') {
    return { ok: false, error: 'invalid risk' }
  }
  const event = {
    id: raw.id.trim(),
    agent: raw.agent,
    sessionLabel: raw.sessionLabel,
    tool: raw.tool,
    preview: raw.preview,
    path: typeof raw.path === 'string' ? raw.path : undefined,
    risk: raw.risk === 'destructive' ? 'destructive' : 'normal',
    ts: raw.ts,
    pairKey: typeof raw.pairKey === 'string' && raw.pairKey ? raw.pairKey : undefined,
    hookKind: HOOK_KINDS.includes(raw.hookKind) ? raw.hookKind : undefined
  }
  if (raw.detail != null) {
    const bound = boundDetail(raw.detail, MAX_EVENT_DETAIL_BYTES)
    if (bound.text != null) {
      event.detail = bound.text
      event.detailTruncated = bound.truncated || Boolean(raw.detailTruncated)
    }
  } else if (raw.detailTruncated) {
    event.detailTruncated = true
  }
  return { ok: true, event }
}

export function validateDecision(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid decision' }
  if (typeof raw.id !== 'string' || !raw.id.trim()) return { ok: false, error: 'missing id' }
  if (raw.decision !== 'allow' && raw.decision !== 'deny') return { ok: false, error: 'invalid decision' }
  return {
    ok: true,
    decision: {
      id: raw.id.trim(),
      decision: raw.decision,
      reason: typeof raw.reason === 'string' ? raw.reason : undefined
    }
  }
}

/**
 * Pure pairing helper for tests + bridge.
 * Coalesce only when pairKey matches and hookKinds are complementary.
 */
export function shouldPairWith(existing, incoming) {
  if (!existing?.pairKey || !incoming?.pairKey) return false
  if (existing.pairKey !== incoming.pairKey) return false
  if (!incoming.hookKind || !existing.hookKinds) return false
  if (existing.hookKinds.has(incoming.hookKind)) return false
  // only PreToolUse ↔ PermissionRequest
  const kinds = new Set([...existing.hookKinds, incoming.hookKind])
  if (kinds.size !== 2) return false
  return kinds.has('PreToolUse') && kinds.has('PermissionRequest')
}

/**
 * Interactive hit bounds for the dock/card — never the full work area.
 * Modes: idle | attention | dock | expanded | resolved | unavailable
 */
export function computeInteractiveBounds(workArea, mode = 'idle') {
  const m = mode || 'idle'
  let width = 360
  let height = 56
  if (m === 'dock' || m === 'attention') {
    width = 360
    height = 96
  } else if (m === 'expanded') {
    width = 440
    height = 420
  } else if (m === 'resolved') {
    width = 360
    height = 120
  } else if (m === 'unavailable') {
    width = 360
    height = 140
  } else {
    // idle
    width = 360
    height = 56
  }
  const x = Math.round(workArea.x + (workArea.width - width) / 2)
  const y = workArea.y
  // Guard: never claim the full display as the interactive surface.
  if (width >= workArea.width && height >= workArea.height) {
    throw new Error('interactive bounds must not cover the full work area')
  }
  return { x, y, width, height, mode: m }
}

function resolveHomeDir(options = {}) {
  if (typeof options.homeDir === 'string' && options.homeDir.trim()) return options.homeDir.trim()
  if (typeof process.env.RYU_HOME === 'string' && process.env.RYU_HOME.trim()) {
    return process.env.RYU_HOME.trim()
  }
  return homedir()
}

export class RyuBridgeCore {
  constructor(options = {}) {
    this.port = options.port || Number(process.env.RYU_PORT) || DEFAULT_PORT
    this.token = options.token || randomBytes(24).toString('hex')
    this.requireAuth = options.requireAuth !== false
    this.headless = Boolean(options.headless)
    this.homeDir = resolveHomeDir(options)
    this.onEvent = options.onEvent || null
    this.onCancel = options.onCancel || null
    this.onAgentStatus = options.onAgentStatus || null
    this.pending = new Map()
    this.pairIndex = new Map() // pairKey -> visibleId
    this.statusState = initialStatusState()
    this.statusWatchdogs = new Map()
    this.revision = 0
    this.startedAt = null
    this.startError = null
    this.server = null
  }

  /** Flat status map (backward-compatible with Track A/B / Phase 1). */
  get agentStatus() {
    return { ...this.statusState.statuses }
  }

  bump() {
    this.revision += 1
    return this.revision
  }

  pendingAgentsSet() {
    const set = new Set()
    for (const { event } of this.pending.values()) set.add(event.agent)
    return set
  }

  agentMetaMap() {
    const meta = {}
    for (const agent of AGENTS) {
      meta[agent] = {
        revision: this.statusState.revisions[agent] || 0,
        lastSeenAt: this.statusState.receivedAt[agent] || 0,
        detail: this.statusState.details[agent],
        source: 'bridge',
        integration: this.statusState.integration[agent] || 'unknown'
      }
    }
    return meta
  }

  healthSnapshot() {
    if (!this.server) {
      return {
        bridge: 'unavailable',
        port: this.port,
        reason: this.startError || 'not_started',
        startedAt: this.startedAt,
        auth: this.requireAuth
      }
    }
    return {
      bridge: 'started',
      port: this.port,
      reason: null,
      startedAt: this.startedAt,
      auth: this.requireAuth
    }
  }

  getSnapshot() {
    const events = [...this.pending.values()].map((p) => p.event)
    return {
      revision: this.revision,
      events,
      ids: events.map((e) => e.id),
      agents: this.agentStatus,
      agentMeta: this.agentMetaMap(),
      health: this.healthSnapshot()
    }
  }

  /**
   * Apply a status update with bridge-assigned revision.
   * Late idle cannot clear approval/stale while a pending permission exists for that agent.
   */
  applyAgentStatus(agent, status, detail) {
    if (!AGENTS.includes(agent) || !STATUSES.includes(status)) {
      return { ok: false, reason: 'invalid' }
    }
    const revision = this.bump()
    const receivedAt = Date.now()
    const pendingAgents = this.pendingAgentsSet()
    const next = applyStatusUpdate(
      this.statusState,
      { agent, status, revision, receivedAt, detail },
      { pendingAgents }
    )
    if (next === this.statusState) {
      // Ignored (e.g. late idle over pending approval) — still bump consumed; report current.
      return {
        ok: true,
        ignored: true,
        agents: this.agentStatus,
        revision: this.revision,
        agentMeta: this.agentMetaMap()
      }
    }
    this.statusState = next
    if (status === 'running' || status === 'approval') {
      this.armStatusWatchdog(agent)
    } else {
      this.clearStatusWatchdog(agent)
    }
    const update = {
      agent,
      status: this.statusState.statuses[agent],
      detail: detail || undefined,
      revision: this.statusState.revisions[agent],
      receivedAt: this.statusState.receivedAt[agent]
    }
    this.onAgentStatus?.(update)
    return {
      ok: true,
      ignored: false,
      agents: this.agentStatus,
      revision: this.revision,
      agentMeta: this.agentMetaMap()
    }
  }

  getToken() {
    return this.token
  }

  writeConfigFiles() {
    const dir = join(this.homeDir, '.ryu')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'port'), String(this.port), 'utf8')
    writeFileSync(join(dir, 'host'), '127.0.0.1', 'utf8')
    writeFileSync(join(dir, 'token'), this.token, 'utf8')
  }

  async start() {
    this.startError = null
    this.server = createServer((req, res) => {
      void this.handle(req, res)
    })
    try {
      await new Promise((resolve, reject) => {
        this.server.once('error', reject)
        this.server.listen(this.port, '127.0.0.1', () => resolve())
      })
    } catch (err) {
      this.startError = err?.code || err?.message || 'start_failed'
      this.server = null
      throw err
    }
    this.startedAt = Date.now()
    this.statusState = {
      ...this.statusState,
      health: {
        bridge: 'started',
        port: this.port,
        reason: null,
        startedAt: this.startedAt
      }
    }
    this.writeConfigFiles()
    return this.port
  }

  stop() {
    for (const [, pending] of this.pending) {
      for (const waiter of pending.waiters) {
        clearTimeout(waiter.timer)
        this.respondFailOpen(waiter.res)
      }
    }
    this.pending.clear()
    this.pairIndex.clear()
    for (const t of this.statusWatchdogs.values()) clearTimeout(t)
    this.statusWatchdogs.clear()
    if (this.server) {
      this.server.close()
      this.server = null
    }
    this.statusState = {
      ...this.statusState,
      health: {
        bridge: 'unavailable',
        port: this.port,
        reason: 'stopped',
        startedAt: this.startedAt
      }
    }
  }

  resolveDecision(decision) {
    const parsed = validateDecision(decision)
    if (!parsed.ok) return { ok: false, reason: 'invalid' }
    const item = this.pending.get(parsed.decision.id)
    if (!item) return { ok: false, reason: 'unknown' }

    const payload = { status: parsed.decision.decision, decision: parsed.decision }
    for (const waiter of item.waiters) {
      clearTimeout(waiter.timer)
      this.json(waiter.res, 200, payload)
    }
    this.removePending(parsed.decision.id)
    this.bump()
    return { ok: true }
  }

  dismiss(id) {
    if (typeof id !== 'string' || !id.trim()) return { ok: false, reason: 'invalid' }
    const item = this.pending.get(id.trim())
    if (!item) return { ok: false, reason: 'unknown' }
    for (const waiter of item.waiters) {
      clearTimeout(waiter.timer)
      this.json(waiter.res, 200, { status: 'cancelled' })
    }
    this.removePending(id.trim())
    this.bump()
    this.onCancel?.(id.trim())
    return { ok: true }
  }

  removePending(id) {
    const item = this.pending.get(id)
    if (!item) return
    if (item.event.pairKey) this.pairIndex.delete(item.event.pairKey)
    this.pending.delete(id)
  }

  authOk(req) {
    if (!this.requireAuth) return true
    const header = req.headers['x-ryu-token'] || req.headers['authorization'] || ''
    const token =
      typeof header === 'string' && header.toLowerCase().startsWith('bearer ')
        ? header.slice(7).trim()
        : String(header).trim()
    return Boolean(token) && token === this.token
  }

  json(res, code, payload) {
    if (res.writableEnded) return
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload))
  }

  respondFailOpen(res) {
    this.json(res, 200, { status: 'timeout' })
  }

  readBody(req) {
    return new Promise((resolve) => {
      const chunks = []
      let size = 0
      let limited = false
      req.on('data', (c) => {
        size += c.length
        if (size > MAX_BODY_BYTES) {
          limited = true
          chunks.length = 0
          req.resume()
          return
        }
        chunks.push(Buffer.from(c))
      })
      req.on('end', () => {
        if (limited) {
          resolve({ error: 'too_large' })
          return
        }
        resolve({ body: Buffer.concat(chunks).toString('utf8') })
      })
      req.on('error', () => {
        resolve({ error: limited ? 'too_large' : 'read_error' })
      })
    })
  }

  clearStatusWatchdog(agent) {
    const t = this.statusWatchdogs.get(agent)
    if (t) {
      clearTimeout(t)
      this.statusWatchdogs.delete(agent)
    }
  }

  armStatusWatchdog(agent) {
    this.clearStatusWatchdog(agent)
    const ms = watchdogMs()
    this.statusWatchdogs.set(
      agent,
      setTimeout(() => {
        this.statusWatchdogs.delete(agent)
        const current = this.statusState.statuses[agent]
        if (current !== 'running' && current !== 'approval') return
        // Honest liveness: expire to stale, never false idle (P2.3).
        this.applyAgentStatus(agent, 'stale', `${agent} · Status stale`)
      }, ms)
    )
  }

  dropWaiter(id, res) {
    const item = this.pending.get(id)
    if (!item) return
    item.waiters = item.waiters.filter((w) => {
      if (w.res === res) clearTimeout(w.timer)
      return w.res !== res
    })
    if (item.waiters.length === 0) {
      this.removePending(id)
      this.bump()
      this.onCancel?.(id)
    }
  }

  findPairTarget(event) {
    if (!event.pairKey || !event.hookKind) return null
    const visibleId = this.pairIndex.get(event.pairKey)
    if (!visibleId) return null
    const existing = this.pending.get(visibleId)
    if (!existing) {
      this.pairIndex.delete(event.pairKey)
      return null
    }
    if (Date.now() - existing.createdAt > PAIR_WINDOW_MS) return null
    if (
      shouldPairWith(
        { pairKey: existing.event.pairKey, hookKinds: existing.hookKinds },
        event
      )
    ) {
      return existing
    }
    return null
  }

  async handle(req, res) {
    const url = req.url || ''
    const path = url.split('?')[0]

    if (req.method === 'GET' && path === '/health') {
      const health = this.healthSnapshot()
      this.json(res, 200, {
        ok: health.bridge === 'started',
        port: this.port,
        headless: this.headless,
        auth: this.requireAuth,
        bridge: health.bridge,
        reason: health.reason,
        startedAt: health.startedAt
      })
      return
    }

    const needsAuth = !(req.method === 'GET' && path === '/health')
    if (needsAuth && !this.authOk(req)) {
      this.json(res, 401, { error: 'unauthorized' })
      return
    }

    if (req.method === 'GET' && path === '/pending') {
      const snap = this.getSnapshot()
      this.json(res, 200, { ids: snap.ids, events: snap.events, revision: snap.revision })
      return
    }

    if (req.method === 'GET' && path === '/agents') {
      this.json(res, 200, {
        agents: this.agentStatus,
        revision: this.revision,
        agentMeta: this.agentMetaMap(),
        health: this.healthSnapshot()
      })
      return
    }

    if (req.method === 'GET' && path === '/snapshot') {
      this.json(res, 200, this.getSnapshot())
      return
    }

    if (req.method === 'POST' && path === '/event') {
      const read = await this.readBody(req)
      if (read.error === 'too_large') {
        this.json(res, 413, { error: 'body too large' })
        return
      }
      let raw
      try {
        raw = JSON.parse(read.body || '')
      } catch {
        this.json(res, 400, { error: 'invalid json' })
        return
      }
      const parsed = validateEvent(raw)
      if (!parsed.ok) {
        this.json(res, 400, { error: parsed.error })
        return
      }
      const event = parsed.event
      const visibleIdRef = { id: event.id }

      const timer = setTimeout(() => {
        const id = visibleIdRef.id
        const item = this.pending.get(id)
        if (!item) return
        const mine = item.waiters.filter((w) => w.timer === timer)
        if (!mine.length) return
        for (const waiter of mine) {
          clearTimeout(waiter.timer)
          this.respondFailOpen(waiter.res)
        }
        item.waiters = item.waiters.filter((w) => w.timer !== timer)
        if (item.waiters.length === 0) {
          this.removePending(id)
          this.bump()
          this.onCancel?.(id)
        }
      }, DECISION_TIMEOUT_MS)

      const pairTarget = this.findPairTarget(event)
      if (pairTarget) {
        visibleIdRef.id = pairTarget.event.id
        pairTarget.waiters.push({ res, timer })
        pairTarget.hookKinds.add(event.hookKind)
        req.on('close', () => this.dropWaiter(pairTarget.event.id, res))
        return
      }

      // Same exact id reuse (rare) — add waiter
      const existing = this.pending.get(event.id)
      if (existing) {
        existing.waiters.push({ res, timer })
        if (event.hookKind) existing.hookKinds.add(event.hookKind)
        req.on('close', () => this.dropWaiter(event.id, res))
        return
      }

      const pending = {
        event,
        waiters: [{ res, timer }],
        hookKinds: new Set(event.hookKind ? [event.hookKind] : []),
        createdAt: Date.now()
      }
      this.pending.set(event.id, pending)
      if (event.pairKey) this.pairIndex.set(event.pairKey, event.id)
      this.bump()
      req.on('close', () => this.dropWaiter(event.id, res))
      this.onEvent?.(event)
      return
    }

    if (req.method === 'POST' && path === '/decision') {
      const read = await this.readBody(req)
      if (read.error === 'too_large') {
        this.json(res, 413, { error: 'body too large' })
        return
      }
      let raw
      try {
        raw = JSON.parse(read.body || '')
      } catch {
        this.json(res, 400, { error: 'invalid json' })
        return
      }
      const result = this.resolveDecision(raw)
      this.json(res, result.ok ? 200 : result.reason === 'invalid' ? 400 : 404, result)
      return
    }

    if (req.method === 'POST' && path === '/dismiss') {
      const read = await this.readBody(req)
      if (read.error === 'too_large') {
        this.json(res, 413, { error: 'body too large' })
        return
      }
      let raw
      try {
        raw = JSON.parse(read.body || '')
      } catch {
        this.json(res, 400, { error: 'invalid json' })
        return
      }
      const result = this.dismiss(raw?.id)
      this.json(res, result.ok ? 200 : result.reason === 'invalid' ? 400 : 404, result)
      return
    }

    if (req.method === 'POST' && path === '/status') {
      const read = await this.readBody(req)
      if (read.error === 'too_large') {
        this.json(res, 413, { error: 'body too large' })
        return
      }
      let update
      try {
        update = JSON.parse(read.body || '')
      } catch {
        this.json(res, 400, { error: 'invalid json' })
        return
      }
      if (!AGENTS.includes(update?.agent) || !STATUSES.includes(update?.status)) {
        this.json(res, 400, { error: 'invalid agent or status' })
        return
      }
      const detail = typeof update.detail === 'string' ? update.detail : undefined
      const result = this.applyAgentStatus(update.agent, update.status, detail)
      this.json(res, 200, result)
      return
    }

    this.json(res, 404, { error: 'not found' })
  }
}

export { isLoopbackHost }
