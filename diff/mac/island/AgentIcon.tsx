import type { RyuAgent } from '../../../shared/types'
import claudeIcon from '../../../src/assets/agents/claude.png'
import codexIcon from '../../../src/assets/agents/codex.png'
import cursorIcon from '../../../src/assets/agents/cursor.png'

const icons: Record<RyuAgent, string> = {
  claude: claudeIcon,
  codex: codexIcon,
  cursor: cursorIcon
}

const names: Record<RyuAgent, string> = {
  claude: 'Claude',
  codex: 'Codex',
  cursor: 'Cursor'
}

export function AgentIcon({ agent, size = 28 }: { agent: RyuAgent; size?: number }) {
  return (
    <img
      src={icons[agent]}
      alt={names[agent]}
      width={size}
      height={size}
      draggable={false}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'block',
        boxShadow: 'none',
        objectFit: 'cover',
        background: 'transparent',
        flexShrink: 0
      }}
    />
  )
}
