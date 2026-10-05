const Loader = ({ message = 'Loading...' }) => {
  return (
    <div className="loader-wrapper">
      <div style={{
        width: '48px',
        height: '48px',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '3px solid var(--border-glass-strong)',
          borderTopColor: 'var(--blue-500)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <div style={{
          position: 'absolute',
          inset: '6px',
          border: '3px solid var(--border-glass)',
          borderTopColor: 'var(--cyan-400)',
          borderRadius: '50%',
          animation: 'spin 1.2s linear infinite reverse',
        }} />
      </div>
      <p className="loader-text">{message}</p>
    </div>
  );
};

export default Loader;
