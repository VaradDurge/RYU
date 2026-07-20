#!/usr/bin/env node
/**
 * Track A — S1–S8 contract suite against a headless bridge (no Electron UI).
 * Does NOT prove live Claude/Cursor (home-only H1–H3).
 *
 * Usage: npm run verify:track-a
 */

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const BASE = 'http://127.0.0.1:41999'
const hookPath = resolve(root, 'hooks/ryu-hook.mjs')
const cursorStatusPath = resolve(root, 'hooks/ryu-cursor-status.mjs')
const claudeStatusPath = resolve(root, 'hooks/ryu-claude-status.mjs')
const bridgePath = resolve(__dirname, 'headless-bridge.mjs')
const hooksJsonPath = resolve(root, '.cursor/hooks.json')

const results = []

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function caseRun(id, label, fn) {
  try {
    await fn()
    console.log(`[${id}] PASS — ${label}`)
    results.push({ id, ok: true })
  } catch (err) {
    console.error(`[${id}] FAIL — ${label}: ${err.message || err}`)
    results.push({ id, ok: false, err: err.message || String(err) })
  }
}

function spawnHook(payload, env = {}) {
  const child = spawn(process.execPath, [hookPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env }
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (d) => {
    stdout += d
  })
  child.stderr.on('data', (d) => {
    stderr += d
  })
  child.stdin.write(JSON.stringify(payload))
  child.stdin.end()
  return {
    child,
    done: new Promise((resolveCode) => child.on('close', resolveCode)),
    getStdout: () => stdout,
    getStderr: () => stderr
  }
}

async function waitPending(agent = 'claude', maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(100)
    const pending = await get('/pending')
    const events = (pending.json?.events || []).filter((e) => !agent || e.agent === agent)
    if (events.length) return { ids: events.map((e) => e.id), events }
  }
  return null
}

async function waitHealth(maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const h = await get('/health')
      if (h.ok && h.json?.ok) return h.json
    } catch {
      // not up yet
    }
    await sleep(100)
  }
  throw new Error('headless bridge did not become healthy')
}

function startBridge() {
  const child = spawn(process.execPath, [bridgePath, '41999'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: root
  })
  let err = ''
  child.stderr.on('data', (d) => {
    err += d
  })
  child.stdout.on('data', () => {})
  return {
    child,
    getErr: () => err
  }
}

