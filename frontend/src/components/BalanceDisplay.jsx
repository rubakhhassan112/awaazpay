import { useEffect, useRef, useState } from 'react'
import { formatCurrency } from '../lib/format'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Eases the displayed balance from its previous value to the new one so a
 * payment visibly "spends down". Reduced-motion users jump straight to the
 * final number, and the accessible value is always the real balance.
 */
function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(target ?? 0)
  const fromRef = useRef(target ?? 0)
  const frameRef = useRef(0)

  useEffect(() => {
    if (target == null) return undefined
    const from = fromRef.current
    if (from === target || prefersReducedMotion()) {
      fromRef.current = target
      setDisplay(target)
      return undefined
    }

    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (target - from) * eased)
      if (t < 1) frameRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return display
}

export function BalanceDisplay({ balance }) {
  const animated = useCountUp(balance)
  const loading = balance == null

  return (
    <div
      className="glass-accent anim-rise relative overflow-hidden rounded-[26px] px-6 py-6 text-center"
      style={{ '--d': '60ms' }}
    >
      {/* Decorative brand wash in the corner */}
      <span
        className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full"
        style={{ background: 'var(--gradient-brand-soft)', filter: 'blur(24px)' }}
        aria-hidden="true"
      />

      <p
        className="text-[11px] font-semibold uppercase tracking-[0.22em]"
        style={{ color: 'var(--color-text-dim)' }}
      >
        Your balance
      </p>

      <p
        className="font-display tabular relative mt-2 text-5xl font-bold"
        aria-label={loading ? 'Balance loading' : `Balance ${formatCurrency(balance)}`}
      >
        {loading ? (
          <span className="inline-block animate-pulse" style={{ color: 'var(--color-text-dim)' }}>
            ——
          </span>
        ) : (
          <span className="text-gradient">{formatCurrency(Math.round(animated))}</span>
        )}
      </p>

      <p className="mt-2 text-xs" style={{ color: 'var(--color-text-dim)' }}>
        Say <span style={{ color: 'var(--color-accent)' }}>“What is my balance”</span> to hear it out loud
      </p>
    </div>
  )
}
