const ErrorState = ({
  message,
  onRetry,
  onSecondary,
  secondaryLabel,
  showRetry = true
}) => {
  return (
    <div className="error-state">
      <div className="error-icon" style={{
        width: '72px',
        height: '72px',
        margin: '0 auto 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-2xl)',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.15)',
        fontSize: '1.75rem',
      }}>⚠️</div>
      <h3 className="error-title">Something went wrong</h3>
      {message && <p className="error-message">{message}</p>}
      <div className="error-actions">
        {showRetry && onRetry && (
          <button
            type="button"
            className="btn-primary"
            onClick={onRetry}
            aria-label="Retry action"
          >
            Retry
          </button>
        )}
        {onSecondary && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onSecondary}
          >
            {secondaryLabel || 'Go Back'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorState;
