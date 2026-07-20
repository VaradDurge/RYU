#!/usr/bin/env node
/**
 * Phase 3 Electron smoke — real main/preload/renderer path via Playwright.
 * Labels: Electron smoke
 *
 * Requires: built app (`npm run build`), Electron + display (or xvfb-run).
 * Uses one Electron process for all cases to avoid flaky relaunch hangs.
 */

import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { _electron as electron } from 'playwright'
import { ROOT, sleep } from './ryu-test-util.mjs'

const results = []
const MAIN = resolve(ROOT, 'out/main/index.js')
const ELECTRON_BIN = resolve(ROOT, 'node_modules/electron/cli.js')
const SMOKE_PORT = 42121

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function caseRun(id, label, fn) {
  try {
    await fn()
    console.log(`[${id}] PASS — ${label} (Electron smoke)`)
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

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    sleep(ms).then(() => {
      throw new Error(`${label} timed out after ${ms}ms`)
    })
  ])
}

async function launchRyu(env = {}) {
  const userData = mkdtempSync(join(tmpdir(), 'ryu-udata-'))
  const home = mkdtempSync(join(tmpdir(), 'ryu-home-'))
  mkdirSync(join(home, '.ryu'), { recursive: true })
  const app = await withTimeout(
    electron.launch({
      args: [MAIN, '--no-sandbox', '--disable-gpu'],
      env: {
        ...process.env,
        RYU_SMOKE: '1',
        RYU_HOME: home,
        RYU_USER_DATA: userData,
        NODE_ENV: 'development',
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
        ...env
      },
      timeout: 30000
    }),
    35000,
    'electron.launch'
  )
  const page = await withTimeout(app.firstWindow(), 20000, 'firstWindow')
  await withTimeout(page.waitForLoadState('domcontentloaded'), 15000, 'domcontentloaded')
  await withTimeout(
    page.waitForFunction(() => Boolean(window.ryu?.getSnapshot), null, { timeout: 15000 }),
    16000,
    'preload ready'
  )
  return { app, page, home, userData }
}

async function closeRyu(ctx) {
  if (!ctx) return
  try {
    await withTimeout(ctx.app.close(), 4000, 'app.close')
  } catch {
    try {
      ctx.app.process()?.kill('SIGKILL')
    } catch {
      // ignore
    }
  }
  try {
    rmSync(ctx.home, { recursive: true, force: true })
    rmSync(ctx.userData, { recursive: true, force: true })
  } catch {
    // ignore
  }
  await sleep(400)
}

function readToken(home) {
  try {
    return readFileSync(join(home, '.ryu', 'token'), 'utf8').trim()
  } catch {
    return ''
  }
}

async function postAuthed(port, home, path, body) {
  const token = readToken(home)
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ryu-token': token
    },
    body: JSON.stringify(body)
  })
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) }
}

export function electronSmokeAvailable() {
  try {
    readFileSync(MAIN, 'utf8')
  } catch {
    return { ok: false, reason: 'app_not_built' }
  }
  try {
    readFileSync(ELECTRON_BIN, 'utf8')
  } catch {
    return { ok: false, reason: 'electron_missing' }
  }
  if (!process.env.DISPLAY && process.platform === 'linux') {
    return { ok: false, reason: 'no_display' }
  }
  return { ok: true }
}

