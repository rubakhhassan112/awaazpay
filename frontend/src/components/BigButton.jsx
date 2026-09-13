export function BigButton({ children, onClick, variant = 'primary', fullWidth = true, ...rest }) {
  const styles = {
    primary: { background: 'var(--color-accent)', color: '#1a1300' },
    surface: { background: 'var(--color-surface-raised)', color: 'var(--color-text)', border: '1px solid var(--color-border)' },
    danger: { background: 'transparent', color: 'var(--color-danger)', border: '2px solid var(--color-danger)' },
    success: { background: 'var(--color-success)', color: '#062012' },
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-display ${fullWidth ? 'w-full' : ''} rounded-[var(--radius-tactile)] px-6 py-5 text-xl font-semibold transition-transform active:scale-[0.98]`}
      style={styles[variant]}
      {...rest}
    >
      {children}
    </button>
  )
}
