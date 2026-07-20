#!/usr/bin/env node
/**
 * Cursor lifecycle → RYU dock status.
 * Fail-open: never block the agent if RYU is down.
 *
 * running: work starting / tool in flight
 * idle: stop / sessionEnd only
 * ignore: afterAgentResponse, postToolUse, afterShellExecution (prevents stuck green)
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function log(line) {
  try {
    const dir = join(homedir(), '.ryu')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'cursor-hook.log'), `${new Date().toISOString()} ${line}\n`)
  } catch {
    // ignore
  }
}

function readPort() {
  if (process.env.RYU_PORT) {
    const n = Number(process.env.RYU_PORT)
    if (Number.isFinite(n) && n > 0) return n
  }
  try {
    const raw = readFileSync(join(homedir(), '.ryu', 'port'), 'utf8').trim()
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return n
  } catch {
    // default
  }
  return 41999
}

/** @returns {'running'|'idle'|'error'|null} null = ignore (no POST) */
function statusFromHook(eventName, payload) {
  if (process.env.RYU_STATUS) return process.env.RYU_STATUS
  const name = String(eventName || payload?.hook_event_name || '').toLowerCase()

  if (name === 'stop' || name === 'sessionend') {
    if (payload?.status === 'error') return 'error'
    return 'idle'
  }

  // Do not map end-of-step events to running (causes stuck green after stop)
  if (
    name === 'afteragentresponse' ||
    name === 'afteragentthought' ||
    name === 'posttooluse' ||
    name === 'aftershellexecution'
  ) {
    return null
  }

  // IDE / chat opened — available, not working yet
  if (name === 'sessionstart') return 'idle'

  if (
    name === 'beforesubmitprompt' ||
    name === 'pretooluse' ||
    name === 'beforeshellexecution' ||
    name === 'afterfileedit' ||
    name === 'subagentstart'
  ) {
    return 'running'
  }

  return null
}

function basename(p) {
  if (!p || typeof p !== 'string') return ''
  const parts = p.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || p
}

/** Short line for the dock hover chip */
function summarize(eventName, payload, status) {
  const name = String(eventName || '').toLowerCase()
  if (status === 'error') return 'Cursor · Error'
  if (name === 'sessionstart') return 'Cursor · Ready'
  if (status === 'idle') return 'Cursor · Idle'

  const tool = payload.tool_name || payload.toolName || payload.tool
  const file =
    payload.file_path ||
    payload.filePath ||
    payload.path ||
    payload.uri ||
    payload.target_file ||
    (Array.isArray(payload.edits) && payload.edits[0]?.path)
  const cmd = payload.command || payload.shell_command || payload.shellCommand

  if (file) return `Editing ${basename(String(file))}`
  if (cmd) {
    const c = String(cmd).replace(/\s+/g, ' ').trim()
    return c.length > 56 ? `Shell: ${c.slice(0, 55)}…` : `Shell: ${c}`
  }
  if (tool) return `Using ${tool}`

  if (name === 'beforesubmitprompt') return 'Starting work…'
  if (name === 'pretooluse') return 'Running a tool…'
  if (name === 'beforeshellexecution') return 'Running a command…'
  if (name === 'afterfileedit') return 'Editing a file…'
  if (name === 'subagentstart') return 'Sub-agent running…'
  return 'Working…'
}

async function main() {
  let raw = ''
  try {
    raw = readFileSync(0, 'utf8')
  } catch {
    raw = ''
  }

  let payload = {}
  try {
    payload = raw ? JSON.parse(raw) : {}
  } catch {
    payload = {}
  }

  const eventName = payload.hook_event_name || 'unknown'
  const status = statusFromHook(eventName, payload)
  const name = String(eventName || '').toLowerCase()

  // Session presence for persistent menu-bar badges
  let session
  if (name === 'sessionstart') session = 'open'
  else if (name === 'sessionend') session = 'closed'
  else if (status && status !== 'idle') session = 'open'

  if (!status && !session) {
    log(`${eventName} → ignore`)
    process.exit(0)
  }

  const detail = status ? summarize(eventName, payload, status) : undefined
  const port = readPort()
  const url = `http://127.0.0.1:${port}/status`
  const body = JSON.stringify({
    agent: 'cursor',
    status: status || 'idle',
    detail: detail || (session === 'open' ? 'Cursor · Ready' : undefined),
    session,
    path: payload.workspace_roots?.[0] || payload.cwd || payload.workspace_root
  })

  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 1200)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: ac.signal
    })
    clearTimeout(t)
    const text = await res.text()
    log(`${eventName} → ${status} HTTP ${res.status} ${text}`)
  } catch (err) {
    log(`${eventName} → ${status} FAIL ${err?.message || err}`)
  }

  process.exit(0)
}

main()
