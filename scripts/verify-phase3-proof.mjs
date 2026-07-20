#!/usr/bin/env node
/**
 * Phase 3 production-proof gate — P3.1–P3.6
 *
 * 1) Remote contracts (always)
 * 2) Electron smoke (required — fails clearly if not runnable)
 * 3) Phase 2 surface regression
 *
 * Never reports Home live proof as passed.
 */

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from './ryu-test-util.mjs'
import { runPhase3Remote } from './verify-phase3-remote.mjs'
import { electronSmokeAvailable, runElectronSmoke } from './electron-smoke.mjs'

function run(cmd, args, env = {}) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    env: { ...process.env, ...env }
  })
}

async function main() {
  console.log('Phase 3 proof verify — P3.1–P3.6\n')
  console.log('Evidence labels: Remote contract | Electron smoke')
  console.log('Home live proof is never auto-passed.\n')

  const remote = await runPhase3Remote()
  if (!remote.ok) {
    console.error('\nPhase 3 proof FAILED — remote contracts')
    process.exit(1)
  }

  // Ensure app is built before Electron smoke
  console.log('\n[build] electron-vite build for Electron smoke…\n')
  const build = run(process.execPath, [resolve(ROOT, 'node_modules/electron-vite/bin/electron-vite.js'), 'build'])
  if (build.status !== 0) {
    console.error('\n[build] FAIL — cannot run Electron smoke without a build')
    process.exit(1)
  }

  const avail = electronSmokeAvailable()
  if (!avail.ok) {
    console.error(`\n[Electron smoke] NOT RUNNABLE in this environment (${avail.reason})`)
    console.error('Phase 3 proof gate requires a supported Electron/display environment.')
    console.error('Do not treat remote contracts alone as Phase 3 complete.')
    process.exit(1)
  }

  let smoke
  if (process.platform === 'linux' && process.env.RYU_FORCE_XVFB === '1') {
    // Optional explicit xvfb wrap for headless CI agents
    const wrapped = run('xvfb-run', [
      '-a',
      process.execPath,
      resolve(ROOT, 'scripts/electron-smoke.mjs')
    ])
    smoke = { ok: wrapped.status === 0, runnable: true }
  } else {
    smoke = await runElectronSmoke()
  }

  if (!smoke.ok) {
    console.error('\nPhase 3 proof FAILED — Electron smoke')
    process.exit(1)
  }

  console.log('\n[ok] P3.1–P3.4 smoke PASS — running Phase 2 regression gate…\n')
  const phase2 = run(process.execPath, [resolve(ROOT, 'scripts/verify-phase2-surface.mjs')])
  if (phase2.status !== 0) {
    console.error('\n[P3.reg] FAIL — phase2-surface regression')
    process.exit(1)
  }
  console.log('\n[P3.reg] PASS — phase2-surface')
  console.log('\nPhase 3 proof OK — remote contracts + Electron smoke + Phase 2 gate')
  console.log('Home live proof still required: docs/HOME-PHASE3.md')
  console.log('P3.7 expansion decision only after home evidence is recorded.')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('verify:phase3-proof FAILED:', err.message || err)
    process.exit(1)
  })
}
