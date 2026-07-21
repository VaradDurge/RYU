#!/usr/bin/env node
/**
 * Phase 3 remote contracts (no Electron window required).
 * Labels: Remote contract
 */

import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { RyuBridgeCore, computeInteractiveBounds } from '../shared/bridge-core.mjs'
import { reduceIsland } from '../shared/island-reducer.mjs'
import { ROOT, makeEvent, sleep } from './ryu-test-util.mjs'

const results = []

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function caseRun(id, label, fn) {
  try {
    await fn()
    console.log(`[${id}] PASS — ${label} (Remote contract)`)
    results.push({ id, ok: true })
  } catch (err) {
    console.error(`[${id}] FAIL — ${label}: ${err.message || err}`)
    results.push({ id, ok: false, err: err.message || String(err) })
  }
}

function occupyPort(port) {
  const server = createServer((_req, res) => {
    res.writeHead(200)
    res.end('occupied')
  })
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolvePromise(server))
  })
}

export async function runPhase3Remote() {
  console.log('Phase 3 remote contracts — P3.1/P3.3/P3.4/P3.6 (no Electron window)\n')

  await caseRun('P3.1r', 'Electron bridge wrapper imports shared bridge-core only', async () => {
    const bridgeSrc = readFileSync(resolve(ROOT, 'electron/bridge.ts'), 'utf8')
    const mainSrc = readFileSync(resolve(ROOT, 'electron/main.ts'), 'utf8')
    assert(bridgeSrc.includes("from '../shared/bridge-core.mjs'"), 'bridge imports core')
    assert(!bridgeSrc.includes('createServer'), 'wrapper is not a second HTTP server')
    assert(mainSrc.includes('new RyuBridge()'), 'main uses RyuBridge wrapper')
    assert(mainSrc.includes('ryu:diagnostics'), 'diagnostics IPC present')
    assert(mainSrc.includes('ryu:retryBridge'), 'retry IPC present')
    assert(bridgeSrc.includes('getDiagnostics'), 'diagnostics method present')
    assert(!/token:\s*this\.getToken/.test(bridgeSrc), 'diagnostics must not expose token')
  })

  await caseRun('P3.3r', 'Interactive bounds cover modes and never full work area', async () => {
    const area = { x: 10, y: 20, width: 1920, height: 1080 }
    for (const mode of ['idle', 'attention', 'dock', 'expanded', 'resolved', 'unavailable']) {
      const b = computeInteractiveBounds(area, mode)
      assert(b.width < area.width, `${mode} width bounded`)
      assert(b.height < area.height, `${mode} height bounded`)
      assert(b.y === area.y, `${mode} top-anchored`)
      assert(Math.abs(b.x + b.width / 2 - (area.x + area.width / 2)) < 2, `${mode} centered`)
    }
    const expanded = computeInteractiveBounds(area, 'expanded')
    const idle = computeInteractiveBounds(area, 'idle')
    assert(expanded.height > idle.height, 'expanded taller than idle')
  })

  await caseRun('P3.2r', 'Renderer hydrate/reload contract stays attention (not fabricated idle)', async () => {
    const e1 = makeEvent({ id: 'p32-a', preview: 'Write: a.txt' })
    const e2 = makeEvent({ id: 'p32-b', preview: 'Write: b.txt' })
    let state = reduceIsland(undefined, { type: 'hydrate', events: [e1, e2] })
    assert(state.mode === 'attention' && state.current?.id === 'p32-a', 'hydrate attention')
    // simulate reload: re-hydrate same snapshot → still one current + queue
    state = reduceIsland(undefined, { type: 'hydrate', events: [e1, e2] })
    assert(state.queue.length === 1 && state.current?.id === 'p32-a', 'reload preserves fifo')
    state = reduceIsland(state, { type: 'actionStart' })
    state = reduceIsland(state, { type: 'actionFail', reason: 'unavailable' })
    assert(state.mode === 'attention' && state.actionError === 'unavailable', 'fail keeps card')
  })

  await caseRun('P3.4r', 'Occupied port → unavailable; free + restart same port → started', async () => {
    const port = 42111
    const home = mkdtempSync(join(tmpdir(), 'ryu-p34-'))
    const blocker = await occupyPort(port)
    const failed = new RyuBridgeCore({ port, headless: true, homeDir: home })
    let startErr = null
    try {
      await failed.start()
    } catch (err) {
      startErr = err
    }
    assert(startErr?.code === 'EADDRINUSE', 'EADDRINUSE on conflict')
    const unavailable = failed.getSnapshot()
    assert(unavailable.health.bridge === 'unavailable', 'unavailable health')
    assert(unavailable.health.reason === 'EADDRINUSE', 'reason recorded')
    await new Promise((r) => blocker.close(() => r()))
    await sleep(100)
    const ok = new RyuBridgeCore({ port, headless: true, homeDir: home })
    const bound = await ok.start()
    assert(bound === port, 'same port rebound')
    assert(ok.getSnapshot().health.bridge === 'started', 'started after free')
    ok.stop()
    rmSync(home, { recursive: true, force: true })
  })

  await caseRun('P3.6r', 'Trust copy + no token leak in renderer/preload/diagnostics surface', async () => {
    const files = [
      'src/island/Expanded.tsx',
      'src/island/AgentStatusCard.tsx',
      'src/App.tsx',
      'electron/preload.ts',
      'electron/bridge.ts',
      'electron/main.ts'
    ]
    for (const rel of files) {
      const src = readFileSync(resolve(ROOT, rel), 'utf8')
      assert(!/all data stays on this device/i.test(src), `${rel}: overclaim copy`)
      assert(!/Local mode — All data/i.test(src), `${rel}: old local-mode copy`)
      // diagnostics/logging must not print token values
      assert(!/console\.(log|info|debug).*token/i.test(src), `${rel}: token log`)
    }
    const preload = readFileSync(resolve(ROOT, 'electron/preload.ts'), 'utf8')
    assert(!preload.includes('getToken'), 'preload must not expose getToken')
    const expanded = readFileSync(resolve(ROOT, 'src/island/Expanded.tsx'), 'utf8')
    assert(expanded.includes('loopback only'), 'accurate loopback copy present')

    // release checklist exists
    const checklist = readFileSync(resolve(ROOT, 'docs/RELEASE-CHECKLIST.md'), 'utf8')
    assert(/same-user/i.test(checklist), 'limitation documented')
    assert(/loopback/i.test(checklist), 'loopback documented')
  })

  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    console.error('\nPhase 3 remote contracts FAILED')
    return { ok: false, results }
  }
  console.log('\n[ok] Phase 3 remote contracts PASS')
  return { ok: true, results }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPhase3Remote()
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
