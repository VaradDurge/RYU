#!/usr/bin/env node
/**
 * Installs RYU as a Claude Code PreToolUse hook.
 * Backs up existing settings before writing.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const hookPath = resolve(__dirname, '../hooks/ryu-hook.mjs')
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

const settings = loadSettings()
const dir = dirname(settingsPath)
mkdirSync(dir, { recursive: true })

if (existsSync(settingsPath)) {
  const backup = `${settingsPath}.ryu-backup-${Date.now()}`
  copyFileSync(settingsPath, backup)
  console.log(`[ryu] Backed up settings to ${backup}`)
}

const command = `node "${hookPath.replace(/\\/g, '/')}"`
const newHook = {
  matcher: 'Bash|Write|Edit',
  hooks: [
    {
      type: 'command',
      command
    }
  ]
}

if (!settings.hooks) settings.hooks = {}
if (!Array.isArray(settings.hooks.PreToolUse)) settings.hooks.PreToolUse = []

// Remove previous RYU entries
settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter((entry) => {
  const cmds = entry?.hooks?.map((h) => h.command).join(' ') || ''
  return !cmds.includes('ryu-hook.mjs')
})

settings.hooks.PreToolUse.push(newHook)

writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')

console.log(`[ryu] Installed PreToolUse hook → ${settingsPath}`)
console.log(`[ryu] Hook command: ${command}`)
console.log('[ryu] Start RYU (`npm run dev`) before using Claude Code.')
console.log('[ryu] To uninstall: restore the .ryu-backup-* file or remove the ryu-hook entry from hooks.PreToolUse.')
