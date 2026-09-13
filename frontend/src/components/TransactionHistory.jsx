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
      {transactions.map((tx) => (
        <li
          key={tx.id}
          className="flex items-center justify-between rounded-2xl px-4 py-3"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <div>
            <p className="font-medium" style={{ color: 'var(--color-text)' }}>
              {tx.counterparty}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              {formatDateTime(tx.created_at)} · {tx.status}
            </p>
          </div>
          <p
            className="font-display tabular text-lg font-semibold"
            style={{ color: tx.direction === 'received' ? 'var(--color-success)' : 'var(--color-text)' }}
          >
            {tx.direction === 'received' ? '+' : '−'}
            {formatCurrency(tx.amount)}
          </p>
        </li>
      ))}
    </ul>
  )
}
