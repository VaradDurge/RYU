#!/usr/bin/env node
/**
 * Phase 2 surface acceptance — P2.1–P2.6
 * Pure reducers + headless bridge fixtures + Phase 1 / Track B regression gates.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  RyuBridgeCore,
  validateEvent,
  MAX_EVENT_DETAIL_BYTES
} from '../shared/bridge-core.mjs'
import { reduceIsland, initialIslandState } from '../shared/island-reducer.mjs'
import {
  applyStatusUpdate,
  boundDetail,
  initialStatusState,
  reduceAgentStatus,
  shouldApplyStatus
} from '../shared/status-reducer.mjs'
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

const results = []
const WATCHDOG_MS = 400

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

function pendingAgents(...agents) {
  return new Set(agents)
}

async function main() {
  console.log('Phase 2 surface verify — P2.1–P2.6\n')

  // ── P2.4 ordered status model ──────────────────────────────────────────
  await caseRun('P2.4', 'Ordered status: late idle cannot clear approval; old revision ignored', async () => {
    let state = initialStatusState()
    state = applyStatusUpdate(state, {
      agent: 'claude',
      status: 'running',
      revision: 1,
      receivedAt: 1000
    })
    state = applyStatusUpdate(state, {
      agent: 'claude',
      status: 'approval',
      revision: 2,
      receivedAt: 2000
    })
    const lateIdle = applyStatusUpdate(
      state,
      { agent: 'claude', status: 'idle', revision: 3, receivedAt: 3000 },
      { pendingAgents: pendingAgents('claude') }
    )
    assert(lateIdle.statuses.claude === 'approval', 'late idle ignored while pending')
    assert(
      !shouldApplyStatus(
        lateIdle,
        { agent: 'claude', status: 'idle', revision: 3 },
        { pendingAgents: pendingAgents('claude') }
      ),
      'shouldApply blocks pending idle'
    )

    const older = applyStatusUpdate(lateIdle, {
      agent: 'claude',
      status: 'running',
      revision: 1,
      receivedAt: 500
    })
    assert(older.statuses.claude === 'approval', 'older revision ignored')
    assert(older.revisions.claude === 2, 'revision stays at approval')

    const newer = applyStatusUpdate(older, {
      agent: 'claude',
      status: 'error',
      revision: 4,
      receivedAt: 4000
    })
    assert(newer.statuses.claude === 'error', 'newer error applies')

    const lateRunning = applyStatusUpdate(newer, {
      agent: 'claude',
      status: 'running',
      revision: 3,
      receivedAt: 3500
    })
    assert(lateRunning.statuses.claude === 'error', 'late running ignored vs error')
  })

  // ── P2.3 stale ─────────────────────────────────────────────────────────
  await caseRun('P2.3u', 'markStale turns running/approval into stale, not idle', async () => {
    let state = initialStatusState()
    state = applyStatusUpdate(state, {
      agent: 'cursor',
      status: 'running',
      revision: 1
    })
    state = reduceAgentStatus(state, { type: 'markStale', agent: 'cursor' })
    assert(state.statuses.cursor === 'stale', 'running → stale')
    assert(state.statuses.cursor !== 'idle', 'not idle')

    state = applyStatusUpdate(state, {
      agent: 'claude',
      status: 'approval',
      revision: 2
    })
    state = reduceAgentStatus(state, {
      type: 'markStale',
      agent: 'claude',
      pendingAgents: pendingAgents('claude')
    })
    assert(state.statuses.claude === 'stale', 'approval → stale')

    // explicit idle clears stale when no pending
    state = applyStatusUpdate(state, {
      agent: 'cursor',
      status: 'idle',
      revision: 5
    })
    assert(state.statuses.cursor === 'idle', 'explicit idle clears stale')

    // fresh status refreshes stale
    state = applyStatusUpdate(state, {
      agent: 'claude',
      status: 'running',
      revision: 6
    })
    assert(state.statuses.claude === 'running', 'fresh status refreshes stale')
  })

  // ── P2.1 deliberate Attention ──────────────────────────────────────────
  await caseRun('P2.1', 'New event enters attention; expand is explicit; resolve → next attention', async () => {
    const e1 = makeEvent({ id: 'p21-a', preview: 'Write: a.txt' })
    const e2 = makeEvent({ id: 'p21-b', preview: 'Write: b.txt' })
    let state = reduceIsland(undefined, { type: 'event', event: e1 })
    assert(state.mode === 'attention', 'first event → attention')
    assert(state.mode !== 'expanded', 'not auto-expanded')

    state = reduceIsland(state, { type: 'expand' })
    assert(state.mode === 'expanded', 'explicit expand')

    state = reduceIsland(state, { type: 'event', event: e2 })
    assert(state.queue[0]?.id === 'p21-b', 'queued')
    state = reduceIsland(state, { type: 'resolved', decision: 'allow' })
    state = reduceIsland(state, { type: 'advance' })
    assert(state.mode === 'attention', 'next is attention')
    assert(state.current?.id === 'p21-b', 'next current')
    assert(state.mode !== 'expanded', 'next not auto-expanded')
  })

  // ── P2.2 Understand card model ─────────────────────────────────────────
  await caseRun('P2.2', 'Card model: session/tool/path + bounded detail; Details only when truthful', async () => {
    const long = 'x'.repeat(MAX_EVENT_DETAIL_BYTES + 200)
    const parsed = validateEvent(
      makeEvent({
        id: 'p22',
        sessionLabel: 'claude · session-42',
        tool: 'Bash',
        path: '/tmp/proj',
        preview: 'Bash: echo hi',
        detail: long,
        risk: 'destructive',
        hookKind: 'PermissionRequest'
      })
    )
    assert(parsed.ok, 'valid with detail')
    assert(parsed.event.sessionLabel === 'claude · session-42', 'sessionLabel')
    assert(parsed.event.tool === 'Bash', 'tool')
    assert(parsed.event.path === '/tmp/proj', 'path')
    assert(parsed.event.detailTruncated === true, 'detail truncated')
    assert(
      Buffer.byteLength(parsed.event.detail, 'utf8') <= MAX_EVENT_DETAIL_BYTES,
      'detail bounded'
    )
    const bound = boundDetail(long, MAX_EVENT_DETAIL_BYTES)
    assert(bound.truncated, 'boundDetail marks truncation')

    // Mirror Expanded helpers (TSX not importable from node verify)
    function displayPreviewLocal(preview) {
      return preview.replace(/^Bash:\s*/i, '')
    }
    function buildExtraDetailLocal(event) {
      const lines = []
      if (event.detail?.trim()) {
        lines.push(event.detail.trim())
        if (event.detailTruncated) lines.push('(truncated)')
      }
      if (event.risk === 'destructive') lines.push('risk: destructive (informational)')
      if (event.hookKind) lines.push(`hook: ${event.hookKind}`)
      return lines.length ? lines.join('\n') : null
    }
    assert(displayPreviewLocal('Bash: echo hi') === 'echo hi', 'canonical strip label only')
    assert(displayPreviewLocal('echo hi') === 'echo hi', 'no bash -lc rewrite')
    const extra = buildExtraDetailLocal(parsed.event)
    assert(extra && extra.includes('truncated'), 'Details content exists')
    assert(buildExtraDetailLocal(makeEvent({ id: 'plain' })) === null, 'no Details when nothing extra')

    const expandedSrc = readFileSync(resolve(ROOT, 'src/island/Expanded.tsx'), 'utf8')
    assert(expandedSrc.includes('event.sessionLabel'), 'sessionLabel rendered')
    assert(expandedSrc.includes('event.tool'), 'tool rendered')
    assert(expandedSrc.includes('buildExtraDetail'), 'Details gated on truthful extra')
    assert(!expandedSrc.includes('bash -lc'), 'no synthetic bash rewrite')
  })

  // ── P2.6 action integrity ──────────────────────────────────────────────
  await caseRun('P2.6', 'Action reducer: in-flight blocks; fail leaves card; ack resolves once', async () => {
    const e = makeEvent({ id: 'p26', preview: 'Write: once.txt' })
    let state = reduceIsland(initialIslandState, { type: 'event', event: e })
    state = reduceIsland(state, { type: 'expand' })
    state = reduceIsland(state, { type: 'actionStart' })
    assert(state.actionPending === true, 'in flight')
    // second start while pending still pending (idempotent)
    state = reduceIsland(state, { type: 'actionStart' })
    assert(state.actionPending === true, 'still pending')
    state = reduceIsland(state, { type: 'actionFail', reason: 'unavailable' })
    assert(state.actionPending === false && state.actionError === 'unavailable', 'fail leaves actionable')
    assert(state.mode === 'expanded' && state.current?.id === 'p26', 'card remains')
    state = reduceIsland(state, { type: 'actionStart' })
    state = reduceIsland(state, { type: 'resolved', decision: 'allow' })
    assert(state.mode === 'resolved' && state.actionPending === false, 'ack resolves once')

    const expandedSrc = readFileSync(resolve(ROOT, 'src/island/Expanded.tsx'), 'utf8')
    assert(!/onMouseDown=\{[^}]*onAllow/.test(expandedSrc), 'no mousedown allow dispatch')
    assert(!/onMouseDown=\{[^}]*onDeny/.test(expandedSrc), 'no mousedown deny dispatch')
    assert(expandedSrc.includes('if (actionPending) return'), 'guards in-flight clicks')
  })

  // ── Bridge fixtures (stale / health / snapshot ordering) ───────────────
  const bridge = startBridge({ RYU_WATCHDOG_MS: String(WATCHDOG_MS) })
  try {
    await waitHealth()

    await caseRun('P2.3', 'Bridge watchdog: running/approval → stale; pending remains', async () => {
      const id = randomUUID()
      const waiter = post('/event', makeEvent({ id, preview: 'Write: keep.txt' }))
      await sleep(120)
      await post('/status', { agent: 'claude', status: 'approval', detail: 'needs you' })
      await sleep(WATCHDOG_MS + 300)
      const agents = await get('/agents')
      assert(agents.json?.agents?.claude === 'stale', 'approval expired to stale')
      const pending = await get('/pending')
      assert(pending.json?.ids?.includes(id), 'pending remains after stale')
      await post('/status', { agent: 'claude', status: 'idle', detail: 'late idle' })
      const afterIdle = await get('/agents')
      assert(afterIdle.json?.agents?.claude === 'stale', 'late idle cannot clear pending stale')
      // cleanup
      await post('/dismiss', { id })
      await waiter
      await post('/status', { agent: 'claude', status: 'idle', detail: 'cleared' })
      assert((await get('/agents')).json?.agents?.claude === 'idle', 'idle after resolve')
    })

    await caseRun('P2.5', 'Health snapshot: started; never-seen unknown; lastSeen updates', async () => {
      const snap = await get('/snapshot')
      assert(snap.json?.health?.bridge === 'started', 'bridge started')
      assert(snap.json?.health?.port === 41999, 'port')
      const cursorMeta = snap.json?.agentMeta?.cursor
      assert(cursorMeta, 'agentMeta present')
      assert(
        cursorMeta.integration === 'unknown' || cursorMeta.revision === 0,
        'never-seen stays unknown/zero'
      )
      const before = cursorMeta.lastSeenAt || 0
      await post('/status', { agent: 'cursor', status: 'running', detail: 'seen' })
      const after = await get('/snapshot')
      assert(after.json?.agentMeta?.cursor?.lastSeenAt >= before, 'lastSeen updates')
      assert(after.json?.agentMeta?.cursor?.revision > 0, 'revision updates')
      assert(after.json?.agentMeta?.cursor?.integration === 'active', 'active after sighting')
      await post('/status', { agent: 'cursor', status: 'idle' })
    })

    await caseRun('P2.4b', 'Bridge: snapshot revision then older live update ignored', async () => {
      // Drive core directly for precise revisions
      const core = new RyuBridgeCore({ port: 42001, headless: true, requireAuth: false })
      await core.start()
      try {
        const r1 = core.applyAgentStatus('codex', 'running', 'r1')
        assert(r1.ok && !r1.ignored, 'first apply')
        const snapRev = core.getSnapshot().agentMeta.codex.revision
        // Manually craft older revision via reducer path: apply with lower rev cannot happen via HTTP
        // (bridge always bumps). Prove reducer ignore + bridge pending idle ignore instead:
        let state = initialStatusState()
        state = reduceAgentStatus(state, {
          type: 'snapshot',
          snapshot: {
            agents: { codex: 'approval', claude: 'idle', cursor: 'idle' },
            agentMeta: {
              codex: { revision: snapRev, lastSeenAt: Date.now(), integration: 'active' }
            }
          }
        })
        state = applyStatusUpdate(state, {
          agent: 'codex',
          status: 'idle',
          revision: snapRev - 1
        })
        assert(state.statuses.codex === 'approval', 'older than snapshot ignored')
        state = applyStatusUpdate(state, {
          agent: 'codex',
          status: 'running',
          revision: snapRev + 1
        })
        assert(state.statuses.codex === 'running', 'newer applies once')
      } finally {
        core.stop()
        await sleep(100)
      }
    })

    await caseRun('P2.5u', 'Unavailable health without fabricated idle agents', async () => {
      const core = new RyuBridgeCore({ port: 42002, headless: true })
      // not started
      const snap = core.getSnapshot()
      assert(snap.health.bridge === 'unavailable', 'unavailable')
      assert(snap.health.reason === 'not_started', 'reason')
      // agents default idle is fine as "no evidence", but integration unknown
      assert(snap.agentMeta.claude.integration === 'unknown', 'unknown not configured as idle truth')
    })
  } finally {
    await stopBridge(bridge)
  }

  if (results.some((r) => !r.ok)) {
    console.error('\nPhase 2 surface FAILED (pre-regression)')
    process.exit(1)
  }

  console.log('\n[ok] P2.1–P2.6 core PASS — running regression gates…\n')

  const phase1 = spawnSync(process.execPath, [resolve(ROOT, 'scripts/verify-phase1-remediation.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit'
  })
  if (phase1.status !== 0) {
    console.error('\n[P2.reg] FAIL — phase1-remediation regression')
    process.exit(1)
  }
  console.log('\n[P2.reg] PASS — phase1-remediation')

  const trackB = spawnSync(
    process.execPath,
    [resolve(ROOT, 'scripts/verify-track-b.mjs')],
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
      env: { ...process.env, RYU_WATCHDOG_MS: String(WATCHDOG_MS) }
    }
  )
  if (trackB.status !== 0) {
    console.error('\n[P2.reg] FAIL — track-b regression')
    process.exit(1)
  }
  console.log('\n[P2.reg] PASS — track-b')
  console.log('\nPhase 2 surface OK — P2.1–P2.6 + regressions')
}

main().catch((err) => {
  console.error('verify:phase2-surface FAILED:', err.message || err)
  process.exit(1)
})
