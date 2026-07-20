#!/usr/bin/env node
/**
 * Headless RYU bridge — same HTTP contract as electron/bridge.ts, no Electron UI.
 * Used by verify:track-a. Writes ~/.ryu/port like the real app.
 *
 * Usage: node scripts/headless-bridge.mjs [port]
 */

import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PORT = Number(process.argv[2] || process.env.RYU_PORT || 41999)
const DECISION_TIMEOUT_MS = 5 * 60 * 1000

const pending = new Map()
const agentStatus = { cursor: 'idle', claude: 'idle', codex: 'idle' }
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

function dropWaiter(id, res) {
  const item = pending.get(id)
  if (!item) return
  item.waiters = item.waiters.filter((w) => {
    if (w.res === res) clearTimeout(w.timer)
    return w.res !== res
  })
  if (item.waiters.length === 0) pending.delete(id)
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
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
