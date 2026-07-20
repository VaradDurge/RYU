import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'
import type { AgentActivityEvent, AgentActivityKind, RyuAgent } from '../shared/types'

const MAX_ITEMS = 80
const MAX_DETAIL = 420
const MAX_TITLE = 96

/** Cursor: ~/.cursor/projects/<slug>/agent-transcripts/<uuid>/<uuid>.jsonl */
function cursorProjectSlug(workspace: string): string {
  return workspace.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\//g, '-')
}

/** Claude Code: ~/.claude/projects/-Users-… */
function claudeProjectDir(workspace: string): string {
  const slug = workspace.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\//g, '-')
  return join(homedir(), '.claude', 'projects', `-${slug}`)
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function basename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || p
}

function newestJsonl(dir: string): string | null {
  if (!existsSync(dir)) return null
  let best: { path: string; mtime: number } | null = null

  const walk = (d: string) => {
    let entries: string[]
    try {
      entries = readdirSync(d)
    } catch {
      return
    }
    for (const name of entries) {
      const full = join(d, name)
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        walk(full)
        continue
      }
      if (!name.endsWith('.jsonl')) continue
      if (!best || st.mtimeMs > best.mtime) best = { path: full, mtime: st.mtimeMs }
    }
  }

  walk(dir)
  return best?.path ?? null
}

/** Stable across polls — never use Date.now() (that remounts every feed row). */
function pushItem(
  out: AgentActivityEvent[],
  agent: RyuAgent,
  kind: AgentActivityKind,
  title: string,
  detail: string | undefined,
  idKey: string,
  ts?: number
) {
  const clippedTitle = clip(title, MAX_TITLE)
  const clippedDetail = detail ? clip(detail, MAX_DETAIL) : undefined
  out.push({
    id: `${agent}:${idKey}:${kind}:${hashKey(clippedTitle, clippedDetail)}`,
    agent,
    kind,
    title: clippedTitle,
    detail: clippedDetail,
    ts: ts ?? 0
  })
}

