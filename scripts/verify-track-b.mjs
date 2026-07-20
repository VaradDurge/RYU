#!/usr/bin/env node
/**
 * Track B — S9–S12 (+ Track A still green) against headless bridge.
 * Usage: npm run verify:track-b
 */

import { spawn, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const BASE = 'http://127.0.0.1:41999'
const bridgePath = resolve(__dirname, 'headless-bridge.mjs')
const codexHookPath = resolve(root, 'hooks/ryu-codex-hook.mjs')
const trackAPath = resolve(__dirname, 'verify-track-a.mjs')

const WATCHDOG_MS = 400
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

function spawnHook(hookPath, payload, env = {}) {
  const child = spawn(process.execPath, [hookPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env }
  })
  let stdout = ''
  child.stdout.on('data', (d) => {
    stdout += d
  })
  child.stdin.write(JSON.stringify(payload))
  child.stdin.end()
  return {
    child,
    done: new Promise((resolveCode) => child.on('close', resolveCode)),
    getStdout: () => stdout
  }
}

async function waitPending(agent, maxAttempts = 40) {
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
      // not up
    }
    await sleep(100)
  }
  throw new Error('headless bridge did not become healthy')
}

function startBridge() {
  return spawn(process.execPath, [bridgePath, '41999'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: root,
    env: { ...process.env, RYU_WATCHDOG_MS: String(WATCHDOG_MS) }
  })
}

async function stopBridge(child) {
  child.kill('SIGTERM')
  await sleep(200)
  try {
    child.kill('SIGKILL')
  } catch {
    // ignore
  }
  await sleep(150)
}

