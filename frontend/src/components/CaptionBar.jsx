export function CaptionBar({ spokenText, heardText }) {
  return (
    <div
      className="w-full rounded-2xl px-5 py-4"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
        AwaazPay says
      </p>
      {/* aria-live="polite" mirrors every spoken prompt as text for screen-reader
          and low-vision users, and gives sighted demo viewers a caption. */}
      <p aria-live="polite" className="mt-1 min-h-[1.5rem] text-lg leading-snug" style={{ color: 'var(--color-text)' }}>
        {spokenText || 'Say a command to get started.'}
      </p>

      <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
          You said
        </p>
        <p aria-live="polite" className="mt-1 min-h-[1.25rem] text-sm italic" style={{ color: 'var(--color-text-dim)' }}>
          {heardText || '—'}
        </p>
      </div>
    </div>
  )
}