function hashKey(title: string, detail?: string): string {
  const s = `${title}\0${detail || ''}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function toolKind(name: string): AgentActivityKind {
  const n = name.toLowerCase()
  if (n.includes('shell') || n === 'bash' || n === 'terminal') return 'shell'
  if (n.includes('write') || n.includes('edit') || n === 'strreplace') return 'edit'
  return 'tool'
}

function summarizeToolInput(name: string, input: Record<string, unknown> | undefined): string {
  if (!input) return name
  const cmd = input.command ?? input.cmd ?? input.shell_command
  if (typeof cmd === 'string') return clip(cmd, MAX_DETAIL)
  const path =
    input.path ??
    input.file_path ??
    input.target_file ??
    input.filePath ??
    input.target_directory
  if (typeof path === 'string') return basename(path)
  const pattern = input.pattern ?? input.glob_pattern ?? input.query
  if (typeof pattern === 'string') return clip(String(pattern), 120)
  try {
    return clip(JSON.stringify(input), MAX_DETAIL)
  } catch {
    return name
  }
}

/** Parse Cursor agent-transcripts JSONL into feed items */
function parseCursorJsonl(raw: string, agent: RyuAgent): AgentActivityEvent[] {
  const out: AgentActivityEvent[] = []
  const lines = raw.split('\n')
  // Prefer recent turns — read from the end
  const start = Math.max(0, lines.length - 120)

  for (let i = start; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue
    let row: {
      role?: string
      message?: { content?: unknown }
    }
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }

    const role = row.role
    const content = row.message?.content
    const blocks = Array.isArray(content)
      ? content
      : typeof content === 'string'
        ? [{ type: 'text', text: content }]
        : []

    let bi = 0
    for (const block of blocks as Array<Record<string, unknown>>) {
      const type = String(block.type || '')
      const idKey = `L${i}b${bi++}`
      if (type === 'text' || (!type && typeof block.text === 'string')) {
        const text = String(block.text || '').trim()
        if (!text) continue
        // Skip harness noise
        if (text.startsWith('<timestamp>') && text.includes('<user_query>')) {
          const m = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/)
          const q = (m?.[1] || text).trim()
          if (q) pushItem(out, agent, 'prompt', 'You', q, idKey)
          continue
        }
        if (role === 'user') pushItem(out, agent, 'prompt', 'You', text, idKey)
        else if (role === 'assistant') {
          pushItem(out, agent, 'message', 'Agent', text, idKey)
        }
        continue
      }
      if (type === 'tool_use') {
        const name = String(block.name || 'Tool')
        const input = block.input as Record<string, unknown> | undefined
        const kind = toolKind(name)
        const detail = summarizeToolInput(name, input)
        const title =
          kind === 'shell'
            ? 'Shell'
            : kind === 'edit'
              ? `Edit · ${detail}`
              : name
        pushItem(
          out,
          agent,
          kind,
          kind === 'edit' ? title : name,
          kind === 'edit' ? undefined : detail,
          idKey
        )
      }
    }
  }

  return out.slice(-MAX_ITEMS)
}

/** Best-effort Claude Code session JSONL (when present) */
function parseClaudeJsonl(raw: string, agent: RyuAgent): AgentActivityEvent[] {
  const out: AgentActivityEvent[] = []
  const lines = raw.split('\n')
  const start = Math.max(0, lines.length - 200)

  for (let i = start; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue
    let row: Record<string, unknown>
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }

    const type = String(row.type || row.role || '')
    if (type === 'user' || row.role === 'user') {
      const msg =
        typeof row.message === 'string'
          ? row.message
          : typeof (row.message as { content?: string })?.content === 'string'
            ? (row.message as { content: string }).content
            : typeof row.content === 'string'
              ? row.content
              : ''
      if (msg.trim()) pushItem(out, agent, 'prompt', 'You', msg, `L${i}`)
      continue
    }

    if (type === 'assistant' || row.role === 'assistant') {
      const content = (row.message as { content?: unknown })?.content ?? row.content
      if (typeof content === 'string' && content.trim()) {
        pushItem(out, agent, 'message', 'Agent', content, `L${i}`)
      } else if (Array.isArray(content)) {
        let bi = 0
        for (const block of content as Array<Record<string, unknown>>) {
          const idKey = `L${i}b${bi++}`
          if (block.type === 'text' && typeof block.text === 'string') {
            pushItem(out, agent, 'message', 'Agent', block.text, idKey)
          } else if (block.type === 'tool_use') {
            const name = String(block.name || 'Tool')
            const input = block.input as Record<string, unknown> | undefined
            const kind = toolKind(name)
            pushItem(
              out,
              agent,
              kind,
              name,
              summarizeToolInput(name, input),
              idKey
            )
          }
        }
      }
    }
  }

  return out.slice(-MAX_ITEMS)
}

/**
 * Read the newest on-disk agent transcript for this workspace.
 * Returns [] when missing or unreadable (fail-open).
 * If workspace is missing for Cursor, falls back to the most recently
 * modified transcript across ~/.cursor/projects.
 */
export function readAgentTranscript(
  agent: RyuAgent,
  workspace?: string | null
): AgentActivityEvent[] {
  try {
    if (agent === 'cursor') {
      let file: string | null = null
      if (workspace && typeof workspace === 'string') {
        const slug = cursorProjectSlug(workspace)
        const root = join(homedir(), '.cursor', 'projects', slug, 'agent-transcripts')
        file = newestJsonl(root)
      }
      if (!file) {
        file = newestJsonl(join(homedir(), '.cursor', 'projects'))
        // Prefer files under agent-transcripts only
        if (file && !file.includes(`${sep}agent-transcripts${sep}`)) {
          file = newestAgentTranscript()
        }
      }
      if (!file) return []
      const raw = readFileSync(file, 'utf8')
      return parseCursorJsonl(raw, agent)
    }

    if (agent === 'claude') {
      if (!workspace || typeof workspace !== 'string') return []
      const root = claudeProjectDir(workspace)
      const file = newestJsonl(root)
      if (!file) return []
      const raw = readFileSync(file, 'utf8')
      return parseClaudeJsonl(raw, agent)
    }
  } catch {
    return []
  }

  return []
}

function newestAgentTranscript(): string | null {
  const projects = join(homedir(), '.cursor', 'projects')
  if (!existsSync(projects)) return null
  let best: { path: string; mtime: number } | null = null
  let entries: string[]
  try {
    entries = readdirSync(projects)
  } catch {
    return null
  }
  for (const slug of entries) {
    const root = join(projects, slug, 'agent-transcripts')
    const file = newestJsonl(root)
    if (!file) continue
    try {
      const mtime = statSync(file).mtimeMs
      if (!best || mtime > best.mtime) best = { path: file, mtime }
    } catch {
      // ignore
    }
  }
  return best?.path ?? null
}
