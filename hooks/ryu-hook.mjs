#!/usr/bin/env node
/**
 * Claude Code PermissionRequest (+ PreToolUse) hook for RYU.
 * PermissionRequest owns the terminal Yes/No prompt.
 * PreToolUse uses the same stable event id so one Approve unblocks both waiters.
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

function readHost() {
  if (process.env.RYU_HOST?.trim()) return process.env.RYU_HOST.trim()
  try {
    const raw = readFileSync(join(homedir(), '.ryu', 'host'), 'utf8').trim()
    if (raw) return raw
  } catch {
    // ignore
  }
  return '127.0.0.1'
}

function readPort() {
  if (process.env.RYU_PORT) {
    const envPort = Number(process.env.RYU_PORT)
    if (Number.isFinite(envPort) && envPort > 0) return envPort
  }
  try {
    const raw = readFileSync(join(homedir(), '.ryu', 'port'), 'utf8').trim()
    const port = Number(raw)
    if (!Number.isFinite(port) || port <= 0) throw new Error('bad port')
    return port
  } catch {
    return 41999
  }
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
  if (typeof out.content === 'string') {
    // Keep content in id hash but don't let huge bodies explode the key
    out.content = out.content.length > 64 ? `${out.content.slice(0, 64)}…` : out.content
  }
  if (typeof out.command === 'string') out.command = out.command.trim()
  return out
}

function stableStringify(value) {
  if (!value || typeof value !== 'object') return JSON.stringify(value)
  const sorted = Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = value[key]
      return acc
    }, {})
  return JSON.stringify(sorted)
}

function stableEventId(sessionKey, toolName, toolInput) {
  const key = `${sessionKey}\0${toolName}\0${stableStringify(toolInput)}`
  const hex = createHash('sha256').update(key).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function buildPreview(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== 'object') {
    return truncate(`${toolName}`)
  }
  if (toolName === 'Bash' && toolInput.command) {
    return truncate(`Bash: ${toolInput.command}`)
  }
  if ((toolName === 'Write' || toolName === 'Edit') && toolInput.file_path) {
    return truncate(`${toolName}: ${toolInput.file_path}`)
  }
  if (toolInput.command) return truncate(`${toolName}: ${toolInput.command}`)
  if (toolInput.path) return truncate(`${toolName}: ${toolInput.path}`)
  if (toolInput.file_path) return truncate(`${toolName}: ${toolInput.file_path}`)
  return truncate(JSON.stringify(toolInput))
}

function isDestructive(preview) {
  return /rm\s+-rf|rm\s+-fr|del\s+\/s|format\s+|Drop\s+Table/i.test(preview)
}

function writeStdout(payload) {
  const line = `${JSON.stringify(payload)}\n`
  process.stdout.write(line)
  // Ensure Claude sees the full decision before we exit
  try {
    if (typeof process.stdout.fd === 'number') {
      // sync flush best-effort
    }
  } catch {
    // ignore
  }
}

/** Best-effort ring update (same bridge as Cursor status hooks). */
async function postStatus(host, port, status, detail) {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 800)
    await fetch(`http://${host}:${port}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'claude', status, detail }),
      signal: ac.signal
    })
    clearTimeout(t)
  } catch {
    // ignore — permission path must not depend on status
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
    if (decision === 'deny' && reason) {
      output.hookSpecificOutput.decision.message = reason
    }
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

  const toolName = input.tool_name || input.toolName || 'Tool'
  const cwd = input.cwd || input.working_directory || ''
  // For id stability, hash a normalized subset (file_path / command) without truncating path
  const rawInput = input.tool_input || input.toolInput || {}
  const idInput =
    typeof rawInput === 'object' && rawInput
      ? {
          command: rawInput.command,
          file_path: rawInput.file_path,
          content:
            typeof rawInput.content === 'string'
              ? rawInput.content.length > 64
                ? `${rawInput.content.slice(0, 64)}…`
                : rawInput.content
              : undefined
        }
      : {}
  const toolInput = normalizeToolInput(rawInput, cwd)
  const sessionKey = String(input.session_id || input.sessionId || cwd || 'session')
  const session =
    sessionKey === 'session' && cwd ? cwd.split(/[/\\]/).filter(Boolean).pop() : sessionKey

  const preview = buildPreview(toolName, toolInput)
  const event = {
    id: stableEventId(sessionKey, toolName, idInput),
    agent: 'claude',
    sessionLabel: `claude · ${session}`,
    tool: toolName,
    preview,
    path: cwd || undefined,
    risk: isDestructive(preview) ? 'destructive' : 'normal',
    ts: Date.now()
  }

  const port = readPort()
  const host = readHost()
  log(`start ${hookEventName} id=${event.id} tool=${toolName} host=${host}:${port}`)

  // Mirror Cursor: yellow ring while waiting on the dock
  void postStatus(host, port, 'approval', preview)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`http://${host}:${port}/event`, {
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
      log(`allow id=${event.id} via ${hookEventName}`)
      await postStatus(host, port, 'running', truncate(preview || 'Approved — continuing'))
      emitDecision(hookEventName, 'allow', body.decision?.reason || 'Approved via RYU')
      process.exit(0)
      return
    }

    if (body.status === 'deny' || body.decision?.decision === 'deny') {
      log(`deny id=${event.id} via ${hookEventName}`)
      await postStatus(host, port, 'error', 'Claude · Denied')
      emitDecision(hookEventName, 'deny', body.decision?.reason || 'Denied via RYU')
      process.exit(0)
      return
    }

    failOpen('unknown response')
  } catch (err) {
    const msg = err?.message || 'fetch'
    if (process.platform === 'linux' && host === '127.0.0.1') {
      log(
        `fail-open ${msg} — WSL Linux node cannot reach Windows RYU on 127.0.0.1; re-run npm run hook:install (must use Windows node.exe)`
      )
      process.exit(0)
      return
    }
    failOpen(msg)
  } finally {
    clearTimeout(timer)
  }
}

main()
