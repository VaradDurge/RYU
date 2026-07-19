#!/usr/bin/env node
/**
 * Cursor IDE permission gate (DISABLED by default).
 *
 * Gating every preToolUse / beforeShellExecution through RYU is too noisy.
 * Status rings use ryu-cursor-status.mjs instead.
 *
 * To re-enable the dock gate (experimental): set RYU_CURSOR_GATE=1
 * and add this script back to .cursor/hooks.json.
 */

import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function log(line) {
  try {
    const dir = join(homedir(), '.ryu')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'cursor-hook.log'), `${new Date().toISOString()} ${line}\n`)
  } catch {
    // ignore
  }
}

// Drain stdin so Cursor doesn't hang, then exit without gating.
async function drain() {
  try {
    for await (const _ of process.stdin) {
      // discard
    }
  } catch {
    // ignore
  }
}

await drain()

if (process.env.RYU_CURSOR_GATE === '1') {
  log('gate-enabled but hooks.json should invoke the full gate implementation — exiting fail-open')
}

log('permission-gate skipped (status-only mode)')
process.exit(0)
