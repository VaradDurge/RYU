#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook for RYU.
 * Reads stdin JSON, long-polls local bridge, writes wrapped permissionDecision to stdout.
 * Fail-open: on any error/timeout, exit 0 with no decision (Claude shows normal prompt).
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const PREVIEW_MAX = 140
const REQUEST_TIMEOUT_MS = 4 * 60 * 1000

function failOpen() {
  // No decision → Claude falls back to interactive prompt
  process.exit(0)
}

function truncate(s, max = PREVIEW_MAX) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
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
    failOpen()
    return
  }

  let input
  try {
    input = JSON.parse(raw || '{}')
  } catch {
    failOpen()
    return
  }

  const toolName = input.tool_name || input.toolName || 'Tool'
  const toolInput = input.tool_input || input.toolInput || {}
  const cwd = input.cwd || input.working_directory || ''
  const session =
    input.session_id || input.sessionId || (cwd ? cwd.split(/[/\\]/).filter(Boolean).pop() : 'session')

  const preview = buildPreview(toolName, toolInput)
  const event = {
    id: randomUUID(),
    agent: 'claude',
    sessionLabel: `claude · ${session}`,
    tool: toolName,
    preview,
    risk: isDestructive(preview) ? 'destructive' : 'normal',
    ts: Date.now()
  }

  const port = readPort()
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
      failOpen()
      return
    }

    const body = await res.json()
    // Fail-open on timeout / missing decision
    if (!body || body.status === 'timeout' || body.status === 'cancelled') {
      failOpen()
      return
    }

    if (body.status === 'allow' || body.decision?.decision === 'allow') {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'allow',
            permissionDecisionReason: body.decision?.reason || 'Approved via RYU'
          }
        })
      )
      process.exit(0)
      return
    }

    if (body.status === 'deny' || body.decision?.decision === 'deny') {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: body.decision?.reason || 'Denied via RYU'
          }
        })
      )
      process.exit(0)
      return
    }

    failOpen()
  } catch {
    failOpen()
  } finally {
    clearTimeout(timer)
  }
}

main()
