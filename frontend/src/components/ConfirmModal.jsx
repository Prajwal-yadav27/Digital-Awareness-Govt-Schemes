const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false,
  danger = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} disabled={loading} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose} disabled={loading}>
              {cancelText}
            </button>
            <button
              className={danger ? 'btn-danger' : 'btn-primary'}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Processing...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
