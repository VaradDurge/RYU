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

/**
 * Windows node.exe does not understand /mnt/c/... paths.
 * Hook script args must be Windows paths (C:\...), while the command
 * itself is the WSL-visible /mnt/c/.../node.exe so Claude-in-WSL can exec it.
 */
function toWindowsPath(absPath) {
  const normalized = String(absPath).replace(/\\/g, '/')
  if (normalized.startsWith('/mnt/')) {
    const match = normalized.match(/^\/mnt\/([a-zA-Z])\/(.*)$/)
    if (!match) return absPath
    return `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, '\\')}`
  }
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/)
  if (match) return `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, '\\')}`
  return absPath
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
const permPathWsl = toWslPath(winPermPath)
const statusPathWsl = toWslPath(winStatusPath)
// Args for Windows node.exe — must be C:\... not /mnt/c/...
const permPathWin = toWindowsPath(winPermPath)
const statusPathWin = toWindowsPath(winStatusPath)

if (!existsSync(permPathWsl) || !existsSync(statusPathWsl)) {
  console.error(`[ryu:wsl] Hook missing: perm=${permPathWsl} status=${statusPathWsl}`)
  process.exit(1)
}

if (!settings.hooks) settings.hooks = {}

for (const eventName of STATUS_EVENTS) {
  settings.hooks[eventName] = scrubRyu(settings.hooks[eventName])
  settings.hooks[eventName].push({
    hooks: [statusCmd(nodePath, statusPathWin, eventName)]
  })
}

settings.hooks.PostToolUse = scrubRyu(settings.hooks.PostToolUse)
settings.hooks.PostToolUse.push({
  matcher: '.*',
  hooks: [statusCmd(nodePath, statusPathWin, 'PostToolUse')]
})

for (const eventName of ['PreToolUse', 'PermissionRequest']) {
  settings.hooks[eventName] = scrubRyu(settings.hooks[eventName])
  settings.hooks[eventName].push({
    matcher: 'Bash|Write|Edit',
    hooks: [statusCmd(nodePath, statusPathWin, eventName), permCmd(nodePath, permPathWin)]
  })
}

writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')

// Prove Windows node can load the ESM hook with a Windows path (the SessionStart failure mode).
const loadProbe = spawnSync(nodePath, [statusPathWin, 'SessionStart'], {
  encoding: 'utf8',
  timeout: 8000,
  input: '{}'
})
if (loadProbe.status === 0) {
  console.log('[ryu:wsl] Status hook loads under Windows node (SessionStart smoke OK)')
} else {
  console.log('[ryu:wsl] Warning: status hook failed under Windows node — check paths')
  if (loadProbe.stderr) console.log(`[ryu:wsl] ${loadProbe.stderr.trim().slice(0, 400)}`)
  if (loadProbe.stdout) console.log(`[ryu:wsl] ${loadProbe.stdout.trim().slice(0, 200)}`)
}

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
  console.log('[ryu:wsl] Warning: bridge not reachable yet — start RYU on Windows (`npm run dev`) before Claude.')
  if (probe.stderr) console.log(`[ryu:wsl] ${probe.stderr.trim()}`)
}

console.log(`[ryu:wsl] Installed Claude status + permission → ${settingsPath}`)
console.log(`[ryu:wsl] node (exec from WSL): ${nodePath}`)
console.log(`[ryu:wsl] permission (Windows path for node.exe): ${permPathWin}`)
console.log(`[ryu:wsl] status (Windows path for node.exe): ${statusPathWin}`)
console.log('[ryu:wsl] Restart Claude Code in WSL after install.')
