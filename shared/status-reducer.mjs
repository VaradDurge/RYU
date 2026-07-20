/**
 * Pure per-agent live-status reducer (bridge + renderer + verifies).
 * Bridge receive order / revision is authoritative — not client wall-clock.
 */

export const AGENTS = ['claude', 'codex', 'cursor']
export const LIVE_STATUSES = ['idle', 'running', 'approval', 'error', 'stale']

export const INTEGRATION_STATES = ['unknown', 'active', 'stale', 'not-configured']

export function initialStatusState() {
  const statuses = {}
  const revisions = {}
  const receivedAt = {}
  const details = {}
  const integration = {}
  for (const agent of AGENTS) {
    statuses[agent] = 'idle'
    revisions[agent] = 0
    receivedAt[agent] = 0
    details[agent] = null
    integration[agent] = 'unknown'
  }
  return {
    statuses,
    revisions,
    receivedAt,
    details,
    integration,
    health: {
      bridge: 'unknown',
      port: null,
      reason: null,
      startedAt: null
    }
  }
}

function agentHasPending(pendingAgents, agent) {
  return Boolean(pendingAgents && pendingAgents.has?.(agent))
}

/**
 * Whether an incoming status should be applied.
 * - Older/equal revision → ignore (except first observation revision 0 → >0)
 * - Late idle cannot clear approval/stale while that agent still has a pending permission
 */
export function shouldApplyStatus(state, update, options = {}) {
  const { agent, status, revision } = update
  if (!AGENTS.includes(agent) || !LIVE_STATUSES.includes(status)) return false

  const rev = Number(revision)
  if (!Number.isFinite(rev) || rev < 0) return false

  const currentRev = state.revisions[agent] || 0
  if (rev <= currentRev) return false

  const current = state.statuses[agent]
  const pendingAgents = options.pendingAgents
  if (
    status === 'idle' &&
    (current === 'approval' || current === 'stale') &&
    agentHasPending(pendingAgents, agent)
  ) {
    return false
  }

  return true
}

function integrationFor(status, hadSighting) {
  if (!hadSighting && status === 'idle') return 'unknown'
  if (status === 'stale') return 'stale'
  if (status === 'idle') return 'active'
  return 'active'
}

/**
 * Apply one ordered status update.
 * @returns next state (same reference if ignored)
 */
export function applyStatusUpdate(state, update, options = {}) {
  if (!shouldApplyStatus(state, update, options)) return state

  const agent = update.agent
  const status = update.status
  const revision = Number(update.revision)
  const receivedAt =
    typeof update.receivedAt === 'number' && Number.isFinite(update.receivedAt)
      ? update.receivedAt
      : Date.now()
  const detail = typeof update.detail === 'string' ? update.detail : null
  const hadSighting = (state.revisions[agent] || 0) > 0 || status !== 'idle'

  return {
    ...state,
    statuses: { ...state.statuses, [agent]: status },
    revisions: { ...state.revisions, [agent]: revision },
    receivedAt: { ...state.receivedAt, [agent]: receivedAt },
    details: { ...state.details, [agent]: detail },
    integration: {
      ...state.integration,
      [agent]: options.integration || integrationFor(status, hadSighting || revision > 0)
    }
  }
}

/** Apply snapshot agents + optional per-agent meta (revisions). */
export function applyStatusSnapshot(state, snapshot = {}) {
  let next = {
    ...state,
    health: snapshot.health
      ? {
          bridge: snapshot.health.bridge || state.health.bridge,
          port: snapshot.health.port ?? state.health.port,
          reason: snapshot.health.reason ?? state.health.reason,
          startedAt: snapshot.health.startedAt ?? state.health.startedAt
        }
      : state.health
  }

  const agents = snapshot.agents || {}
  const meta = snapshot.agentMeta || {}
  const pendingAgents = snapshot.pendingAgents

  for (const agent of AGENTS) {
    const status = agents[agent]
    if (!status || !LIVE_STATUSES.includes(status)) continue
    const m = meta[agent] || {}
    const revision = typeof m.revision === 'number' && Number.isFinite(m.revision) ? m.revision : 0
    // Do not invent sightings for default idle/unknown agents.
    if (revision <= 0 && status === 'idle') continue
    const applyRev = revision > 0 ? revision : Math.max(next.revisions[agent] || 0, 1)
    next = applyStatusUpdate(
      next,
      {
        agent,
        status,
        revision: applyRev,
        receivedAt: typeof m.lastSeenAt === 'number' ? m.lastSeenAt : m.receivedAt,
        detail: typeof m.detail === 'string' ? m.detail : null
      },
      {
        pendingAgents,
        integration: m.integration
      }
    )
  }

  return next
}

export function reduceAgentStatus(state = initialStatusState(), action) {
  switch (action?.type) {
    case 'reset':
      return initialStatusState()
    case 'health':
      return {
        ...state,
        health: {
          ...state.health,
          ...(action.health || {})
        }
      }
    case 'apply':
      return applyStatusUpdate(state, action.update || action, {
        pendingAgents: action.pendingAgents
      })
    case 'snapshot':
      return applyStatusSnapshot(state, action.snapshot || action)
    case 'markStale': {
      const agent = action.agent
      if (!AGENTS.includes(agent)) return state
      const current = state.statuses[agent]
      if (current !== 'running' && current !== 'approval') return state
      const revision = (state.revisions[agent] || 0) + 1
      return applyStatusUpdate(
        state,
        {
          agent,
          status: 'stale',
          revision,
          receivedAt: Date.now(),
          detail: action.detail || `${agent} · Status stale`
        },
        { pendingAgents: action.pendingAgents }
      )
    }
    default:
      return state
  }
}

/** Bound a detail string; returns { text, truncated }. Browser + Node safe. */
export function boundDetail(raw, maxBytes = 2048) {
  if (raw == null) return { text: undefined, truncated: false }
  const text = String(raw)
  if (typeof TextEncoder !== 'undefined') {
    const encoded = new TextEncoder().encode(text)
    if (encoded.length <= maxBytes) return { text, truncated: false }
    let end = maxBytes
    while (end > 0 && (encoded[end] & 0xc0) === 0x80) end -= 1
    return { text: new TextDecoder().decode(encoded.subarray(0, end)), truncated: true }
  }
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(text, 'utf8')
    if (buf.length <= maxBytes) return { text, truncated: false }
    let end = maxBytes
    while (end > 0 && (buf[end] & 0xc0) === 0x80) end -= 1
    return { text: buf.subarray(0, end).toString('utf8'), truncated: true }
  }
  if (text.length <= maxBytes) return { text, truncated: false }
  return { text: text.slice(0, maxBytes), truncated: true }
}
