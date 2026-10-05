import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const RegistrationModal = ({ isOpen, onClose, onSubmit, onPaymentRequired, event, loading = false }) => {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    numberOfGuests: 1,
    message: ''
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const isPaidEvent = event?.isPaidEvent && event?.registrationFee > 0;

  useEffect(() => {
    if (isOpen && user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        numberOfGuests: 1,
        message: ''
      });
      setErrors({});
      setServerError(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors = {};
    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();
    const trimmedPhone = form.phone.trim();

    if (!trimmedName || trimmedName.length < 2) newErrors.name = 'Name must be at least 2 characters';
    else if (trimmedName.length > 100) newErrors.name = 'Name cannot exceed 100 characters';

    if (!trimmedEmail) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) newErrors.email = 'Please provide a valid email address';
    else if (trimmedEmail.length > 150) newErrors.email = 'Email cannot exceed 150 characters';

    if (!trimmedPhone) newErrors.phone = 'Phone is required';
    else if (!/^\+?[0-9\s\-]{8,15}$/.test(trimmedPhone)) newErrors.phone = 'Please provide a valid phone number';
    else if (trimmedPhone.length > 15) newErrors.phone = 'Phone cannot exceed 15 characters';

    const guests = Number(form.numberOfGuests);
    if (isNaN(guests) || !Number.isInteger(guests) || guests < 1 || guests > 20) {
      newErrors.numberOfGuests = 'Number of guests must be between 1 and 20';
    }

    if (form.message && form.message.length > 500) newErrors.message = 'Message cannot exceed 500 characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    try {
      await onSubmit({
        eventId: event._id,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        numberOfGuests: Number(form.numberOfGuests),
        message: form.message.trim()
      });
      // Close modal on success (parent also closes, but this ensures UI does not appear stuck)
      onClose();
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Register for Event</h3>
            <p className="modal-subtitle" style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>{event?.title}</p>
          </div>
          <button className="modal-close" onClick={onClose} disabled={loading} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {serverError && <div className="form-error">{serverError}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Name <span className="required-mark">*</span></label>
            <input id="reg-name" type="text" className={`form-input ${errors.name ? 'form-input-error' : ''}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" disabled={loading} maxLength={100} />
            {errors.name && <span className="form-field-error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email <span className="required-mark">*</span></label>
            <input id="reg-email" type="email" className={`form-input ${errors.email ? 'form-input-error' : ''}`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" disabled={loading} maxLength={150} />
            {errors.email && <span className="form-field-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-phone">Phone <span className="required-mark">*</span></label>
            <input id="reg-phone" type="tel" className={`form-input ${errors.phone ? 'form-input-error' : ''}`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210 or +91 9876543210" disabled={loading} maxLength={15} />
            {errors.phone && <span className="form-field-error">{errors.phone}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-guests">Number of Guests <span className="required-mark">*</span></label>
            <input id="reg-guests" type="number" min={1} max={20} className={`form-input ${errors.numberOfGuests ? 'form-input-error' : ''}`} value={form.numberOfGuests} onChange={(e) => setForm({ ...form, numberOfGuests: e.target.value })} disabled={loading} />
            {errors.numberOfGuests && <span className="form-field-error">{errors.numberOfGuests}</span>}
            <span className="form-help-text">Including yourself. Max 20.</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-message">Message</label>
            <textarea id="reg-message" className={`form-textarea ${errors.message ? 'form-input-error' : ''}`} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Optional message to organizer" rows={3} disabled={loading} maxLength={500} />
            {errors.message && <span className="form-field-error">{errors.message}</span>}
            <span className="form-help-text">{form.message.length} / 500</span>
          </div>

          {isPaidEvent && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#92400e', marginBottom: '4px' }}>Payment Required</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#92400e' }}>
                ₹{event.registrationFee * (Number(form.numberOfGuests) || 1)}
                <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#64748b' }}> ({event.registrationFee} × {form.numberOfGuests} guests)</span>
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>You will be redirected to Razorpay to complete payment after registration.</div>
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '8px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><span className="loading-spinner"></span> Registering...</> : (isPaidEvent ? `Register & Pay ₹${event.registrationFee * (Number(form.numberOfGuests) || 1)}` : 'Confirm Registration')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegistrationModal;
