/**
 * Live captions for both sides of the conversation.
 *
 * `aria-live="polite"` mirrors every spoken prompt as text for screen-reader
 * and low-vision users, and gives sighted demo viewers a caption track.
 */
export function CaptionBar({ spokenText, heardText }) {
  return (
    <div className="glass anim-rise relative overflow-hidden rounded-[26px] px-5 py-4" style={{ '--d': '160ms' }}>
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'var(--gradient-brand)' }}
        aria-hidden="true"
      />

      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--color-accent)' }}>
        <SpeakerIcon />
        AwaazPay says
      </p>
      <p
        aria-live="polite"
        key={spokenText}
        className="anim-rise mt-1.5 min-h-7 text-lg leading-snug"
        style={{ color: 'var(--color-text)' }}
      >
        {spokenText || 'Say a command to get started.'}
      </p>

      <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--color-text-dim)' }}>
          <EarIcon />
          You said
        </p>
        <p
          aria-live="polite"
          className="mt-1.5 min-h-5 text-sm italic"
          style={{ color: heardText ? 'var(--color-accent-2)' : 'var(--color-text-dim)' }}
        >
          {heardText || '—'}
        </p>
      </div>
    </div>
  )
}

function SpeakerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19.5 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function EarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="10" y="3" width="4" height="9" rx="2" fill="currentColor" />
      <path d="M6 10a6 6 0 0 0 12 0M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
