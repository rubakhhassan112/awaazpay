const BAR_HEIGHTS = [0.5, 0.85, 1, 0.7, 0.45]

export function ListenOrb({ status }) {
  const label =
    status === 'speaking'
      ? 'AwaazPay is speaking'
      : status === 'processing'
        ? 'Processing'
        : status === 'listening'
          ? 'Listening for your command'
          : 'Microphone off'

  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="off">
      <div className="relative flex h-40 w-40 items-center justify-center">
        {status === 'listening' && (
          <span
            className="orb-ring absolute inset-0 rounded-full"
            style={{ background: 'var(--color-accent)' }}
            aria-hidden="true"
          />
        )}
        {status === 'processing' && (
          <span
            className="absolute inset-0 animate-spin rounded-full border-4 border-transparent"
            style={{ borderTopColor: 'var(--color-accent)', borderRightColor: 'var(--color-accent-dim)' }}
            aria-hidden="true"
          />
        )}
        <div
          className="relative flex h-28 w-28 items-center justify-center rounded-full"
          style={{
            background: 'var(--color-surface-raised)',
            border: '2px solid var(--color-border)',
          }}
        >
          {status === 'speaking' ? (
            <div className="flex items-end gap-1.5" aria-hidden="true">
              {BAR_HEIGHTS.map((h, i) => (
                <span
                  key={i}
                  className="speak-bar w-2 rounded-full"
                  style={{
                    height: `${h * 44}px`,
                    background: 'var(--color-accent)',
                    animationDelay: `${i * 0.08}s`,
                  }}
                />
              ))}
            </div>
          ) : (
            <MicIcon active={status === 'listening'} />
          )}
        </div>
      </div>
      <p className="font-display text-sm font-medium tracking-wide" style={{ color: 'var(--color-text-dim)' }}>
        {label}
      </p>
    </div>
  )
}

function MicIcon({ active }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="9"
        y="2"
        width="6"
        height="12"
        rx="3"
        fill={active ? 'var(--color-accent)' : 'var(--color-text-dim)'}
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke={active ? 'var(--color-accent)' : 'var(--color-text-dim)'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
