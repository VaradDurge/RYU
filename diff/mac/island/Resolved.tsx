import { macTheme } from './theme'

export function Resolved({ decision }: { decision: 'allow' | 'deny' }) {
  const ok = decision === 'allow'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 18px',
        color: macTheme.text,
        fontSize: 12.5,
        fontWeight: 600
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: ok ? macTheme.success : macTheme.danger,
          boxShadow: `0 0 8px ${ok ? macTheme.success : macTheme.danger}`
        }}
      />
      {ok ? 'Approved' : 'Denied'}
    </div>
  )
}
