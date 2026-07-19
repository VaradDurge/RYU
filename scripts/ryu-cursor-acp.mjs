#!/usr/bin/env node
/**
 * Cursor CLI ACP ↔ RYU bridge (Path B / real gate spike).
 *
 * Spawns `agent acp`, handles session/request_permission by long-polling RYU,
 * maps Approve → allow-once and Deny → reject-once.
 *
 * Prerequisites:
 *   - RYU running (`npm run dev`)
 *   - Cursor CLI on PATH: `agent` (run `agent login` once)
 *
 * Usage:
 *   node scripts/ryu-cursor-acp.mjs "Create a file named acp-test.txt with hello"
 *
 * This is the supported Cursor product path for external Approve/Deny.
 * IDE Multitask chrome is not controlled by this client.
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createInterface } from 'node:readline'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

const BASE_PORT = (() => {
  try {
    const n = Number(readFileSync(join(homedir(), '.ryu', 'port'), 'utf8').trim())
    return Number.isFinite(n) && n > 0 ? n : 41999
  } catch {
    return 41999
  }
})()
const BRIDGE = `http://127.0.0.1:${BASE_PORT}`
const promptText = process.argv.slice(2).join(' ').trim() || 'Say hello in one short sentence.'

function stableId(params) {
  const hex = createHash('sha256').update(JSON.stringify(params)).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function previewFromPermission(params) {
  const toolCall = params?.toolCall || params?.tool_call || {}
  const title = toolCall.title || toolCall.kind || 'Cursor tool'
  const raw =
    toolCall.rawInput ||
    toolCall.raw_input ||
    toolCall.content ||
    params?.options?.map((o) => o.optionId).join(',') ||
    ''
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
  const preview = `${title}: ${text}`.replace(/\s+/g, ' ').trim().slice(0, 140)
  return preview || 'Cursor permission request'
}

async function askRyu(params) {
  const preview = previewFromPermission(params)
  const id = stableId({ preview, sessionId: params?.sessionId })
  const event = {
    id,
    agent: 'cursor',
    sessionLabel: 'cursor · acp',
    tool: params?.toolCall?.kind || 'Tool',
    preview,
    path: process.cwd(),
    risk: /rm\s+-rf/i.test(preview) ? 'destructive' : 'normal',
    ts: Date.now()
  }

  const res = await fetch(`${BRIDGE}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  })
  if (!res.ok) throw new Error(`bridge ${res.status}`)
  const body = await res.json()
  if (body.status === 'allow' || body.decision?.decision === 'allow') return 'allow-once'
  if (body.status === 'deny' || body.decision?.decision === 'deny') return 'reject-once'
  // fail-open → let Cursor CLI decide (allow-once would be unsafe; reject-once blocks; use allow-once only on explicit allow)
  // On timeout: reject-once is safer than silent allow for ACP spike
  return 'reject-once'
}

async function main() {
  const health = await fetch(`${BRIDGE}/health`)
    .then((r) => r.json())
    .catch(() => null)
  if (!health?.ok) {
    console.error('[ryu-acp] RYU bridge not up. Run npm run dev first.')
    process.exit(1)
  }

  const agentBin = process.env.CURSOR_AGENT || 'agent'
  const agent = spawn(agentBin, ['acp'], { stdio: ['pipe', 'pipe', 'inherit'] })

  let nextId = 1
  const pending = new Map()

  function send(method, params) {
    const id = nextId++
    agent.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }

  function respond(id, result) {
    agent.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`)
  }

  const rl = createInterface({ input: agent.stdout })
  rl.on('line', (line) => {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }

    if (msg.id && (msg.result || msg.error)) {
      const waiter = pending.get(msg.id)
      if (!waiter) return
      pending.delete(msg.id)
      msg.error ? waiter.reject(msg.error) : waiter.resolve(msg.result)
      return
    }

    if (msg.method === 'session/update') {
      const update = msg.params?.update
      if (update?.sessionUpdate === 'agent_message_chunk' && update.content?.text) {
        process.stdout.write(update.content.text)
      }
      return
    }

    if (msg.method === 'session/request_permission') {
      void askRyu(msg.params)
        .then((optionId) => {
          console.error(`\n[ryu-acp] permission → ${optionId}`)
          respond(msg.id, { outcome: { outcome: 'selected', optionId } })
        })
        .catch((err) => {
          console.error(`\n[ryu-acp] permission error: ${err.message}`)
          respond(msg.id, { outcome: { outcome: 'selected', optionId: 'reject-once' } })
        })
    }
  })

  try {
    await send('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: 'ryu-cursor-acp', version: '0.1.0' }
    })
    await send('authenticate', { methodId: 'cursor_login' })
    const { sessionId } = await send('session/new', { cwd: process.cwd(), mcpServers: [] })
    console.error(`[ryu-acp] session ${sessionId}`)
    console.error(`[ryu-acp] prompt: ${promptText}`)
    const result = await send('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text: promptText }]
    })
    console.error(`\n[ryu-acp] stopReason=${result.stopReason}`)
  } catch (err) {
    console.error('[ryu-acp] failed:', err?.message || err)
    console.error('[ryu-acp] Ensure `agent` is on PATH and `agent login` succeeded.')
    process.exitCode = 1
  } finally {
    agent.stdin.end()
    agent.kill()
  }
}

main()
