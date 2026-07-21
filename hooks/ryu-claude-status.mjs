#!/usr/bin/env node
/**
 * Claude Code lifecycle → RYU dock status (agent: claude).
 * Fail-open: never block Claude if RYU is down.
 *
 * Event name from argv[2] first (install wires it) — then stdin JSON.
 * Logs to ~/.ryu/claude-hook.log
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ryuFetch, readLoopbackHost } from './ryu-bridge-client.mjs'

function log(line) {
  try {
    const dir = join(homedir(), '.ryu')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'claude-hook.log'), `${new Date().toISOString()} ${line}\n`)
  } catch {
    // ignore
  }
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const buf = Buffer.concat(chunks)
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString('utf16le')
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return buf.swap16().toString('utf16le')
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString('utf8')
  }
  return buf.toString('utf8')
}

function normalizeEventName(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]/g, '')
}

/** @returns {'running'|'idle'|'error'|'approval'|null} */
function statusFromHook(eventName, payload) {
  if (process.env.RYU_STATUS) return process.env.RYU_STATUS
  const name = normalizeEventName(eventName || payload?.hook_event_name)

  if (name === 'stop' || name === 'sessionend' || name === 'stopfailure') {
    if (payload?.status === 'error' || name === 'stopfailure') return 'error'
    return 'idle'
  }

  if (name === 'posttoolusefailure' || name === 'permissiondenied') return 'error'

  // Permission dialog path — yellow (ryu-hook.mjs still handles Approve/Deny)
  if (name === 'permissionrequest') return 'approval'

  if (
    name === 'sessionstart' ||
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

function summarize(eventName, payload, status) {
  if (status === 'idle') return 'Claude · Idle'
  if (status === 'error') return 'Claude · Error'
  if (status === 'approval') return 'Claude · Needs approval'

  const tool = payload.tool_name || payload.toolName || payload.tool
  const file =
    payload.file_path ||
    payload.filePath ||
    payload.path ||
    payload.tool_input?.file_path ||
    payload.tool_input?.path
  const cmd = payload.command || payload.tool_input?.command || payload.tool_input?.cmd
  const name = normalizeEventName(eventName)

  if (file) return `Editing ${basename(String(file))}`
  if (cmd) {
    const c = String(cmd).replace(/\s+/g, ' ').trim()
    return c.length > 56 ? `Shell: ${c.slice(0, 55)}…` : `Shell: ${c}`
  }
  if (tool) return `Using ${tool}`

  if (name === 'userpromptsubmit' || name === 'sessionstart') return 'Working on your prompt…'
  if (name === 'pretooluse') return 'Running a tool…'
  if (name === 'posttooluse' || name === 'posttoolbatch') return 'Finishing a tool…'
  if (name === 'subagentstart') return 'Sub-agent running…'
  if (name === 'permissionrequest') return 'Waiting for approval…'
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
    'unknown'

  const status = statusFromHook(eventName, payload)

  if (!status) {
    log(`${eventName} → ignore argv=${argvEvent || '-'} stdinLen=${raw.length}`)
    process.exit(0)
  }

  const detail = summarize(eventName, payload, status)
  if (!readLoopbackHost()) {
    log(`${eventName} → ${status} FAIL non-loopback host`)
    process.exit(0)
  }

  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 1200)
    const res = await ryuFetch('/status', {
      method: 'POST',
      body: { agent: 'claude', status, detail },
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
