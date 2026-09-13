const BAR_HEIGHTS = [0.42, 0.72, 1, 0.85, 0.55, 0.9, 0.38]
const RING_DELAYS = [0, 650, 1300]

const STATUS_COPY = {
  speaking: { label: 'AwaazPay is speaking', color: 'var(--color-accent-2)' },
  processing: { label: 'Processing', color: 'var(--color-accent-2)' },
  listening: { label: 'Listening for your command', color: 'var(--color-accent)' },
  idle: { label: 'Microphone off', color: 'var(--color-text-dim)' },
}

/**
 * The visual anchor of the app: a gradient orb that pulses while listening,
 * spins while processing, and turns into a waveform while speaking.
 *
 * Every state is also announced in text below the orb, so the animation is
 * decoration on top of a readable status — never the only signal.
 */
export function ListenOrb({ status }) {
  const { label, color } = STATUS_COPY[status] ?? STATUS_COPY.idle
  const active = status === 'listening' || status === 'speaking'

  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="off">
      <div className="relative flex h-48 w-48 items-center justify-center">
        {/* Expanding sonar rings while the mic is open */}
        {status === 'listening' &&
          RING_DELAYS.map((d) => (
            <span
              key={d}
              className="orb-ring absolute h-36 w-36 rounded-full"
              style={{
                border: '2px solid var(--color-accent)',
                animationDelay: `${d}ms`,
              }}
              aria-hidden="true"
            />
          ))}

        {/* Rotating gradient halo while thinking */}
        {status === 'processing' && (
          <span
            className="spin-slow absolute h-40 w-40 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0deg, var(--color-accent-2) 110deg, var(--color-accent) 200deg, transparent 300deg)',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px))',
            }}
            aria-hidden="true"
          />
        )}

        {/* Soft brand glow behind the core */}
        <span
          className="absolute h-40 w-40 rounded-full transition-opacity duration-500"
          style={{
            background: 'radial-gradient(circle, rgba(47,214,166,0.4), transparent 68%)',
            filter: 'blur(14px)',
            opacity: active ? 1 : 0.35,
          }}
          aria-hidden="true"
        />

        {/* Gradient rim */}
        <div
          className={`relative flex h-32 w-32 items-center justify-center rounded-full ${active ? 'anim-breathe' : ''}`}
          style={{
            background: active
              ? 'var(--gradient-brand)'
              : 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))',
            padding: '2px',
            boxShadow: active ? '0 18px 50px -18px rgba(18,198,123,0.8)' : 'none',
            transition: 'box-shadow 0.4s ease',
          }}
        >
          <div
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{
              background: 'linear-gradient(165deg, #0a1524, #050b14)',
            }}
          >
            {status === 'speaking' ? (
              <div className="flex items-end gap-1.5" aria-hidden="true">
                {BAR_HEIGHTS.map((h, i) => (
                  <span
                    key={i}
                    className="speak-bar w-1.5 rounded-full"
                    style={{
                      height: `${h * 52}px`,
                      background: 'var(--gradient-brand)',
                      animationDelay: `${i * 0.09}s`,
                    }}
                  />
                ))}
              </div>
            ) : (
              <MicIcon active={status === 'listening'} />
            )}
          </div>
        </div>
      </div>

      <p
        className="font-display flex items-center gap-2 text-sm font-medium tracking-wide"
        style={{ color }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: color, boxShadow: active ? `0 0 10px ${color}` : 'none' }}
          aria-hidden="true"
        />
        {label}
        {status === 'processing' && (
          <span className="flex gap-1" aria-hidden="true">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="dot-bounce inline-block h-1 w-1 rounded-full"
                style={{ background: color, '--d': `${d}ms` }}
              />
            ))}
          </span>
        )}
      </p>
    </div>
  )
}

function MicIcon({ active }) {
  const stroke = active ? 'var(--color-accent)' : 'var(--color-text-dim)'
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" fill={stroke} />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
