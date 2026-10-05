import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => {
      // Prevent simultaneous success + warning spam: keep max 2, replace warning with success
      const next = [...prev];
      if (type === 'success' && next.some(t => t.type === 'warning')) {
        // Remove the oldest warning when a success arrives (e.g., login after redirect)
        const idx = next.findIndex(t => t.type === 'warning');
        if (idx !== -1) next.splice(idx, 1);
      }
      // Limit to 2 visible toasts to reduce dominance
      if (next.length >= 2) next.shift();
      return [...next, { id, message, type }];
    });
    setTimeout(() => removeToast(id), 3800);
  }, [removeToast]);

  useEffect(() => {
    const handler = (event) => {
      const { message, type } = event.detail || {};
      if (message) {
        addToast(message, type || 'info');
      }
    };
    window.addEventListener('toast:show', handler);
    return () => window.removeEventListener('toast:show', handler);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            role="alert"
          >
            <span className="toast-icon" aria-hidden="true">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'info' && 'ℹ'}
              {toast.type === 'warning' && '⚠'}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
