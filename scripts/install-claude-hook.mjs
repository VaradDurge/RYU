#!/usr/bin/env node
/**
 * Installs RYU Claude Code hooks:
 * - PreToolUse → ryu-hook.mjs (Approve/Deny for Bash|Write|Edit)
 * - SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / Stop / SessionEnd
 *   → ryu-claude-status.mjs (green/blue/yellow rings)
 *
 * Backs up existing settings before writing.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const permissionHookPath = resolve(__dirname, '../hooks/ryu-hook.mjs')
const statusHookPath = resolve(__dirname, '../hooks/ryu-claude-status.mjs')
const settingsPath = join(homedir(), '.claude', 'settings.json')

function loadSettings() {
  if (!existsSync(settingsPath)) return {}
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8'))
  } catch {
    console.error('[ryu] Could not parse existing settings.json — aborting.')
    process.exit(1)
  }
}

function stripRyuHooks(entries) {
  if (!Array.isArray(entries)) return []
  return entries.filter((entry) => {
    const cmds = entry?.hooks?.map((h) => h.command).join(' ') || ''
    return !cmds.includes('ryu-hook.mjs') && !cmds.includes('ryu-claude-status.mjs')
  })
}

function statusCommand() {
  return `node "${statusHookPath.replace(/\\/g, '/')}"`
}

/** @param {string | undefined} matcher */
function statusEntry(matcher) {
  const entry = {
    hooks: [{ type: 'command', command: statusCommand() }]
  }
  if (matcher) entry.matcher = matcher
  return entry
}

const settings = loadSettings()
const dir = dirname(settingsPath)
mkdirSync(dir, { recursive: true })

if (existsSync(settingsPath)) {
  const backup = `${settingsPath}.ryu-backup-${Date.now()}`
  copyFileSync(settingsPath, backup)
  console.log(`[ryu] Backed up settings to ${backup}`)
}

if (!settings.hooks) settings.hooks = {}

const permissionCommand = `node "${permissionHookPath.replace(/\\/g, '/')}"`

// --- PreToolUse: permission gate + status heartbeat ---
settings.hooks.PreToolUse = stripRyuHooks(settings.hooks.PreToolUse)
settings.hooks.PreToolUse.push({
  matcher: 'Bash|Write|Edit',
  hooks: [{ type: 'command', command: permissionCommand }]
})
settings.hooks.PreToolUse.push(statusEntry())

// --- Lifecycle status ---
const lifecycle = [
  ['SessionStart', 'startup|resume|clear|compact'],
  ['UserPromptSubmit', undefined],
  ['PostToolUse', undefined],
  ['Stop', undefined],
  ['SessionEnd', undefined],
  ['StopFailure', undefined]
]

for (const [key, matcher] of lifecycle) {
  settings.hooks[key] = stripRyuHooks(settings.hooks[key])
  settings.hooks[key].push(statusEntry(matcher))
}

writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')

console.log(`[ryu] Installed Claude hooks → ${settingsPath}`)
console.log(`[ryu] Permission: ${permissionCommand}`)
console.log(`[ryu] Status:     ${statusCommand()}`)
console.log('[ryu] Start RYU (`npm run dev`) before using Claude Code.')
console.log('[ryu] Then run a Claude task — dock shows green (running) / yellow (permission) / blue (idle).')
console.log('[ryu] To uninstall: restore the .ryu-backup-* file or remove ryu-* entries from hooks.')
