#!/usr/bin/env node
/**
 * Cursor lifecycle → RYU dock status.
 * Fail-open: never block the agent if RYU is down.
 *
 * Event name comes from argv[2] (hooks.json) first — Cursor sometimes
 * delivers empty stdin or omits hook_event_name on Windows.
 *
 * running: work starting / tool in flight
 * idle: stop / sessionEnd only
 * ignore: afterAgentResponse, postToolUse, afterShellExecution (prevents stuck green)
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ryuFetch } from './ryu-bridge-client.mjs'

function log(line) {
  try {
    const dir = join(homedir(), '.ryu')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'cursor-hook.log'), `${new Date().toISOString()} ${line}\n`)
  } catch {
    // ignore
  }
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const buf = Buffer.concat(chunks)
  // Cursor on Windows sometimes pipes UTF-16 LE (BOM FF FE) — JSON.parse then fails
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString('utf16le')
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return buf.swap16().toString('utf16le')
  }
  // UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString('utf8')
  }
  return buf.toString('utf8')
}

/** Map Cursor matcher aliases → canonical hook names */
function normalizeEventName(raw) {
  const n = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]/g, '')
  const aliases = {
    userpromptsubmit: 'beforesubmitprompt',
    stop: 'stop',
    agentresponse: 'afteragentresponse',
    agentthought: 'afteragentthought',
    sessionstart: 'sessionstart',
    sessionend: 'sessionend',
    pretooluse: 'pretooluse',
    posttooluse: 'posttooluse',
    beforeshellexecution: 'beforeshellexecution',
    aftershellexecution: 'aftershellexecution',
    afterfileedit: 'afterfileedit',
    subagentstart: 'subagentstart',
    beforesubmitprompt: 'beforesubmitprompt'
  }
  return aliases[n] || n
}

function inferEventFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return ''
  if (typeof payload.prompt === 'string' && payload.prompt.length) return 'beforesubmitprompt'
  if (payload.status === 'completed' || payload.status === 'error' || payload.loop_count != null) {
    return 'stop'
  }
  if (payload.command || payload.shell_command) return 'beforeshellexecution'
  if (payload.tool_name || payload.toolName || payload.tool) return 'pretooluse'
  if (payload.file_path || payload.filePath || payload.edits) return 'afterfileedit'
  return ''
}

/** @returns {'running'|'idle'|'error'|null} null = ignore (no POST) */
function statusFromHook(eventName) {
  if (process.env.RYU_STATUS) return process.env.RYU_STATUS
  const name = normalizeEventName(eventName)

  if (name === 'stop' || name === 'sessionend') return 'idle'
  if (name === 'error') return 'error'

  if (
    name === 'afteragentresponse' ||
    name === 'afteragentthought' ||
    name === 'posttooluse' ||
    name === 'aftershellexecution'
  ) {
    return null
  }

  if (
    name === 'sessionstart' ||
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

function summarize(eventName, payload, status) {
  if (status === 'idle') return 'Cursor · Idle'
  if (status === 'error') return 'Cursor · Error'

  const tool = payload.tool_name || payload.toolName || payload.tool
  const file =
    payload.file_path ||
    payload.filePath ||
    payload.path ||
    payload.uri ||
    payload.target_file ||
    (Array.isArray(payload.edits) && payload.edits[0]?.path)
  const cmd = payload.command || payload.shell_command || payload.shellCommand
  const name = normalizeEventName(eventName)

  if (file) return `Editing ${basename(String(file))}`
  if (cmd) {
    const c = String(cmd).replace(/\s+/g, ' ').trim()
    return c.length > 56 ? `Shell: ${c.slice(0, 55)}…` : `Shell: ${c}`
  }
  if (tool) return `Using ${tool}`

  if (name === 'beforesubmitprompt' || name === 'sessionstart') return 'Starting work…'
  if (name === 'pretooluse') return 'Running a tool…'
  if (name === 'beforeshellexecution') return 'Running a command…'
  if (name === 'afterfileedit') return 'Editing a file…'
  if (name === 'subagentstart') return 'Sub-agent running…'
  return 'Working…'
}

async function main() {
  const argvEvent = process.argv[2] || process.env.RYU_HOOK_EVENT || ''

  let raw = ''
  try {
    raw = await readStdin()
  } catch {
    raw = ''
  }

  let payload = {}
  try {
    payload = raw.trim() ? JSON.parse(raw) : {}
  } catch (err) {
    log(`stdin-json-fail argv=${argvEvent || '-'} len=${raw.length} ${err?.message || err}`)
    payload = {}
  }

  const eventName =
    argvEvent ||
    payload.hook_event_name ||
    payload.hookEventName ||
    payload.event_name ||
    payload.eventName ||
    inferEventFromPayload(payload) ||
    'unknown'

  // stop with error status
  let status = statusFromHook(eventName)
  if (status === 'idle' && payload?.status === 'error') status = 'error'

  if (!status) {
    const keys = Object.keys(payload).slice(0, 12).join(',')
    log(`${eventName} → ignore keys=[${keys}] argv=${argvEvent || '-'} stdinLen=${raw.length}`)
    process.exit(0)
  }

  const detail = summarize(eventName, payload, status)

  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 1200)
    const res = await ryuFetch('/status', {
      method: 'POST',
      body: { agent: 'cursor', status, detail },
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
