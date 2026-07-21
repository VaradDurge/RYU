#!/usr/bin/env node
/**
 * Track A — S1–S8 contract suite against shared headless bridge.
 */

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  ROOT,
  get,
  post,
  sleep,
  waitHealth,
  startBridge,
  stopBridge,
  makeEvent
} from './ryu-test-util.mjs'

const hookPath = resolve(ROOT, 'hooks/ryu-hook.mjs')
const cursorStatusPath = resolve(ROOT, 'hooks/ryu-cursor-status.mjs')
const claudeStatusPath = resolve(ROOT, 'hooks/ryu-claude-status.mjs')
const hooksJsonPath = resolve(ROOT, '.cursor/hooks.json')
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
    results.push({ id, ok: false })
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
    child,
    done: new Promise((resolveCode) => child.on('close', resolveCode)),
    getStdout: () => stdout
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

async function main() {
  console.log('Track A verify — S1–S8 (shared headless bridge)\n')
  const bridge = startBridge()
  try {
    await waitHealth()
    console.log('[ok] headless bridge up\n')

    await caseRun('S1', 'Bridge Attention — POST /event → GET /pending', async () => {
      const id = randomUUID()
      const eventP = post('/event', makeEvent({ id, preview: 'Write: track-a-s1.txt' }))
      await sleep(150)
      const pending = await get('/pending')
      assert(pending.ok, 'GET /pending failed')
      assert(pending.json.ids.includes(id), `pending missing id ${id}`)
      assert(pending.json.events.find((e) => e.id === id)?.agent === 'claude', 'agent')
      await post('/decision', { id, decision: 'allow', reason: 's1-cleanup' })
      await eventP
    })

    await caseRun('S2', 'Decide Allow — PermissionRequest stdout allow', async () => {
      const h = spawnHook({
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: { file_path: resolve(ROOT, 'ryu-track-a-allow.txt'), content: 'allow' },
        cwd: ROOT,
        session_id: 'track-a-s2'
      })
      const pending = await waitPending()
      assert(pending, 'allow pending missing')
      const d = await post('/decision', { id: pending.ids[0], decision: 'allow', reason: 's2' })
      assert(d.json?.ok, 'allow decision not ok')
      const code = await h.done
      const out = JSON.parse(h.getStdout().trim())
      assert(code === 0, `exit ${code}`)
      assert(out?.hookSpecificOutput?.decision?.behavior === 'allow', `stdout ${h.getStdout()}`)
    })

    await caseRun('S3', 'Decide Deny — stdout deny + agents.claude=error', async () => {
      const h = spawnHook({
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: { file_path: resolve(ROOT, 'ryu-track-a-deny.txt'), content: 'deny' },
        cwd: ROOT,
        session_id: 'track-a-s3'
      })
      const pending = await waitPending()
      assert(pending, 'deny pending missing')
      await post('/decision', { id: pending.ids[0], decision: 'deny', reason: 's3' })
      const code = await h.done
      const out = JSON.parse(h.getStdout().trim())
      assert(code === 0 && out?.hookSpecificOutput?.decision?.behavior === 'deny', 'deny stdout')
      await sleep(100)
      const agents = await get('/agents')
      assert(agents.json?.agents?.claude === 'error', `expected error, got ${JSON.stringify(agents.json)}`)
    })

    await caseRun('S4', 'Fail-open — bad port → exit 0 empty stdout', async () => {
      const h = spawnHook(
        {
          hook_event_name: 'PermissionRequest',
          tool_name: 'Write',
          tool_input: { file_path: '/tmp/x', content: 'x' },
          cwd: ROOT,
          session_id: 'track-a-s4'
        },
        { RYU_PORT: '41998' }
      )
      const code = await h.done
      assert(code === 0 && h.getStdout().trim() === '', 'fail-open')
    })

    await caseRun('S5', 'Status rings — running/idle/approval/error via POST /status', async () => {
      for (const agent of ['cursor', 'claude']) {
        for (const status of ['running', 'approval', 'error', 'idle']) {
          const r = await post('/status', { agent, status, detail: `track-a ${agent} ${status}` })
          assert(r.ok && r.json?.agents?.[agent] === status, `${agent}/${status}`)
        }
      }
      const bad = await post('/status', { agent: 'nope', status: 'running' })
      assert(bad.status === 400, 'invalid agent should 400')
    })

    await caseRun('S6', 'Cursor status hook + hooks.json status-only', async () => {
      const cfg = JSON.parse(readFileSync(hooksJsonPath, 'utf8'))
      const flat = JSON.stringify(cfg)
      assert(!flat.includes('ryu-cursor-hook.mjs'), 'permission gate must stay off')
      assert(flat.includes('ryu-cursor-status.mjs'), 'status hook wired')
      await post('/status', { agent: 'cursor', status: 'idle', detail: 'reset' })
      const run = spawnSync(process.execPath, [cursorStatusPath, 'beforeSubmitPrompt'], {
        input: '',
        encoding: 'utf8',
        timeout: 5000,
        cwd: ROOT
      })
      assert(run.status === 0, `status hook exit ${run.status}`)
      let agents = await get('/agents')
      assert(agents.json?.agents?.cursor === 'running', 'expected running')
      const stop = spawnSync(process.execPath, [cursorStatusPath, 'stop'], {
        input: '',
        encoding: 'utf8',
        timeout: 5000,
        cwd: ROOT
      })
      assert(stop.status === 0, 'stop')
      agents = await get('/agents')
      assert(agents.json?.agents?.cursor === 'idle', 'expected idle')
    })

    await caseRun('S7', 'Claude status hook + dual-waiter Resume', async () => {
      await post('/status', { agent: 'claude', status: 'idle', detail: 'reset' })
      const prompt = spawnSync(process.execPath, [claudeStatusPath, 'UserPromptSubmit'], {
        input: '',
        encoding: 'utf8',
        timeout: 5000,
        cwd: ROOT
      })
      assert(prompt.status === 0, 'UserPromptSubmit')
      assert((await get('/agents')).json?.agents?.claude === 'running', 'running')

      const dualBase = {
        tool_name: 'Write',
        tool_input: { file_path: resolve(ROOT, 'ryu-track-a-dual.txt'), content: 'dual' },
        cwd: ROOT,
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
      assert(JSON.parse(hPre.getStdout().trim())?.hookSpecificOutput?.permissionDecision === 'allow')
      assert(JSON.parse(hPerm.getStdout().trim())?.hookSpecificOutput?.decision?.behavior === 'allow')
    })

    await caseRun('S8', 'No regressions — all prior Track A cases passed', async () => {
      assert(results.every((r) => r.ok), `failed: ${results.filter((r) => !r.ok).map((f) => f.id)}`)
    })
  } finally {
    await stopBridge(bridge)
  }

  if (results.some((r) => !r.ok)) {
    console.error('Track A FAILED')
    process.exit(1)
  }
  console.log('\nTrack A OK — S1–S8 PASS (headless)')
  console.log('Home-only still required: H1 Cursor live · H2 Claude live Write→Approve · H3 UX feel')
}

main().catch((err) => {
  console.error('verify:track-a FAILED:', err.message || err)
  process.exit(1)
})
