#!/usr/bin/env node
/**
 * Installs RYU Codex PermissionRequest + PreToolUse hooks into ~/.codex/hooks.json
 * (sidecar — does not rewrite config.toml).
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const hookPath = resolve(__dirname, '../hooks/ryu-codex-hook.mjs')
const hooksPath = join(homedir(), '.codex', 'hooks.json')

function load() {
  if (!existsSync(hooksPath)) return { hooks: {} }
  try {
    return JSON.parse(readFileSync(hooksPath, 'utf8'))
  } catch {
    console.error('[ryu] Could not parse ~/.codex/hooks.json — aborting.')
    process.exit(1)
  }
}

function scrub(list) {
  return (list || []).filter((entry) => {
    const cmds = entry?.hooks?.map((h) => h.command).join(' ') || ''
    return !cmds.includes('ryu-codex-hook.mjs')
  })
}

mkdirSync(dirname(hooksPath), { recursive: true })
if (existsSync(hooksPath)) {
  const backup = `${hooksPath}.ryu-backup-${Date.now()}`
  copyFileSync(hooksPath, backup)
  console.log(`[ryu] Backed up Codex hooks to ${backup}`)
}

const settings = load()
if (!settings.hooks) settings.hooks = {}

const command = `node "${hookPath.replace(/\\/g, '/')}"`
const entry = {
  matcher: 'Bash|Write|Edit|apply_patch|.*',
  hooks: [{ type: 'command', command, timeout: 600 }]
}

for (const name of ['PermissionRequest', 'PreToolUse']) {
  settings.hooks[name] = scrub(settings.hooks[name])
  settings.hooks[name].push(entry)
}

writeFileSync(hooksPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
console.log(`[ryu] Installed Codex hooks → ${hooksPath}`)
console.log(`[ryu] command: ${command}`)
console.log('[ryu] Start RYU (`npm run dev`), then trust hooks in Codex (/hooks) if prompted.')
console.log('[ryu] Codex Resume: permission → dock → Approve/Deny')