async function main() {
  console.log('Track A verify — S1–S8 (headless bridge, no live agents)\n')

  // Free port if something leftover
  try {
    await fetch(`${BASE}/health`)
    console.log('[warn] something already on 41999 — Track A expects exclusive headless bridge')
  } catch {
    // expected
  }

  const bridge = startBridge()
  try {
    await waitHealth()
    console.log('[ok] headless bridge up\n')

    // S1 — Bridge Attention
    await caseRun('S1', 'Bridge Attention — POST /event → GET /pending', async () => {
      const id = randomUUID()
      const eventP = post('/event', {
        id,
        agent: 'claude',
        sessionLabel: 'claude · track-a',
        tool: 'Write',
        preview: 'Write: track-a-s1.txt',
        path: root,
        risk: 'normal',
        ts: Date.now()
      })
      await sleep(150)
      const pending = await get('/pending')
      assert(pending.ok, 'GET /pending failed')
      assert(pending.json.ids.includes(id), `pending missing id ${id}`)
      const ev = pending.json.events.find((e) => e.id === id)
      assert(ev?.agent === 'claude', `expected agent claude, got ${ev?.agent}`)
      await post('/decision', { id, decision: 'allow', reason: 's1-cleanup' })
      await eventP
    })

    // S2 — Decide Allow
    await caseRun('S2', 'Decide Allow — PermissionRequest stdout allow', async () => {
      const h = spawnHook({
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: {
          file_path: resolve(root, 'ryu-track-a-allow.txt'),
          content: 'allow'
        },
        cwd: root,
        session_id: 'track-a-s2'
      })
      const pending = await waitPending()
      assert(pending, 'allow pending missing')
      const d = await post('/decision', { id: pending.ids[0], decision: 'allow', reason: 's2' })
      assert(d.json?.ok, 'allow decision not ok')
      const code = await h.done
      const out = JSON.parse(h.getStdout().trim())
      assert(code === 0, `exit ${code}`)
      assert(out?.hookSpecificOutput?.hookEventName === 'PermissionRequest', 'wrong event')
      assert(out?.hookSpecificOutput?.decision?.behavior === 'allow', `stdout ${h.getStdout()}`)
    })

    // S3 — Decide Deny (+ error ring)
    await caseRun('S3', 'Decide Deny — stdout deny + agents.claude=error', async () => {
      const h = spawnHook({
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: {
          file_path: resolve(root, 'ryu-track-a-deny.txt'),
          content: 'deny'
        },
        cwd: root,
        session_id: 'track-a-s3'
      })
      const pending = await waitPending()
      assert(pending, 'deny pending missing')
      await post('/decision', { id: pending.ids[0], decision: 'deny', reason: 's3' })
      const code = await h.done
      const out = JSON.parse(h.getStdout().trim())
      assert(code === 0, `exit ${code}`)
      assert(out?.hookSpecificOutput?.decision?.behavior === 'deny', `stdout ${h.getStdout()}`)
      await sleep(100)
      const agents = await get('/agents')
      assert(agents.json?.agents?.claude === 'error', `expected error, got ${JSON.stringify(agents.json)}`)
    })

    // S4 — Fail-open
    await caseRun('S4', 'Fail-open — bad port → exit 0 empty stdout', async () => {
      const h = spawnHook(
        {
          hook_event_name: 'PermissionRequest',
          tool_name: 'Write',
          tool_input: { file_path: '/tmp/x', content: 'x' },
          cwd: root,
          session_id: 'track-a-s4'
        },
        { RYU_PORT: '41998' }
      )
      const code = await h.done
      assert(code === 0, `exit ${code}`)
      assert(h.getStdout().trim() === '', `expected empty stdout, got ${h.getStdout()}`)
    })

    // S5 — Status rings contract
    await caseRun('S5', 'Status rings — running/idle/approval/error via POST /status', async () => {
      for (const agent of ['cursor', 'claude']) {
        for (const status of ['running', 'approval', 'error', 'idle']) {
          const r = await post('/status', { agent, status, detail: `track-a ${agent} ${status}` })
          assert(r.ok, `POST ${agent}/${status} failed`)
          assert(r.json?.agents?.[agent] === status, `${agent} not ${status}`)
          const g = await get('/agents')
          assert(g.json?.agents?.[agent] === status, `GET /agents ${agent} !== ${status}`)
        }
      }
      const bad = await post('/status', { agent: 'nope', status: 'running' })
      assert(bad.status === 400, 'invalid agent should 400')
    })

    // S6 — Cursor status hook + status-only config
    await caseRun('S6', 'Cursor status hook + hooks.json status-only', async () => {
      const cfg = JSON.parse(readFileSync(hooksJsonPath, 'utf8'))
      const flat = JSON.stringify(cfg)
      assert(!flat.includes('ryu-cursor-hook.mjs'), 'permission gate hook must stay off')
      assert(flat.includes('ryu-cursor-status.mjs'), 'status hook must be wired')

      await post('/status', { agent: 'cursor', status: 'idle', detail: 'reset' })
      const run = spawnSync(process.execPath, [cursorStatusPath, 'beforeSubmitPrompt'], {
        input: '',
        encoding: 'utf8',
        timeout: 5000,
        cwd: root
      })
      assert(run.status === 0, `status hook exit ${run.status}: ${run.stderr}`)
      let agents = await get('/agents')
      assert(agents.json?.agents?.cursor === 'running', `expected running, got ${JSON.stringify(agents.json)}`)

      const stop = spawnSync(process.execPath, [cursorStatusPath, 'stop'], {
        input: '',
        encoding: 'utf8',
        timeout: 5000,
        cwd: root
      })
      assert(stop.status === 0, `stop exit ${stop.status}`)
      agents = await get('/agents')
      assert(agents.json?.agents?.cursor === 'idle', `expected idle, got ${JSON.stringify(agents.json)}`)
    })

    // S7 — Claude status + resume dual-waiter (core of verify:claude-*)
    await caseRun('S7', 'Claude status hook + dual-waiter Resume', async () => {
      await post('/status', { agent: 'claude', status: 'idle', detail: 'reset' })
      const prompt = spawnSync(process.execPath, [claudeStatusPath, 'UserPromptSubmit'], {
        input: '',
        encoding: 'utf8',
        timeout: 5000,
        cwd: root
      })
      assert(prompt.status === 0, `UserPromptSubmit exit ${prompt.status}`)
      let agents = await get('/agents')
      assert(agents.json?.agents?.claude === 'running', 'UserPromptSubmit → running')

      const perm = spawnSync(process.execPath, [claudeStatusPath, 'PermissionRequest'], {
        input: '',
        encoding: 'utf8',
        timeout: 5000,
        cwd: root
      })
      assert(perm.status === 0, `PermissionRequest status exit ${perm.status}`)
      agents = await get('/agents')
      assert(agents.json?.agents?.claude === 'approval', 'PermissionRequest → approval')

      const dualBase = {
        tool_name: 'Write',
        tool_input: {
          file_path: resolve(root, 'ryu-track-a-dual.txt'),
          content: 'dual'
        },
        cwd: root,
        session_id: 'track-a-s7-dual'
      }
      const hPre = spawnHook({ ...dualBase, hook_event_name: 'PreToolUse' })
      await sleep(200)
      const hPerm = spawnHook({ ...dualBase, hook_event_name: 'PermissionRequest' })
      await sleep(400)
      const pending = await waitPending()
      assert(pending?.ids?.length === 1, `expected 1 coalesced id, got ${pending?.ids?.length}`)
      await post('/decision', { id: pending.ids[0], decision: 'allow', reason: 's7-dual' })
      const [codePre, codePerm] = await Promise.all([
        Promise.race([hPre.done, sleep(10000).then(() => -1)]),
        Promise.race([hPerm.done, sleep(10000).then(() => -1)])
      ])
      assert(codePre !== -1 && codePerm !== -1, 'dual waiter timeout')
      const outPre = JSON.parse(hPre.getStdout().trim())
      const outPerm = JSON.parse(hPerm.getStdout().trim())
      assert(outPre?.hookSpecificOutput?.permissionDecision === 'allow', 'PreToolUse allow')
      assert(outPerm?.hookSpecificOutput?.decision?.behavior === 'allow', 'PermissionRequest allow')
    })

    // S8 — suite integrity (all prior passed)
    await caseRun('S8', 'No regressions — all prior Track A cases passed', async () => {
      const failed = results.filter((r) => !r.ok)
      assert(failed.length === 0, `failed: ${failed.map((f) => f.id).join(', ')}`)
    })
  } finally {
    bridge.child.kill('SIGTERM')
    await sleep(200)
    if (!bridge.child.killed) {
      try {
        bridge.child.kill('SIGKILL')
      } catch {
        // ignore
      }
    }
  }

  const failed = results.filter((r) => !r.ok)
  console.log('')
  if (failed.length) {
    console.error(`Track A FAILED (${failed.length}): ${failed.map((f) => f.id).join(', ')}`)
    console.error('Home-only (not claimed): H1 live Cursor rings · H2 live Claude Resume · H3 UX sign-off')
    process.exit(1)
  }
  console.log('Track A OK — S1–S8 PASS (headless)')
  console.log('Home-only still required: H1 Cursor live · H2 Claude live Write→Approve · H3 UX feel')
}

main().catch((err) => {
  console.error('verify:track-a FAILED:', err.message || err)
  process.exit(1)
})
