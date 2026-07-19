#!/usr/bin/env node
/**
 * Installs RYU Claude Code hooks:
 * - PermissionRequest + PreToolUse → ryu-hook.mjs (dock Approve/Deny)
 * - Lifecycle status → ryu-claude-status.mjs (green/yellow/blue rings)
 * Windows + WSL (WSL uses Windows node.exe so 127.0.0.1 reaches RYU).
 */

import { execSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const permHookPath = resolve(__dirname, '../hooks/ryu-hook.mjs')
const statusHookPath = resolve(__dirname, '../hooks/ryu-claude-status.mjs')
const wslInstallerPath = resolve(__dirname, 'install-claude-hook-wsl.mjs')
const nodePath = process.execPath

/** Lifecycle events: status only (no matcher). */
const STATUS_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'Stop',
  'StopFailure',
  'SessionEnd',
  'SubagentStart'
]

function toWslPath(absWinPath) {
  const normalized = resolve(absWinPath).replace(/\\/g, '/')
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/)
  if (!match) return normalized
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`
}

function windowsNodePath() {
  if (process.platform === 'win32' && nodePath.toLowerCase().endsWith('node.exe')) {
    return nodePath
  }
  const fallbacks = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe'
  ]
  for (const p of fallbacks) {
    if (existsSync(p)) return p
  }
  console.error('[ryu] Need Windows node.exe for WSL Claude hooks (Linux localhost ≠ RYU).')
  process.exit(1)
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

function installIntoSettings(settingsPath, label, node, permPath, statusPath) {
  function loadSettings() {
    if (!existsSync(settingsPath)) return {}
    try {
      return JSON.parse(readFileSync(settingsPath, 'utf8'))
    } catch {
      console.error(`[ryu] Could not parse ${settingsPath} — aborting.`)
      process.exit(1)
    }
  }

  mkdirSync(dirname(settingsPath), { recursive: true })

  if (existsSync(settingsPath)) {
    const backup = `${settingsPath}.ryu-backup-${Date.now()}`
    copyFileSync(settingsPath, backup)
    console.log(`[ryu] Backed up ${label} settings to ${backup}`)
  }

  const settings = loadSettings()
  if (!settings.hooks) settings.hooks = {}

  for (const eventName of STATUS_EVENTS) {
    settings.hooks[eventName] = scrubRyu(settings.hooks[eventName])
    settings.hooks[eventName].push({
      hooks: [statusCmd(node, statusPath, eventName)]
    })
  }

  // PostToolUse — keep green while tools finish
  settings.hooks.PostToolUse = scrubRyu(settings.hooks.PostToolUse)
  settings.hooks.PostToolUse.push({
    matcher: '.*',
    hooks: [statusCmd(node, statusPath, 'PostToolUse')]
  })

  // PreToolUse + PermissionRequest — status then permission (same as Cursor)
  for (const eventName of ['PreToolUse', 'PermissionRequest']) {
    settings.hooks[eventName] = scrubRyu(settings.hooks[eventName])
    settings.hooks[eventName].push({
      matcher: 'Bash|Write|Edit',
      hooks: [
        statusCmd(node, statusPath, eventName),
        permCmd(node, permPath)
      ]
    })
  }

  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  console.log(`[ryu] Installed Claude status + permission hooks (${label}) → ${settingsPath}`)
  console.log(`[ryu] node: ${node}`)
  console.log(`[ryu] permission: ${permPath}`)
  console.log(`[ryu] status: ${statusPath}`)
}

function installWslHook() {
  try {
    execSync('wsl -e true', { stdio: 'pipe' })
  } catch {
    console.log('[ryu] WSL not available — skipped WSL hook install.')
    return
  }

  const winNode = windowsNodePath()
  const wslInstaller = toWslPath(wslInstallerPath)
  const result = spawnSync(
    'wsl',
    [
      '-e',
      'node',
      wslInstaller,
      permHookPath.replace(/\\/g, '/'),
      winNode.replace(/\\/g, '/'),
      statusHookPath.replace(/\\/g, '/')
    ],
    { encoding: 'utf8' }
  )
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    console.error('[ryu] WSL hook install failed.')
    process.exit(result.status || 1)
  }
}

if (process.platform === 'win32') {
  installIntoSettings(
    join(homedir(), '.claude', 'settings.json'),
    'Windows',
    nodePath,
    permHookPath,
    statusHookPath
  )
} else {
  console.log('[ryu] Skipping Windows Claude settings (not running on win32).')
}
installWslHook()

console.log('[ryu] Claude ≈ Cursor: status rings + PermissionRequest → dock Approve/Deny')
console.log('[ryu] WSL Claude must use Windows node.exe — Linux node cannot reach RYU.')
console.log('[ryu] Start RYU (`npm run dev`) before using Claude Code.')
console.log('[ryu] Restart Claude Code after install.')
console.log('[ryu] Debug: %USERPROFILE%\\.ryu\\hook.log · claude-hook.log')
console.log('[ryu] Prove: npm run verify:claude-status && npm run verify:claude-resume')
