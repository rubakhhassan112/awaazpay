/**
 * AwaazPay brand mark.
 *
 * The glyph is the logo "A": its left stroke is sculpted into a speaking face
 * in profile (the `ap-face` mask carves the forehead/nose/lips/chin out of the
 * stroke, so the counter of the A *is* the face), voice waves leave the mouth,
 * and the contactless card sits in the foot of the letterform.
 *
 * To swap in the original artwork instead, drop the file in `src/assets/` and
 * render it here — `LogoMark`'s `size` prop is the only contract callers use.
 *
 * `animated` pulses the waves outward, the same motion the ListenOrb uses, so
 * the mark feels alive on the launch screen. It is decorative: the svg is
 * aria-hidden and the accessible name comes from the wordmark beside it.
 */
export function LogoMark({ size = 48, animated = false, className = '', style }) {
  const uid = animated ? 'anim' : 'static'
  const waveProps = (delay, origin) =>
    animated ? { className: 'wave-out', style: { '--d': `${delay}ms`, '--origin': origin } } : {}

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`ap-ramp-${uid}`} x1="20" y1="30" x2="114" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1668F5" />
          <stop offset="0.52" stopColor="#18A5E6" />
          <stop offset="1" stopColor="#12C67B" />
        </linearGradient>
        <linearGradient id={`ap-card-${uid}`} x1="84" y1="116" x2="118" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0FA968" />
          <stop offset="1" stopColor="#1AD48D" />
        </linearGradient>
        {/* Everything right of the profile line is removed from the left
            stroke — hood, forehead, brow, nose, lips, chin, then the neck. */}
        <mask id={`ap-face-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128">
          <rect width="128" height="128" fill="#fff" />
          <path
            d="M112 2 C96 16 68 30 56 40 C53 43 52 45 52 47 C50.5 49 49 51 49 53 C49 55 51 55.5 52 57 L66 62 L51 65 C49 66.5 47 67 47 69 C47 71 50 71.5 52 74 C52 77 47 77 46 80 C45.5 84 46 86 46 90 L124 90 L124 2 Z"
            fill="#000"
          />
        </mask>
      </defs>

      {/* Crossbar */}
      <path d="M44 88 L98 88" stroke={`url(#ap-ramp-${uid})`} strokeWidth="14" strokeLinecap="round" />
      {/* Right stroke */}
      <path d="M74 20 L110 102" stroke={`url(#ap-ramp-${uid})`} strokeWidth="24" strokeLinecap="round" />
      {/* Left stroke, carved into the face */}
      <g mask={`url(#ap-face-${uid})`}>
        <path d="M74 20 L20 102" stroke={`url(#ap-ramp-${uid})`} strokeWidth="34" strokeLinecap="round" />
      </g>

      {/* Voice leaving the mouth */}
      <g stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M64.1 65.1 A10 10 0 0 1 64.1 76.9" {...waveProps(0, '56px 71px')} />
        <path d="M68.9 61.6 A16 16 0 0 1 68.9 80.4" {...waveProps(180, '56px 71px')} />
        <path d="M73.8 58.1 A22 22 0 0 1 73.8 83.9" {...waveProps(360, '56px 71px')} />
      </g>

      {/* Contactless card in the foot of the A */}
      <g transform="rotate(-5 101 98)">
        <rect x="84" y="80" width="36" height="36" rx="11" fill={`url(#ap-card-${uid})`} stroke="#FFFFFF" strokeWidth="5" />
        <g stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" fill="none">
          <path d="M95.5 92.6 A7 7 0 0 1 95.5 103.4" {...waveProps(120, '92px 98px')} />
          <path d="M99 88.4 A12.5 12.5 0 0 1 99 107.6" {...waveProps(300, '92px 98px')} />
          <path d="M102.6 84.2 A18 18 0 0 1 102.6 111.8" {...waveProps(480, '92px 98px')} />
        </g>
      </g>
    </svg>
  )
}

/**
 * Mark + wordmark + tagline. `size` drives the mark; the type scales with it.
 */
export function LogoLockup({ size = 40, animated = false, tagline = true, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} animated={animated} />
      <div className="leading-none">
        <p className="font-display font-bold tracking-tight" style={{ fontSize: size * 0.6 }}>
          <span style={{ color: 'var(--color-text)' }}>Awaaz</span>
          <span className="text-gradient">Pay</span>
        </p>
        {tagline && (
          <p
            className="mt-1 font-display font-medium uppercase"
            style={{
              fontSize: Math.max(8, size * 0.2),
              letterSpacing: '0.16em',
              color: 'var(--color-text-dim)',
            }}
          >
            Banking Beyond Sight
          </p>
        )}
      </div>
    </div>
  )
}
