import { macTheme } from './theme'

export function Resolved({ decision }: { decision: 'allow' | 'deny' }) {
  const ok = decision === 'allow'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 16px',
        color: macTheme.text,
        fontSize: 12,
        fontWeight: 590,
        fontFamily: macTheme.font,
        letterSpacing: '-0.01em'
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: ok ? macTheme.success : macTheme.danger
        }}
      />
      {ok ? 'Approved' : 'Denied'}
    </div>
  )
}
