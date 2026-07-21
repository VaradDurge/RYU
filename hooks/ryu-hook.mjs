#!/usr/bin/env node
/**
 * Claude Code PermissionRequest (+ PreToolUse) hook for RYU.
 * Each invocation has a unique request id.
 * PreToolUse ↔ PermissionRequest share pairKey so one Approve unblocks both.
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { join, normalize, resolve } from 'node:path'
import { ryuDir, ryuFetch, readLoopbackHost, readPort } from './ryu-bridge-client.mjs'

const PREVIEW_MAX = 140
const REQUEST_TIMEOUT_MS = 4 * 60 * 1000

function log(line) {
  try {
    mkdirSync(ryuDir(), { recursive: true })
    appendFileSync(join(ryuDir(), 'hook.log'), `${new Date().toISOString()} ${line}\n`, 'utf8')
  } catch {
    // ignore
  }
}

function failOpen(reason) {
  log(`fail-open ${reason}`)
  process.exit(0)
}

function truncate(s, max = PREVIEW_MAX) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function normalizeToolInput(toolInput, cwd) {
  if (!toolInput || typeof toolInput !== 'object') return {}
  const out = { ...toolInput }
  if (typeof out.file_path === 'string' && cwd) {
    try {
      out.file_path = normalize(resolve(cwd, out.file_path)).replace(/\\/g, '/').toLowerCase()
    } catch {
      // keep original
    }
  }
  if (typeof out.command === 'string') out.command = out.command.trim()
  return out
}

function pairKeyFor(sessionKey, toolName, toolInput) {
  // Full content fingerprint (not truncated) so similar writes do not collide.
  const contentFp =
    typeof toolInput.content === 'string'
      ? createHash('sha256').update(toolInput.content).digest('hex').slice(0, 16)
      : ''
  const key = `${sessionKey}\0${toolName}\0${toolInput.command || ''}\0${toolInput.file_path || ''}\0${contentFp}`
  return createHash('sha256').update(key).digest('hex').slice(0, 24)
}

function buildPreview(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return truncate(`${toolName}`)
  if (toolName === 'Bash' && toolInput.command) return truncate(`Bash: ${toolInput.command}`)
  if ((toolName === 'Write' || toolName === 'Edit') && toolInput.file_path) {
    return truncate(`${toolName}: ${toolInput.file_path}`)
  }
  if (toolInput.command) return truncate(`${toolName}: ${toolInput.command}`)
  if (toolInput.file_path) return truncate(`${toolName}: ${toolInput.file_path}`)
  return truncate(JSON.stringify(toolInput))
}

function isDestructive(preview) {
  return /rm\s+-rf|rm\s+-fr|del\s+\/s|format\s+|Drop\s+Table/i.test(preview)
}

function writeStdout(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`)
}

async function postStatus(status, detail) {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 800)
    await ryuFetch('/status', {
      method: 'POST',
      body: { agent: 'claude', status, detail },
      signal: ac.signal
    })
    clearTimeout(t)
  } catch {
    // ignore
  }
}

function emitDecision(hookEventName, decision, reason) {
  if (hookEventName === 'PermissionRequest') {
    const output = {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: decision }
      }
    }
    if (decision === 'deny' && reason) output.hookSpecificOutput.decision.message = reason
    writeStdout(output)
    return
  }
  writeStdout({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason
    }
  })
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  let raw
  try {
    raw = await readStdin()
  } catch {
    failOpen('stdin')
    return
  }

  let input
  try {
    input = JSON.parse(raw || '{}')
  } catch {
    failOpen('json')
    return
  }

  const hookEventName = input.hook_event_name || input.hookEventName || 'PermissionRequest'
  if (hookEventName !== 'PreToolUse' && hookEventName !== 'PermissionRequest') {
    failOpen(`event ${hookEventName}`)
    return
  }

  if (!readLoopbackHost()) {
    log('fail-open non-loopback RYU_HOST rejected')
    process.exit(0)
    return
  }

  const toolName = input.tool_name || input.toolName || 'Tool'
  const cwd = input.cwd || input.working_directory || ''
  const rawInput = input.tool_input || input.toolInput || {}
  const toolInput = normalizeToolInput(rawInput, cwd)
  const sessionKey = String(input.session_id || input.sessionId || cwd || 'session')
  const session =
    sessionKey === 'session' && cwd ? cwd.split(/[/\\]/).filter(Boolean).pop() : sessionKey

  const invocationId =
    input.tool_use_id ||
    input.toolUseId ||
    input.id ||
    input.request_id ||
    randomUUID()

  const preview = buildPreview(toolName, toolInput)
  const event = {
    id: String(invocationId),
    pairKey: pairKeyFor(sessionKey, toolName, toolInput),
    hookKind: hookEventName,
    agent: 'claude',
    sessionLabel: `claude · ${session}`,
    tool: toolName,
    preview,
    path: cwd || undefined,
    risk: isDestructive(preview) ? 'destructive' : 'normal',
    ts: Date.now()
  }

  log(`start ${hookEventName} id=${event.id} pair=${event.pairKey} tool=${toolName} port=${readPort()}`)
  await postStatus('approval', preview)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await ryuFetch('/event', {
      method: 'POST',
      body: event,
      signal: controller.signal
    })
    if (!res.ok) {
      failOpen(`http ${res.status}`)
      return
    }
    const body = await res.json()
    if (!body || body.status === 'timeout' || body.status === 'cancelled') {
      failOpen(`bridge ${body?.status || 'empty'}`)
      return
    }
    if (body.status === 'allow' || body.decision?.decision === 'allow') {
      await postStatus('running', truncate(preview || 'Approved — continuing'))
      emitDecision(hookEventName, 'allow', body.decision?.reason || 'Approved via RYU')
      process.exit(0)
      return
    }
    if (body.status === 'deny' || body.decision?.decision === 'deny') {
      await postStatus('error', 'Claude · Denied')
      emitDecision(hookEventName, 'deny', body.decision?.reason || 'Denied via RYU')
      process.exit(0)
      return
    }
    failOpen('unknown response')
  } catch (err) {
    if (err?.code === 'RYU_NON_LOOPBACK') {
      failOpen('non-loopback host')
      return
    }
    failOpen(err?.message || 'fetch')
  } finally {
    clearTimeout(timer)
  }
}

main()
