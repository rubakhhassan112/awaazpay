import { formatCurrency, formatDateTime } from '../lib/format'

export function TransactionHistory({ transactions }) {
  if (!transactions?.length) {
    return (
      <p className="text-center text-sm" style={{ color: 'var(--color-text-dim)' }}>
        No transactions yet.
      </p>
    )
  }

  return (
    <ul className="flex w-full flex-col gap-2" aria-label="Recent transactions">
      {transactions.map((tx, i) => {
        const received = tx.direction === 'received'
        return (
          <li
            key={tx.id}
            className="glass anim-rise flex items-center gap-3 rounded-[20px] px-4 py-3"
            style={{ '--d': `${i * 90}ms` }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{
                background: received ? 'rgba(43,227,154,0.14)' : 'rgba(63,169,255,0.14)',
                color: received ? 'var(--color-success)' : 'var(--color-accent-2)',
              }}
              aria-hidden="true"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d={received ? 'M12 5v14M6 13l6 6 6-6' : 'M12 19V5M6 11l6-6 6 6'}
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium" style={{ color: 'var(--color-text)' }}>
                {tx.counterparty}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                {formatDateTime(tx.created_at)} · {tx.status}
              </p>
            </div>

            <p
              className="font-display tabular shrink-0 text-lg font-semibold"
              style={{ color: received ? 'var(--color-success)' : 'var(--color-text)' }}
            >
              {received ? '+' : '−'}
              {formatCurrency(tx.amount)}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
