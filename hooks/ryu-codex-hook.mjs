#!/usr/bin/env node
/**
 * Codex CLI PermissionRequest / PreToolUse hook for RYU.
 * Same bridge contract as Claude; agent branded as codex.
 * Fail-open on error/timeout.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join, normalize, resolve } from 'node:path'

const PREVIEW_MAX = 140
const REQUEST_TIMEOUT_MS = 4 * 60 * 1000

function ryuDir() {
  const dir = join(homedir(), '.ryu')
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    // ignore
  }
  return dir
}

function log(line) {
  try {
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

function readPort() {
  if (process.env.RYU_PORT) {
    const n = Number(process.env.RYU_PORT)
    if (Number.isFinite(n) && n > 0) return n
  }
  try {
    const n = Number(readFileSync(join(homedir(), '.ryu', 'port'), 'utf8').trim())
    if (Number.isFinite(n) && n > 0) return n
  } catch {
    // ignore
  }
  return 41999
}

function stableEventId(sessionKey, toolName, toolInput) {
  const key = `${sessionKey}\0${toolName}\0${JSON.stringify(toolInput ?? {})}`
  const hex = createHash('sha256').update(key).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
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

async function postStatus(port, status, detail) {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 800)
    await fetch(`http://127.0.0.1:${port}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'codex', status, detail }),
      signal: ac.signal
    })
    clearTimeout(t)
  } catch {
    // ignore — permission path must not depend on status
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

  const toolName = input.tool_name || 'Bash'
  const toolInput = input.tool_input || {}
  const cwd = input.cwd || ''
  const sessionKey = String(input.session_id || cwd || 'session')
  const idInput = {
    command: toolInput.command,
    file_path: toolInput.file_path
      ? normalize(resolve(cwd || process.cwd(), toolInput.file_path)).replace(/\\/g, '/').toLowerCase()
      : undefined
  }

  const preview = buildPreview(toolName, toolInput)
  const event = {
    id: stableEventId(sessionKey, toolName, idInput),
    agent: 'codex',
    sessionLabel: `codex · ${sessionKey}`,
    tool: toolName,
    preview,
    path: cwd || undefined,
    risk: /rm\s+-rf/i.test(preview) ? 'destructive' : 'normal',
    ts: Date.now()
  }

  const port = readPort()
  log(`start ${hookEventName} id=${event.id}`)
  await postStatus(port, 'approval', preview)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`http://127.0.0.1:${port}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
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
      await postStatus(port, 'running', truncate(preview || 'Approved — continuing'))
      emit(hookEventName, 'allow', body.decision?.reason || 'Approved via RYU')
      process.exit(0)
      return
    }
    if (body.status === 'deny' || body.decision?.decision === 'deny') {
      await postStatus(port, 'error', 'Codex · Denied')
      emit(hookEventName, 'deny', body.decision?.reason || 'Denied via RYU')
      process.exit(0)
      return
    }
    failOpen('unknown')
  } catch (err) {
    failOpen(err?.message || 'fetch')
  } finally {
    clearTimeout(timer)
  }
}

main()
