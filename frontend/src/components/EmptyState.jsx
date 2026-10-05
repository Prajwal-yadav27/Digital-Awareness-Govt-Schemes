const EmptyState = ({
  icon = '📭',
  title,
  description,
  action = null,
  secondaryAction = null,
  accent = 'blue'
}) => {
  return (
    <div className={`empty-state empty-state-${accent}`}>
      <div className="empty-icon" style={{
        width: '80px',
        height: '80px',
        margin: '0 auto 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-2xl)',
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.15)',
        fontSize: '2rem',
      }}>{icon}</div>
      {title && <h3 className="empty-title">{title}</h3>}
      {description && <p className="empty-description">{description}</p>}
      {(action || secondaryAction) && (
        <div className="empty-actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
