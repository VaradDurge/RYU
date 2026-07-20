#!/usr/bin/env node
/**
 * Headless RYU bridge — same HTTP contract as electron/bridge.ts, no Electron UI.
 * Used by verify:track-a / verify:track-b. Writes ~/.ryu/port like the real app.
 *
 * Usage: node scripts/headless-bridge.mjs [port]
 * Env: RYU_WATCHDOG_MS — override status watchdog (default 45000)
 */

import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.argv[2] || process.env.RYU_PORT || 41999)
const DECISION_TIMEOUT_MS = 5 * 60 * 1000
const DEFAULT_WATCHDOG_MS = 45_000

function watchdogMs() {
  const n = Number(process.env.RYU_WATCHDOG_MS)
  if (Number.isFinite(n) && n > 0) return n
  return DEFAULT_WATCHDOG_MS
}

const pending = new Map()
const agentStatus = { cursor: 'idle', claude: 'idle', codex: 'idle' }
const statusWatchdogs = new Map()
const AGENTS = ['claude', 'codex', 'cursor']
const STATUSES = ['idle', 'running', 'approval', 'error']

function json(res, code, payload) {
  if (res.writableEnded) return
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function respondFailOpen(res) {
  json(res, 200, { status: 'timeout' })
}

function resolveDecision(decision) {
  const item = pending.get(decision.id)
  if (!item) return false
  const payload = { status: decision.decision, decision }
  for (const waiter of item.waiters) {
    clearTimeout(waiter.timer)
    json(waiter.res, 200, payload)
  }
  pending.delete(decision.id)
  return true
}

function dismiss(id) {
  const item = pending.get(id)
  if (!item) return false
  for (const waiter of item.waiters) {
    clearTimeout(waiter.timer)
    json(waiter.res, 200, { status: 'cancelled' })
  }
  pending.delete(id)
  return true
}

function dropWaiter(id, res) {
  const item = pending.get(id)
  if (!item) return
  item.waiters = item.waiters.filter((w) => {
    if (w.res === res) clearTimeout(w.timer)
    return w.res !== res
  })
  if (item.waiters.length === 0) pending.delete(id)
}

function clearStatusWatchdog(agent) {
  const t = statusWatchdogs.get(agent)
  if (t) {
    clearTimeout(t)
    statusWatchdogs.delete(agent)
  }
}

function armStatusWatchdog(agent) {
  clearStatusWatchdog(agent)
  const ms = watchdogMs()
  statusWatchdogs.set(
    agent,
    setTimeout(() => {
      statusWatchdogs.delete(agent)
      if (agentStatus[agent] !== 'running' && agentStatus[agent] !== 'approval') return
      agentStatus[agent] = 'idle'
    }, ms)
  )
}

function writeConfig(port) {
  const dir = join(homedir(), '.ryu')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'port'), String(port), 'utf8')
  writeFileSync(join(dir, 'host'), '127.0.0.1', 'utf8')
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    json(res, 200, { ok: true, port: PORT, headless: true })
    return
  }

  if (req.method === 'GET' && req.url === '/pending') {
    json(res, 200, {
      ids: [...pending.keys()],
      events: [...pending.values()].map((p) => p.event)
    })
    return
  }

  if (req.method === 'GET' && req.url === '/agents') {
    json(res, 200, { agents: agentStatus })
    return
  }

  if (req.method === 'POST' && req.url === '/event') {
    let event
    try {
      event = JSON.parse(await readBody(req))
    } catch {
      json(res, 400, { error: 'invalid json' })
      return
    }
    if (!event?.id || !event.preview) {
      json(res, 400, { error: 'missing id or preview' })
      return
    }
    const timer = setTimeout(() => {
      const item = pending.get(event.id)
      if (!item) return
      for (const waiter of item.waiters) {
        clearTimeout(waiter.timer)
        respondFailOpen(waiter.res)
      }
      pending.delete(event.id)
    }, DECISION_TIMEOUT_MS)

    const existing = pending.get(event.id)
    if (existing) {
      existing.waiters.push({ res, timer })
      req.on('close', () => dropWaiter(event.id, res))
      return
    }
    pending.set(event.id, { event, waiters: [{ res, timer }] })
    req.on('close', () => dropWaiter(event.id, res))
    return
  }

  if (req.method === 'POST' && req.url === '/decision') {
    let decision
    try {
      decision = JSON.parse(await readBody(req))
    } catch {
      json(res, 400, { error: 'invalid json' })
      return
    }
    const ok = resolveDecision(decision)
    json(res, ok ? 200 : 404, { ok })
    return
  }

  if (req.method === 'POST' && req.url === '/dismiss') {
    let payload
    try {
      payload = JSON.parse(await readBody(req))
    } catch {
      json(res, 400, { error: 'invalid json' })
      return
    }
    if (!payload?.id) {
      json(res, 400, { error: 'missing id' })
      return
    }
    const ok = dismiss(payload.id)
    json(res, ok ? 200 : 404, { ok })
    return
  }

  if (req.method === 'POST' && req.url === '/status') {
    let update
    try {
      update = JSON.parse(await readBody(req))
    } catch {
      json(res, 400, { error: 'invalid json' })
      return
    }
    if (!AGENTS.includes(update.agent) || !STATUSES.includes(update.status)) {
      json(res, 400, { error: 'invalid agent or status' })
      return
    }
    agentStatus[update.agent] = update.status
    if (update.status === 'running' || update.status === 'approval') {
      armStatusWatchdog(update.agent)
    } else {
      clearStatusWatchdog(update.agent)
    }
    json(res, 200, { ok: true, agents: agentStatus })
    return
  }

  json(res, 404, { error: 'not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  writeConfig(PORT)
  console.log(`[headless-bridge] listening 127.0.0.1:${PORT}`)
})

function shutdown() {
  for (const [, item] of pending) {
    for (const waiter of item.waiters) {
      clearTimeout(waiter.timer)
      respondFailOpen(waiter.res)
    }
  }
  pending.clear()
  for (const t of statusWatchdogs.values()) clearTimeout(t)
  statusWatchdogs.clear()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
