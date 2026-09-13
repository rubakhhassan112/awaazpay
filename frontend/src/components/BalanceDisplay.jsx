import { formatCurrency } from '../lib/format'

export function BalanceDisplay({ balance }) {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
        Your balance
      </p>
      <p className="font-display tabular mt-1 text-5xl font-bold" style={{ color: 'var(--color-text)' }}>
        {balance == null ? '—' : formatCurrency(balance)}
      </p>
    </div>
  )
}
