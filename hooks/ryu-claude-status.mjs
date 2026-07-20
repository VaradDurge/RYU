#!/usr/bin/env node
/**
 * Claude Code lifecycle → RYU dock status (agent: claude).
 * Fail-open: never block Claude if RYU is down.
 * Logs to ~/.ryu/claude-hook.log
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function log(line) {
  try {
    const dir = join(homedir(), '.ryu')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'claude-hook.log'), `${new Date().toISOString()} ${line}\n`)
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

/** @returns {'running'|'idle'|'error'|'approval'|null} */
function statusFromHook(eventName, payload) {
  if (process.env.RYU_STATUS) return process.env.RYU_STATUS
  const name = String(eventName || payload?.hook_event_name || '').toLowerCase()

  if (name === 'stop' || name === 'sessionend' || name === 'stopfailure') {
    if (payload?.status === 'error' || name === 'stopfailure') return 'error'
    return 'idle'
  }

  if (name === 'posttoolusefailure') return 'error'

  // Permission dialog path — yellow (ryu-hook.mjs still handles Approve/Deny)
  if (name === 'permissionrequest') return 'approval'

  // CLI loaded / waiting at the prompt — available, not working yet
  if (name === 'sessionstart') return 'idle'

  if (
    name === 'userpromptsubmit' ||
    name === 'pretooluse' ||
    name === 'posttooluse' ||
    name === 'posttoolbatch' ||
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

  if (status === 'error') return 'Claude · Error'
  if (status === 'approval') return 'Claude · Needs approval'
  if (name === 'sessionstart') return 'Claude · Ready'
  if (status === 'idle') return 'Claude · Idle'

  const tool = payload.tool_name || payload.toolName || payload.tool
  const file =
    payload.file_path ||
    payload.filePath ||
    payload.path ||
    payload.tool_input?.file_path ||
    payload.tool_input?.path
  const cmd =
    payload.command ||
    payload.tool_input?.command ||
    payload.tool_input?.cmd

  if (file) return `Editing ${basename(String(file))}`
  if (cmd) {
    const c = String(cmd).replace(/\s+/g, ' ').trim()
    return c.length > 56 ? `Shell: ${c.slice(0, 55)}…` : `Shell: ${c}`
  }
  if (tool) return `Using ${tool}`

  if (name === 'userpromptsubmit') return 'Working on your prompt…'
  if (name === 'pretooluse') return 'Running a tool…'
  if (name === 'posttooluse' || name === 'posttoolbatch') return 'Finishing a tool…'
  if (name === 'subagentstart') return 'Sub-agent running…'
  if (name === 'permissionrequest') return 'Waiting for approval…'
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

  const eventName = payload.hook_event_name || payload.hookEventName || 'unknown'
  const status = statusFromHook(eventName, payload)
  const name = String(eventName || '').toLowerCase()

  let session
  if (name === 'sessionstart') session = 'open'
  else if (name === 'sessionend') session = 'closed'
  else if (status && status !== 'idle') session = 'open'
  // idle Stop keeps session open unless SessionEnd; SessionStart already opens above

  if (!status && !session) {
    log(`${eventName} → ignore`)
    process.exit(0)
  }

  const detail = status ? summarize(eventName, payload, status) : undefined
  const port = readPort()
  const url = `http://127.0.0.1:${port}/status`
  const body = JSON.stringify({
    agent: 'claude',
    status: status || 'idle',
    detail: detail || (session === 'open' ? 'Claude · Ready' : undefined),
    session,
    path: payload.cwd || payload.workspace_root || payload.workspaceRoot
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