export async function runElectronSmoke() {
  console.log('Phase 3 Electron smoke — real main/preload/renderer\n')
  const avail = electronSmokeAvailable()
  if (!avail.ok) {
    console.error(`[Electron smoke] NOT RUNNABLE — ${avail.reason}`)
    return { ok: false, runnable: false, reason: avail.reason, results }
  }

  // ── Healthy-path suite (single app) ────────────────────────────────────
  let ctx = await launchRyu({ RYU_PORT: String(SMOKE_PORT) })
  try {
    await caseRun('P3.1', 'Electron uses shared bridge-core; diagnostics omit token', async () => {
      const probe = await withTimeout(
        ctx.page.evaluate(async () => {
          if (!window.ryu?.smokeProbe) throw new Error('smokeProbe missing')
          return window.ryu.smokeProbe()
        }),
        10000,
        'smokeProbe'
      )
      assert(probe.ok && probe.usesSharedCore, 'shared core')
      assert(probe.core === 'shared/bridge-core', 'core identity')
      assert(probe.lifecycle === 'started', `lifecycle started, got ${probe.lifecycle}`)
      assert(probe.boundPort === SMOKE_PORT, 'bound port')
      assert(probe.hasTokenField === true, 'token field absent from diagnostics object')
      const diag = await withTimeout(
        ctx.page.evaluate(async () => window.ryu.getDiagnostics()),
        10000,
        'getDiagnostics'
      )
      assert(!('token' in diag), 'diagnostics has no token key')
      const health = await fetch(`http://127.0.0.1:${SMOKE_PORT}/health`).then((r) => r.json())
      assert(health.ok && health.bridge === 'started', 'HTTP health started')
    })

    // Run before reload — post-reload Electron/Playwright evaluate can wedge the session.
    await caseRun('P3.3', 'Diagnostics expose interactive bounds fields (bounded by remote P3.3r)', async () => {
      const diag = await withTimeout(
        ctx.page.evaluate(async () => window.ryu.getDiagnostics()),
        8000,
        'interactive diagnostics'
      )
      assert('interactive' in diag, 'interactive field present')
      assert('lastInteractiveBounds' in diag, 'lastInteractiveBounds field present')
      if (diag.lastInteractiveBounds) {
        assert(diag.lastInteractiveBounds.width < 1000, 'bounds width not full-screen')
        assert(diag.lastInteractiveBounds.height < 900, 'bounds height not full-screen')
      }
    })

    await caseRun('P3.2', 'Snapshot hydrate + reload recovers one pending via IPC', async () => {
      const id = 'p32-smoke-1'
      const pending = postAuthed(SMOKE_PORT, ctx.home, '/event', {
        id,
        agent: 'claude',
        sessionLabel: 'claude · smoke',
        tool: 'Write',
        preview: 'Write: smoke.txt',
        path: ROOT,
        risk: 'normal',
        ts: Date.now()
      })
      await sleep(250)
      const snap1 = await withTimeout(
        ctx.page.evaluate(async () => window.ryu.getSnapshot()),
        10000,
        'snapshot1'
      )
      assert(snap1.ids?.includes(id), 'snapshot has event')
      await withTimeout(ctx.page.reload({ waitUntil: 'domcontentloaded' }), 15000, 'reload')
      await withTimeout(
        ctx.page.waitForFunction(() => Boolean(window.ryu?.getSnapshot), null, { timeout: 15000 }),
        16000,
        'preload after reload'
      )
      await sleep(300)
      const snap2 = await withTimeout(
        ctx.page.evaluate(async () => window.ryu.getSnapshot()),
        10000,
        'snapshot2'
      )
      assert(snap2.ids?.includes(id), 'after reload snapshot still has event')
      assert(snap2.ids.filter((x) => x === id).length === 1, 'exactly one id')
      const dismissed = await withTimeout(
        ctx.page.evaluate(async (eventId) => window.ryu.dismiss(eventId), id),
        10000,
        'dismiss'
      )
      assert(dismissed.ok, 'dismiss ack')
      await withTimeout(pending, 10000, 'pending waiter')
    })
  } finally {
    await closeRyu(ctx)
    ctx = null
  }

  // ── Conflict / retry suite (separate app; port occupied at launch) ─────
  const conflictPort = 42124
  let blocker = null
  let conflictCtx = null
  try {
    blocker = await occupyPort(conflictPort)
    conflictCtx = await launchRyu({ RYU_PORT: String(conflictPort) })
    await caseRun('P3.4', 'EADDRINUSE → unavailable; retry same port after free → started', async () => {
      await sleep(400)
      const diag1 = await withTimeout(
        conflictCtx.page.evaluate(async () => window.ryu.getDiagnostics()),
        10000,
        'diag unavailable'
      )
      assert(diag1.lifecycle === 'unavailable', `expected unavailable, got ${diag1.lifecycle}`)
      assert(diag1.reason === 'EADDRINUSE', `expected EADDRINUSE, got ${diag1.reason}`)
      await new Promise((r) => blocker.close(() => r()))
      blocker = null
      await sleep(150)
      const retry = await withTimeout(
        conflictCtx.page.evaluate(async () => window.ryu.retryBridge()),
        15000,
        'retryBridge'
      )
      assert(retry.ok, `retry ok: ${JSON.stringify(retry)}`)
      const diag2 = await withTimeout(
        conflictCtx.page.evaluate(async () => window.ryu.getDiagnostics()),
        10000,
        'diag started'
      )
      assert(diag2.lifecycle === 'started', 'started after retry')
      assert(diag2.boundPort === conflictPort, 'same port')
      const retry2 = await withTimeout(
        conflictCtx.page.evaluate(async () => window.ryu.retryBridge()),
        10000,
        'retry2'
      )
      assert(retry2.ok === true || retry2.reason === 'retry_cooldown', 'coalesced/idempotent retry')
    })
  } finally {
    if (blocker) {
      try {
        await new Promise((r) => blocker.close(() => r()))
      } catch {
        // ignore
      }
    }
    await closeRyu(conflictCtx)
  }

  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    console.error('\nPhase 3 Electron smoke FAILED')
    return { ok: false, runnable: true, results }
  }
  console.log('\n[ok] Phase 3 Electron smoke PASS')
  return { ok: true, runnable: true, results }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runElectronSmoke()
    .then((r) => process.exit(r.ok ? 0 : 1))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
