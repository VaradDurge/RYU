#!/usr/bin/env node
/**
 * Phase 1 remediation acceptance — P1.1–P1.5 remote contracts.
 * Uses shared bridge-core (same module Electron wraps).
 */

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  shouldPairWith,
  computeInteractiveBounds,
  validateEvent,
  validateDecision,
  isLoopbackHost
} from '../shared/bridge-core.mjs'
import { reduceIsland } from '../shared/island-reducer.mjs'
import {
  ROOT,
  BASE,
  get,
  post,
  sleep,
  waitHealth,
  startBridge,
  stopBridge,
  makeEvent,
  readToken,
  authHeaders
} from './ryu-test-util.mjs'

const hookPath = resolve(ROOT, 'hooks/ryu-hook.mjs')
const results = []

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
  child.stdout.on('data', (d) => {
    stdout += d
  })
  child.stdin.write(JSON.stringify(payload))
  child.stdin.end()
  return {
    done: new Promise((r) => child.on('close', r)),
    getStdout: () => stdout,
    child
  }
}

async function waitPending(maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(100)
    const pending = await get('/pending')
    if (pending.json?.ids?.length) return pending.json
  }
  return null
}

async function main() {
  console.log('Phase 1 remediation verify — P1.1–P1.5\n')

  // Pure unit checks (no bridge)
  await caseRun('P1.3u', 'Pairing helper only joins complementary hookKinds', async () => {
    assert(
      shouldPairWith(
        { pairKey: 'k', hookKinds: new Set(['PreToolUse']) },
        { pairKey: 'k', hookKind: 'PermissionRequest' }
      ),
      'should pair'
    )
    assert(
      !shouldPairWith(
        { pairKey: 'k', hookKinds: new Set(['PermissionRequest']) },
        { pairKey: 'k', hookKind: 'PermissionRequest' }
      ),
      'same kind must not pair'
    )
    assert(
      !shouldPairWith(
        { pairKey: 'a', hookKinds: new Set(['PreToolUse']) },
        { pairKey: 'b', hookKind: 'PermissionRequest' }
      ),
      'different pairKey'
    )
  })

  await caseRun('P1.4u', 'Interactive bounds stay centered and sized', async () => {
    const area = { x: 0, y: 0, width: 1920, height: 1080 }
    const idle = computeInteractiveBounds(area, 'idle')
    const dock = computeInteractiveBounds(area, 'dock')
    const expanded = computeInteractiveBounds(area, 'expanded')
    assert(idle.width <= area.width && idle.y === 0, 'idle bounds')
    assert(dock.height >= idle.height, 'dock taller/equal')
    assert(expanded.width >= dock.width && expanded.height > dock.height, 'expanded larger')
    assert(Math.abs(idle.x + idle.width / 2 - area.width / 2) < 2, 'centered')
  })

  await caseRun('P1.1u', 'Island hydrate/reconcile from snapshot events', async () => {
    const e1 = makeEvent({ id: 'a', preview: 'Write: a.txt' })
    const e2 = makeEvent({ id: 'b', preview: 'Write: b.txt' })
    let state = reduceIsland(undefined, { type: 'hydrate', events: [e1, e2] })
    assert(state.current?.id === 'a' && state.queue[0]?.id === 'b', 'hydrate fifo')
    state = reduceIsland(state, { type: 'event', event: e1 })
    assert(state.queue.length === 1, 'dedupe current')
    state = reduceIsland(state, { type: 'drop', id: 'a' })
    assert(state.current?.id === 'b' && state.queue.length === 0, 'advance after drop')
  })

  await caseRun('P1.5u', 'Schema + loopback helpers', async () => {
    assert(validateEvent(makeEvent({ id: 'x' })).ok, 'valid event')
    assert(!validateEvent({ id: 'x' }).ok, 'invalid event')
    assert(validateDecision({ id: 'x', decision: 'allow' }).ok, 'valid decision')
    assert(!validateDecision({ id: 'x', decision: 'maybe' }).ok, 'invalid decision')
    assert(isLoopbackHost('127.0.0.1') && isLoopbackHost('localhost'), 'loopback')
    assert(!isLoopbackHost('example.com'), 'non-loopback')
  })

  const bridge = startBridge()
  try {
    await waitHealth()
    const token = readToken()
    assert(token, 'token written')

    await caseRun('P1.1', 'Snapshot recovers pendings + statuses', async () => {
      const id1 = randomUUID()
      const id2 = randomUUID()
      const p1 = post('/event', makeEvent({ id: id1, preview: 'Write: snap1.txt' }))
      const p2 = post('/event', makeEvent({ id: id2, agent: 'codex', sessionLabel: 'codex · s', preview: 'Bash: echo 2' }))
      await post('/status', { agent: 'claude', status: 'approval', detail: 'snap' })
      await sleep(150)
      const snap = await get('/snapshot')
      assert(snap.ok, 'snapshot ok')
      assert(snap.json.ids.includes(id1) && snap.json.ids.includes(id2), 'both ids')
      assert(snap.json.agents.claude === 'approval', 'status in snapshot')
      assert(typeof snap.json.revision === 'number' && snap.json.revision > 0, 'revision')
      // Simulate renderer: ingest snapshot then live duplicate
      let ui = reduceIsland(undefined, { type: 'hydrate', events: snap.json.events })
      ui = reduceIsland(ui, { type: 'event', event: snap.json.events[0] })
      assert(ui.current && ui.queue.length + 1 === 2, 'deduped hydrate+live')
      await post('/decision', { id: id1, decision: 'allow' })
      await post('/decision', { id: id2, decision: 'deny' })
      await p1
      await p2
    })

    await caseRun('P1.2', 'Decision/dismiss acknowledgement semantics', async () => {
      const id = randomUUID()
      const pendingReq = post('/event', makeEvent({ id, preview: 'Write: ack.txt' }))
      await sleep(100)
      const ok = await post('/decision', { id, decision: 'allow', reason: 'ack' })
      assert(ok.json?.ok === true, 'accepted')
      await pendingReq
      const miss = await post('/decision', { id, decision: 'allow' })
      assert(miss.json?.ok === false && miss.json?.reason === 'unknown', 'unknown after resolve')
      const bad = await post('/decision', { id: randomUUID(), decision: 'allow' })
      assert(bad.json?.ok === false, 'unknown id')
      const id2 = randomUUID()
      const pending2 = post('/event', makeEvent({ id: id2, preview: 'Write: dismiss-ack.txt' }))
      await sleep(100)
      const d = await post('/dismiss', { id: id2 })
      assert(d.json?.ok === true, 'dismiss ok')
      const body = await pending2
      assert(body.json?.status === 'cancelled', 'cancelled')
      const d2 = await post('/dismiss', { id: id2 })
      assert(d2.json?.ok === false, 'second dismiss fails')
    })

    await caseRun('P1.3', 'Collision-safe pairing vs independent requests', async () => {
      const dual = {
        tool_name: 'Write',
        tool_input: { file_path: resolve(ROOT, 'ryu-p13-dual.txt'), content: 'same' },
        cwd: ROOT,
        session_id: 'p13-dual'
      }
      const hPre = spawnHook({ ...dual, hook_event_name: 'PreToolUse' })
      await sleep(150)
      const hPerm = spawnHook({ ...dual, hook_event_name: 'PermissionRequest' })
      await sleep(350)
      let pending = await waitPending()
      assert(pending?.ids?.length === 1, `pair should be 1 card, got ${pending?.ids?.length}`)
      await post('/decision', { id: pending.ids[0], decision: 'allow' })
      await Promise.all([hPre.done, hPerm.done])

      // Two PermissionRequests with different content → two cards
      const h1 = spawnHook({
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: {
          file_path: resolve(ROOT, 'ryu-p13.txt'),
          content: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaAAA'
        },
        cwd: ROOT,
        session_id: 'p13-collide'
      })
      const h2 = spawnHook({
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: {
          file_path: resolve(ROOT, 'ryu-p13.txt'),
          content: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaBBB'
        },
        cwd: ROOT,
        session_id: 'p13-collide'
      })
      await sleep(500)
      pending = await waitPending()
      assert(pending?.ids?.length === 2, `expected 2 independent cards, got ${pending?.ids?.length}`)
      await post('/decision', { id: pending.ids[0], decision: 'allow' })
      await post('/decision', { id: pending.ids[1], decision: 'deny' })
      const [c1, c2] = await Promise.all([h1.done, h2.done])
      assert(c1 === 0 && c2 === 0, 'both hooks exit')
      const behaviors = [h1.getStdout(), h2.getStdout()].map((raw) => {
        const j = JSON.parse(raw.trim())
        return j?.hookSpecificOutput?.decision?.behavior
      })
      assert(
        new Set(behaviors).size === 2 && behaviors.includes('allow') && behaviors.includes('deny'),
        `distinct decisions got ${behaviors.join(',')}`
      )
    })

    await caseRun('P1.5', 'Auth, body limit, non-loopback fail-open', async () => {
      const noAuth = await fetch(`${BASE}/pending`)
      assert(noAuth.status === 401, 'pending requires auth')
      const wrong = await fetch(`${BASE}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ryu-token': 'nope' },
        body: JSON.stringify({ agent: 'claude', status: 'idle' })
      })
      assert(wrong.status === 401, 'wrong token')
      const ok = await post('/status', { agent: 'claude', status: 'idle', detail: 'authed' })
      assert(ok.ok, 'authed status')

      const huge = 'x'.repeat(70 * 1024)
      let bigStatus = 0
      try {
        const big = await fetch(`${BASE}/event`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(makeEvent({ id: randomUUID(), preview: huge }))
        })
        bigStatus = big.status
      } catch {
        bigStatus = 413
      }
      assert(bigStatus === 413 || bigStatus === 400, `oversized got ${bigStatus}`)

      const h = spawnHook(
        {
          hook_event_name: 'PermissionRequest',
          tool_name: 'Write',
          tool_input: { file_path: '/tmp/x', content: 'x' },
          cwd: ROOT,
          session_id: 'p15-host'
        },
        { RYU_HOST: 'example.com' }
      )
      const code = await h.done
      assert(code === 0 && h.getStdout().trim() === '', 'non-loopback fail-open')
    })
  } finally {
    await stopBridge(bridge)
  }

  // Local-mode copy check in source
  await caseRun('P1.5copy', 'UI copy no longer overclaims local mode', async () => {
    const src = readFileSync(resolve(ROOT, 'src/island/Expanded.tsx'), 'utf8')
    assert(!src.includes('All data stays on this device'), 'old copy removed')
    assert(src.includes('loopback'), 'honest copy present')
  })

  const failed = results.filter((r) => !r.ok)
  console.log('')
  if (failed.length) {
    console.error(`Phase 1 remediation FAILED: ${failed.map((f) => f.id).join(', ')}`)
    process.exit(1)
  }
  console.log('Phase 1 remediation OK — P1.1–P1.5 remote acceptance PASS')
  console.log('Home-only still required: Electron click-through, live Claude/Cursor, WSL token path')
}

main().catch((err) => {
  console.error('verify:phase1-remediation FAILED:', err.message || err)
  process.exit(1)
})
