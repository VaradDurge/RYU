#!/usr/bin/env node
/**
 * Codex CLI PermissionRequest / PreToolUse hook for RYU.
 * Unique request id per invocation; pairKey joins complementary hooks only.
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
    appendFileSync(join(ryuDir(), 'codex-hook.log'), `${new Date().toISOString()} ${line}\n`)
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

function buildPreview(toolName, toolInput) {
  if (toolName === 'Bash' && toolInput?.command) return truncate(`Bash: ${toolInput.command}`)
  if ((toolName === 'Write' || toolName === 'Edit' || toolName === 'apply_patch') && toolInput?.file_path) {
    return truncate(`${toolName}: ${toolInput.file_path}`)
  }
  if (toolInput?.command) return truncate(`${toolName}: ${toolInput.command}`)
  if (toolInput?.file_path) return truncate(`${toolName}: ${toolInput.file_path}`)
  return truncate(toolName)
}

function pairKeyFor(sessionKey, toolName, toolInput) {
  const file = toolInput?.file_path
    ? normalize(resolve(toolInput.cwd || process.cwd(), toolInput.file_path)).replace(/\\/g, '/').toLowerCase()
    : ''
  const contentFp =
    typeof toolInput?.content === 'string'
      ? createHash('sha256').update(toolInput.content).digest('hex').slice(0, 16)
      : ''
  const key = `${sessionKey}\0${toolName}\0${toolInput?.command || ''}\0${file}\0${contentFp}`
  return createHash('sha256').update(key).digest('hex').slice(0, 24)
}

async function postStatus(status, detail) {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 800)
    await ryuFetch('/status', {
      method: 'POST',
      body: { agent: 'codex', status, detail },
      signal: ac.signal
    })
    clearTimeout(t)
  } catch {
    // ignore
  }
}

function emit(hookEventName, decision, reason) {
  if (hookEventName === 'PermissionRequest') {
    const out = {
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: decision }
      }
    }
    if (decision === 'deny' && reason) out.hookSpecificOutput.decision.message = reason
    process.stdout.write(`${JSON.stringify(out)}\n`)
    return
  }
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason
      }
    })}\n`
  )
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  let input
  try {
    input = JSON.parse((await readStdin()) || '{}')
  } catch {
    failOpen('json')
    return
  }

  const hookEventName = input.hook_event_name || 'PermissionRequest'
  if (hookEventName !== 'PreToolUse' && hookEventName !== 'PermissionRequest') {
    failOpen(`event ${hookEventName}`)
    return
  }

  if (!readLoopbackHost()) {
    log('fail-open non-loopback RYU_HOST rejected')
    process.exit(0)
    return
  }

  const toolName = input.tool_name || 'Bash'
  const toolInput = input.tool_input || {}
  const cwd = input.cwd || ''
  const sessionKey = String(input.session_id || cwd || 'session')
  const invocationId = input.tool_use_id || input.toolUseId || input.id || randomUUID()
  const preview = buildPreview(toolName, { ...toolInput, cwd })

  const event = {
    id: String(invocationId),
    pairKey: pairKeyFor(sessionKey, toolName, { ...toolInput, cwd }),
    hookKind: hookEventName,
    agent: 'codex',
    sessionLabel: `codex · ${sessionKey}`,
    tool: toolName,
    preview,
    path: cwd || undefined,
    risk: /rm\s+-rf/i.test(preview) ? 'destructive' : 'normal',
    ts: Date.now()
  }

  log(`start ${hookEventName} id=${event.id} pair=${event.pairKey} port=${readPort()}`)
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
      emit(hookEventName, 'allow', body.decision?.reason || 'Approved via RYU')
      process.exit(0)
      return
    }
    if (body.status === 'deny' || body.decision?.decision === 'deny') {
      await postStatus('error', 'Codex · Denied')
      emit(hookEventName, 'deny', body.decision?.reason || 'Denied via RYU')
      process.exit(0)
      return
    }
    failOpen('unknown')
  } catch (err) {
    if (err?.code === 'RYU_NON_LOOPBACK') failOpen('non-loopback host')
    else failOpen(err?.message || 'fetch')
  } finally {
    clearTimeout(timer)
  }
}

main()