async function main() {
  console.log('Track B verify — S9–S12 (headless) + Track A gate\n')

  const bridge = startBridge()
  try {
    await waitHealth()
    console.log(`[ok] headless bridge up (watchdog ${WATCHDOG_MS}ms)\n`)

    // S9 — multi-pending queue
    await caseRun('S9', 'Queue — two pendings; decide first; second remains', async () => {
      const id1 = randomUUID()
      const id2 = randomUUID()
      const p1 = post('/event', {
        id: id1,
        agent: 'claude',
        sessionLabel: 'claude · q1',
        tool: 'Write',
        preview: 'Write: q1.txt',
        ts: Date.now()
      })
      const p2 = post('/event', {
        id: id2,
        agent: 'codex',
        sessionLabel: 'codex · q2',
        tool: 'Bash',
        preview: 'Bash: echo q2',
        ts: Date.now()
      })
      await sleep(200)
      let pending = await get('/pending')
      assert(pending.json.ids.includes(id1) && pending.json.ids.includes(id2), 'both ids pending')
      assert(pending.json.ids.length === 2, `expected 2 pending, got ${pending.json.ids.length}`)

      const d1 = await post('/decision', { id: id1, decision: 'allow', reason: 's9-first' })
      assert(d1.json?.ok, 'first decide failed')
      const r1 = await p1
      assert(r1.json?.status === 'allow', 'first event not allow')

      pending = await get('/pending')
      assert(!pending.json.ids.includes(id1), 'first id should be gone')
      assert(pending.json.ids.includes(id2), 'second id must remain')
      assert(pending.json.events.find((e) => e.id === id2)?.agent === 'codex', 'second agent codex')

      const d2 = await post('/decision', { id: id2, decision: 'allow', reason: 's9-second' })
      assert(d2.json?.ok, 'second decide failed')
      await p2
      pending = await get('/pending')
      assert((pending.json.ids || []).length === 0, 'queue should be empty')
    })

    // S10 — dismiss
    await caseRun('S10', 'Dismiss — pending cleared; waiter cancelled (not allow)', async () => {
      const id = randomUUID()
      const eventP = post('/event', {
        id,
        agent: 'claude',
        sessionLabel: 'claude · dismiss',
        tool: 'Write',
        preview: 'Write: stale.txt',
        ts: Date.now()
      })
      await sleep(150)
      let pending = await get('/pending')
      assert(pending.json.ids.includes(id), 'dismiss target missing')

      const h = spawnHook(codexHookPath, {
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: { file_path: resolve(root, 'ryu-track-b-dismiss.txt'), content: 'x' },
        cwd: root,
        session_id: 'track-b-s10-hook'
      })
      // Also test HTTP dismiss on the synthetic event
      const dismissed = await post('/dismiss', { id })
      assert(dismissed.json?.ok, 'dismiss not ok')
      const body = await eventP
      assert(body.json?.status === 'cancelled', `expected cancelled, got ${JSON.stringify(body.json)}`)
      pending = await get('/pending')
      assert(!pending.json.ids.includes(id), 'id still pending after dismiss')

      // Hook path: register then dismiss its pending
      const hookPending = await waitPending('codex')
      assert(hookPending, 'codex hook did not pending')
      await post('/dismiss', { id: hookPending.ids[0] })
      const code = await h.done
      assert(code === 0, `hook exit ${code}`)
      assert(h.getStdout().trim() === '', `dismiss must fail-open empty stdout, got ${h.getStdout()}`)
    })

    // S11 — Codex parity
    await caseRun('S11', 'Codex allow/deny/fail-open + status parity', async () => {
      for (const status of ['running', 'approval', 'error', 'idle']) {
        const r = await post('/status', { agent: 'codex', status, detail: `s11 ${status}` })
        assert(r.ok && r.json?.agents?.codex === status, `codex ${status}`)
      }

      const hAllow = spawnHook(codexHookPath, {
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: { file_path: resolve(root, 'ryu-track-b-codex-allow.txt'), content: 'ok' },
        cwd: root,
        session_id: 'track-b-s11-allow'
      })
      const pendAllow = await waitPending('codex')
      assert(pendAllow, 'codex allow pending missing')
      assert(pendAllow.events[0]?.agent === 'codex', 'agent not codex')
      await post('/decision', { id: pendAllow.ids[0], decision: 'allow', reason: 's11' })
      const codeAllow = await hAllow.done
      const outAllow = JSON.parse(hAllow.getStdout().trim())
      assert(codeAllow === 0, 'allow exit')
      assert(outAllow?.hookSpecificOutput?.decision?.behavior === 'allow', 'allow stdout')
      await sleep(100)
      let agents = await get('/agents')
      assert(agents.json?.agents?.codex === 'running', `after allow expected running, got ${JSON.stringify(agents.json)}`)

      const hDeny = spawnHook(codexHookPath, {
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: { file_path: resolve(root, 'ryu-track-b-codex-deny.txt'), content: 'no' },
        cwd: root,
        session_id: 'track-b-s11-deny'
      })
      const pendDeny = await waitPending('codex')
      assert(pendDeny, 'codex deny pending missing')
      await post('/decision', { id: pendDeny.ids[0], decision: 'deny', reason: 's11-deny' })
      const codeDeny = await hDeny.done
      const outDeny = JSON.parse(hDeny.getStdout().trim())
      assert(codeDeny === 0 && outDeny?.hookSpecificOutput?.decision?.behavior === 'deny', 'deny stdout')
      await sleep(100)
      agents = await get('/agents')
      assert(agents.json?.agents?.codex === 'error', 'after deny expected error')

      const hFail = spawnHook(
        codexHookPath,
        {
          hook_event_name: 'PermissionRequest',
          tool_name: 'Bash',
          tool_input: { command: 'echo x' },
          cwd: root,
          session_id: 'track-b-s11-fail'
        },
        { RYU_PORT: '41998' }
      )
      const failCode = await hFail.done
      assert(failCode === 0 && hFail.getStdout().trim() === '', 'codex fail-open')
    })

    // S12 — watchdog
    await caseRun('S12', 'Watchdog — running → idle without refresh', async () => {
      await post('/status', { agent: 'cursor', status: 'running', detail: 'watchdog run' })
      let agents = await get('/agents')
      assert(agents.json?.agents?.cursor === 'running', 'precondition running')
      await sleep(WATCHDOG_MS + 250)
      agents = await get('/agents')
      assert(agents.json?.agents?.cursor === 'idle', `expected idle after watchdog, got ${JSON.stringify(agents.json)}`)

      await post('/status', { agent: 'claude', status: 'approval', detail: 'watchdog approval' })
      await sleep(WATCHDOG_MS + 250)
      agents = await get('/agents')
      assert(agents.json?.agents?.claude === 'idle', 'approval should watchdog to idle')
    })
  } finally {
    await stopBridge(bridge)
  }

  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    console.error(`\nTrack B FAILED (${failed.length}): ${failed.map((f) => f.id).join(', ')}`)
    process.exit(1)
  }

  console.log('\n[ok] S9–S12 PASS — running Track A gate…\n')
  const trackA = spawnSync(process.execPath, [trackAPath], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit'
  })
  if (trackA.status !== 0) {
    console.error('\n[S8′] FAIL — Track A regression')
    process.exit(1)
  }
  console.log('\n[S8′] PASS — Track A still green')
  console.log('Track B OK — S9–S12 + Track A')
}

main().catch((err) => {
  console.error('verify:track-b FAILED:', err.message || err)
  process.exit(1)
})
