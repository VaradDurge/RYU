#!/usr/bin/env node
/**
 * Installs RYU Claude status + permission hooks into WSL Claude settings.
 * Must use Windows node.exe (via /mnt/c/...) so hooks hit Windows 127.0.0.1.
 *
 * argv: <winPermHook> <winNode> <winStatusHook>
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const winPermPath = process.argv[2]
const winNodePath = process.argv[3]
const winStatusPath = process.argv[4]
if (!winPermPath || !winNodePath || !winStatusPath) {
  console.error('[ryu:wsl] Usage: install-claude-hook-wsl.mjs <permHook> <winNode> <statusHook>')
  process.exit(1)
}

const STATUS_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'Stop',
  'StopFailure',
  'SessionEnd',
  'SubagentStart'
]

function toWslPath(absWinPath) {
  const normalized = String(absWinPath).replace(/\\/g, '/')
  if (normalized.startsWith('/mnt/')) return normalized
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/)
  if (!match) return normalized
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`
}

function resolveWindowsNode(preferred) {
  const candidates = [
    toWslPath(preferred),
    '/mnt/c/Program Files/nodejs/node.exe',
    '/mnt/c/Program Files (x86)/nodejs/node.exe'
  ]
  for (const c of candidates) {
    if (c.toLowerCase().endsWith('node.exe') && existsSync(c)) return c
  }
  console.error('[ryu:wsl] Could not find Windows node.exe under /mnt/c/…')
  process.exit(1)
}

const settingsPath = join(homedir(), '.claude', 'settings.json')

function loadSettings() {
  if (!existsSync(settingsPath)) return {}
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8'))
  } catch {
    console.error('[ryu:wsl] Could not parse existing settings.json — aborting.')
    process.exit(1)
  }
}

function scrubRyu(list) {
  return (list || []).filter((hookEntry) => {
    const args =
      hookEntry?.hooks?.map((h) => `${h.command} ${(h.args || []).join(' ')}`).join(' ') || ''
    return !args.includes('ryu-hook.mjs') && !args.includes('ryu-claude-status.mjs')
  })
}

function statusCmd(node, statusPath, eventName) {
  return {
    type: 'command',
    command: node,
    args: [statusPath, eventName],
    timeout: 10
  }
}

function permCmd(node, permPath) {
  return {
    type: 'command',
    command: node,
    args: [permPath],
    timeout: 600
  }
}

mkdirSync(dirname(settingsPath), { recursive: true })

if (existsSync(settingsPath)) {
  const backup = `${settingsPath}.ryu-backup-${Date.now()}`
  copyFileSync(settingsPath, backup)
  console.log(`[ryu:wsl] Backed up settings to ${backup}`)
}

const settings = loadSettings()
const nodePath = resolveWindowsNode(winNodePath)
const permPath = toWslPath(winPermPath)
const statusPath = toWslPath(winStatusPath)

if (!existsSync(permPath) || !existsSync(statusPath)) {
  console.error(`[ryu:wsl] Hook missing: perm=${permPath} status=${statusPath}`)
  process.exit(1)
}

if (!settings.hooks) settings.hooks = {}

for (const eventName of STATUS_EVENTS) {
  settings.hooks[eventName] = scrubRyu(settings.hooks[eventName])
  settings.hooks[eventName].push({
    hooks: [statusCmd(nodePath, statusPath, eventName)]
  })
}

settings.hooks.PostToolUse = scrubRyu(settings.hooks.PostToolUse)
settings.hooks.PostToolUse.push({
  matcher: '.*',
  hooks: [statusCmd(nodePath, statusPath, 'PostToolUse')]
})

for (const eventName of ['PreToolUse', 'PermissionRequest']) {
  settings.hooks[eventName] = scrubRyu(settings.hooks[eventName])
  settings.hooks[eventName].push({
    matcher: 'Bash|Write|Edit',
    hooks: [statusCmd(nodePath, statusPath, eventName), permCmd(nodePath, permPath)]
  })
}

writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')

const probe = spawnSync(
  nodePath,
  [
    '-e',
    'fetch("http://127.0.0.1:41999/health").then(r=>r.json()).then(j=>console.log(JSON.stringify(j))).catch(e=>{console.error(e.message); process.exit(2)})'
  ],
  { encoding: 'utf8', timeout: 8000 }
)
if (probe.status === 0) {
  console.log(`[ryu:wsl] Bridge reachable via Windows node: ${probe.stdout.trim()}`)
} else {
  console.log('[ryu:wsl] Warning: bridge not reachable yet — start RYU (`npm run dev`) before Claude.')
  if (probe.stderr) console.log(`[ryu:wsl] ${probe.stderr.trim()}`)
}

console.log(`[ryu:wsl] Installed Claude status + permission → ${settingsPath}`)
console.log(`[ryu:wsl] node: ${nodePath}`)
console.log(`[ryu:wsl] permission: ${permPath}`)
console.log(`[ryu:wsl] status: ${statusPath}`)
console.log('[ryu:wsl] Restart Claude Code in WSL after install.')
