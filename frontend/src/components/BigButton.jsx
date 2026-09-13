/**
 * The one tappable primitive in AwaazPay. Targets stay ≥ 64px tall so they are
 * findable without looking; motion is limited to a press/hover transform and an
 * optional sheen, both of which the reduced-motion block in index.css disables.
 */
export function BigButton({
  children,
  onClick,
  variant = 'primary',
  icon,
  hint,
  fullWidth = true,
  className = '',
  style,
  ...rest
}) {
  const variants = {
    primary: {
      background: 'var(--gradient-brand)',
      color: '#03130c',
      border: '1px solid rgba(255,255,255,0.22)',
      boxShadow: '0 14px 34px -14px rgba(18,198,123,0.75), 0 0 0 1px rgba(255,255,255,0.06) inset',
    },
    surface: {
      background: 'linear-gradient(160deg, rgba(255,255,255,0.085), rgba(255,255,255,0.03))',
      color: 'var(--color-text)',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-lift)',
    },
    danger: {
      background: 'rgba(255,107,120,0.08)',
      color: 'var(--color-danger)',
      border: '2px solid rgba(255,107,120,0.55)',
    },
    success: {
      background: 'linear-gradient(135deg, #12c67b, #2be39a)',
      color: '#04180f',
      border: '1px solid rgba(255,255,255,0.22)',
      boxShadow: '0 14px 34px -14px rgba(43,227,154,0.8)',
    },
  }

  const sheen = variant === 'primary' || variant === 'success'
  // A bare label (no icon, no hint) reads better centred — that is how the
  // Cancel / Confirm buttons inside the centred flow cards are used.
  const bare = !icon && !hint

  return (
    <button
      type="button"
      onClick={onClick}
      className={`pressable font-display group relative flex items-center gap-3 rounded-(--radius-tactile) px-6 py-5 text-xl font-semibold ${
        bare ? 'justify-center text-center' : 'text-left'
      } ${fullWidth ? 'w-full' : ''} ${sheen ? 'sheen' : ''} ${className}`}
      style={{ ...variants[variant], ...style }}
      {...rest}
    >
      {icon && (
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: variant === 'surface' ? 'var(--gradient-brand-soft)' : 'rgba(0,0,0,0.14)',
            color: variant === 'surface' ? 'var(--color-accent)' : 'currentColor',
          }}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span className={`flex min-w-0 flex-col ${bare ? '' : 'flex-1'}`}>
        <span className="truncate">{children}</span>
        {hint && (
          <span className="mt-0.5 text-xs font-medium opacity-70">{hint}</span>
        )}
      </span>
      {!bare && (
        <span
          className="shrink-0 transition-transform duration-200 group-hover:translate-x-1"
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.65" />
          </svg>
        </span>
      )}
    </button>
  )
}
