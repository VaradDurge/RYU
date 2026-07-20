import { execFile, execSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import { clipboard, systemPreferences } from 'electron'
import type { RyuAgent } from '../../../shared/types'
import type { RyuBridge } from '../../../electron/bridge'

const execFileAsync = promisify(execFile)

function postKeysBin(): string {
  const candidates = [
    join(process.cwd(), 'diff/mac/electron/post-keys-to-pid'),
    join(homedir(), 'Documents/RYU/diff/mac/electron/post-keys-to-pid'),
    join(process.cwd(), 'diff/mac/electron/post-keys-to-pid.swift')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return candidates[0]
}

export type SendPromptPayload = {
  agent: RyuAgent
  text: string
  cwd?: string
}

export type SendPromptResult = { ok: boolean; error?: string }

function log(line: string): void {
  try {
    const dir = join(homedir(), '.ryu')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'prompt.log'), `${new Date().toISOString()} ${line}\n`)
  } catch {
    // ignore
  }
}

/**
 * Deliver a prompt without stealing focus.
 * Uses CGEventPostToPid (post-keys-to-pid) — the path that was working before
 * the broken focus-hop AppleScript.
 */
export async function spawnAgentPrompt(
  bridge: RyuBridge,
  payload: SendPromptPayload
): Promise<SendPromptResult> {
  const text = String(payload.text || '').trim()
  if (!text) return { ok: false, error: 'Empty prompt' }

  const agent = payload.agent
  if (agent === 'codex') {
    log(`codex skip: not wired`)
    return { ok: false, error: 'Codex prompt not wired yet' }
  }

  const cwd =
    (payload.cwd && payload.cwd.trim()) ||
    bridge.lastWorkspace ||
    process.cwd()

  const clip = text.length > 80 ? `${text.slice(0, 77)}…` : text

  try {
    if (process.platform === 'darwin') {
      const trusted = systemPreferences.isTrustedAccessibilityClient(false)
      if (!trusted) {
        systemPreferences.isTrustedAccessibilityClient(true)
        return fail(
          bridge,
          agent,
          cwd,
          'Enable Accessibility for RYU in System Settings then retry'
        )
      }
    }

    if (agent === 'claude') {
      const via = await injectClaudeBackground(text)
      log(`claude inject ok | out="${via}"`)
      markDelivered(bridge, agent, cwd, clip)
      return { ok: true }
    }

    await injectCursorBackground(text)
    log(`cursor inject ok | out="post-to-pid"`)
    markDelivered(bridge, agent, cwd, clip)
    return { ok: true }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    log(`${agent} inject FAIL | ${raw}`)
    return fail(bridge, agent, cwd, hintFromError(agent, raw))
  }
}

function markDelivered(
  bridge: RyuBridge,
  agent: RyuAgent,
  cwd: string,
  detail: string
): void {
  bridge.publishActivity({
    id: `${agent}-prompt-${Date.now()}`,
    agent,
    kind: 'prompt',
    title: 'You',
    detail,
    ts: Date.now(),
    path: cwd
  })
  bridge.publishStatus({
    agent,
    status: 'running',
    detail,
    session: 'open',
    path: cwd,
    quiet: true
  })
  setTimeout(() => {
    bridge.publishStatus({
      agent,
      status: 'idle',
      detail: 'Idle',
      session: 'open',
      path: cwd,
      quiet: true
    })
  }, 900)
}

function fail(
  bridge: RyuBridge,
  agent: RyuAgent,
  cwd: string,
  hint: string
): SendPromptResult {
  bridge.publishStatus({
    agent,
    status: 'error',
    detail: hint.slice(0, 80),
    session: 'open',
    path: cwd
  })
  setTimeout(() => {
    bridge.publishStatus({
      agent,
      status: 'idle',
      detail: 'Idle',
      session: 'open',
      path: cwd
    })
  }, 2200)
  return { ok: false, error: hint }
}

function hintFromError(agent: RyuAgent, raw: string): string {
  if (/not allowed|-1719|-1743|1002|assistive|accessibility|authorized/i.test(raw)) {
    return 'Enable Accessibility for RYU in System Settings then retry'
  }
  if (/not running|no cursor|no live/i.test(raw)) {
    return agent === 'cursor' ? 'Open Cursor first' : 'Start Claude Code then retry'
  }
  return 'Could not deliver to agent'
}

async function postKeysToPid(pid: number, chords: string[]): Promise<void> {
  const bin = postKeysBin()
  const args = bin.endsWith('.swift')
    ? ['swift', bin, String(pid), ...chords]
    : [bin, String(pid), ...chords]
  const { stdout, stderr } = await execFileAsync(args[0], args.slice(1), {
    timeout: 8000
  })
  const out = `${stdout || ''} ${stderr || ''}`
  if (!/\bok\b/i.test(out)) {
    throw new Error(out.trim() || 'post-keys failed')
  }
}

/** Paste into Cursor Agent chat via CGEventPostToPid — no activate. */
async function injectCursorBackground(text: string): Promise<void> {
  const pid = findCursorPid()
  if (!pid) throw new Error('no cursor process')

  const previous = clipboard.readText()
  clipboard.writeText(text)
  try {
    await postKeysToPid(pid, ['cmd+shift+v', 'cmd+return'])
  } finally {
    setTimeout(() => {
      try {
        clipboard.writeText(previous)
      } catch {
        // ignore
      }
    }, 400)
  }
}

/**
 * Type into Claude Code’s host app (usually Cursor’s terminal) via key events.
 * Never write raw bytes to /dev/ttys* — that paints orphaned output under `>`.
 */
async function injectClaudeBackground(text: string): Promise<string> {
  const found = findClaudeSession()
  if (!found) throw new Error('no live claude')

  const hostPid = findTerminalHostPid(found.pid) ?? findCursorPid()
  if (!hostPid) throw new Error('no live claude host')

  log(`claude pid=${found.pid} host=${hostPid} tty=${found.tty || '?'}`)

  const previous = clipboard.readText()
  clipboard.writeText(text)
  try {
    // Paste + Return into the terminal host (works when Claude’s `>` is focused)
    await postKeysToPid(hostPid, ['cmd+v', 'return'])
    return `host:${hostPid}`
  } finally {
    setTimeout(() => {
      try {
        clipboard.writeText(previous)
      } catch {
        // ignore
      }
    }, 400)
  }
}

function findClaudeSession(): { pid: number; tty: string | null } | null {
  try {
    const pids = execSync('pgrep -f claude', {
      encoding: 'utf8',
      timeout: 1500
    })
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    for (const token of pids.slice(0, 16)) {
      const pid = Number(token)
      if (!Number.isFinite(pid) || pid <= 0) continue
      let cmd = ''
      try {
        cmd = execSync(`ps -o command= -p ${pid}`, {
          encoding: 'utf8',
          timeout: 1000
        }).trim()
      } catch {
        continue
      }
      if (!/(^|[\/\s])claude(\s|$)/i.test(cmd)) continue
      if (/ryu-claude|claude-hook|Claude\.app/i.test(cmd)) continue

      let tty: string | null = null
      try {
        const t = execSync(`ps -o tty= -p ${pid}`, {
          encoding: 'utf8',
          timeout: 1000
        }).trim()
        if (t && t !== '??' && t !== '-') {
          tty = t.startsWith('/') ? t : `/dev/${t}`
        }
      } catch {
        // ignore
      }
      return { pid, tty }
    }
  } catch {
    // ignore
  }
  return null
}

const TERMINAL_HOST_RE =
  /Terminal|iTerm|Ghostty|Warp|Alacritty|kitty|WezTerm|Cursor|Code|Hyper|Tabby|rio/i

function findTerminalHostPid(claudePid: number): number | null {
  let pid = claudePid
  for (let depth = 0; depth < 12; depth++) {
    let args = ''
    let comm = ''
    try {
      args = execSync(`ps -o args= -p ${pid}`, {
        encoding: 'utf8',
        timeout: 1000
      }).trim()
      comm = execSync(`ps -o comm= -p ${pid}`, {
        encoding: 'utf8',
        timeout: 1000
      }).trim()
    } catch {
      break
    }

    if (
      TERMINAL_HOST_RE.test(args) ||
      TERMINAL_HOST_RE.test(comm) ||
      /\.app\/Contents\/MacOS\//i.test(args)
    ) {
      if (
        /Helper|renderer|GPU|plugin/i.test(args) &&
        !/Cursor\.app\/Contents\/MacOS\/Cursor(\s|$)/.test(args)
      ) {
        // keep walking
      } else if (
        /\/(Terminal|iTerm2|Ghostty|Warp|Alacritty|kitty|wezterm-gui|Cursor|Code|Hyper)\.app\//i.test(
          args
        ) ||
        /^(Terminal|iTerm2|Ghostty|Warp|Alacritty|kitty|Cursor|Code)$/i.test(comm)
      ) {
        log(`claude host via parent walk: ${pid} (${comm})`)
        return pid
      }
    }

    let ppid = 0
    try {
      ppid = Number(
        execSync(`ps -o ppid= -p ${pid}`, { encoding: 'utf8', timeout: 1000 }).trim()
      )
    } catch {
      break
    }
    if (!Number.isFinite(ppid) || ppid <= 1 || ppid === pid) break
    pid = ppid
  }

  const cursor = findCursorPid()
  if (cursor) {
    log(`claude host fallback Cursor: ${cursor}`)
    return cursor
  }
  return null
}

function findCursorPid(): number | null {
  try {
    const out = execSync(
      `osascript -e 'tell application "System Events" to get unix id of process "Cursor"'`,
      { encoding: 'utf8', timeout: 2500 }
    ).trim()
    const pid = Number(out.split(/\s+/)[0])
    if (Number.isFinite(pid) && pid > 0) {
      log(`cursor pid via System Events: ${pid}`)
      return pid
    }
  } catch (err) {
    log(
      `cursor pid System Events miss: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  try {
    const out = execSync('ps -axo pid=,args=', {
      encoding: 'utf8',
      timeout: 2500
    })
    for (const line of out.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (
        /\/Cursor\.app\/Contents\/MacOS\/Cursor(\s|$)/.test(trimmed) &&
        !/Helper/.test(trimmed)
      ) {
        const pid = Number(trimmed.split(/\s+/)[0])
        if (Number.isFinite(pid) && pid > 0) {
          log(`cursor pid via ps: ${pid}`)
          return pid
        }
      }
    }
  } catch (err) {
    log(`cursor pid ps miss: ${err instanceof Error ? err.message : String(err)}`)
  }

  return null
}
