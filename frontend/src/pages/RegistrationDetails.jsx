import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonDetails } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import BackButton from '../components/BackButton';
import ConfirmModal from '../components/ConfirmModal';
import * as registrationService from '../services/registrationService';
import * as paymentService from '../services/paymentService';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const RegistrationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payment, setPayment] = useState(null);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundReason, setRefundReason] = useState('');

  const fetchRegistration = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await registrationService.getRegistrationById(id);
      setRegistration(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load registration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRegistration(); }, [id]);

  // Admin-only: load the payment record so refund controls can be shown.
  // The backend remains authoritative: only admins receive payment data here,
  // and only the admin refund endpoint can change payment state.
  useEffect(() => {
    let cancelled = false;
    const fetchPayment = async () => {
      if (user?.role !== 'admin' || !registration?._id) {
        if (!cancelled) setPayment(null);
        return;
      }
      try {
        const res = await paymentService.getPaymentByRegistration(registration._id);
        if (!cancelled) setPayment(res.data || null);
      } catch (_) {
        if (!cancelled) setPayment(null);
      }
    };
    fetchPayment();
    return () => { cancelled = true; };
  }, [user, registration?._id, registration?.paymentStatus]);

  const handleRefund = async () => {
    if (!payment?._id || isRefunding) return;
    setIsRefunding(true);
    try {
      await paymentService.refundPayment(payment._id, refundReason.trim() || undefined);
      addToast('Refund processed successfully', 'success');
      setIsRefundOpen(false);
      setRefundReason('');
      fetchRegistration();
      try {
        const res = await paymentService.getPaymentByRegistration(id);
        setPayment(res.data || null);
      } catch (_) {}
    } catch (err) {
      addToast(err.message || 'Failed to process refund', 'error');
    } finally {
      setIsRefunding(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await registrationService.cancelRegistration(id);
      addToast('Registration cancelled', 'success');
      setIsCancelOpen(false);
      fetchRegistration();
    } catch (err) {
      addToast(err.message || 'Failed to cancel', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePayNow = async () => {
    if (!registration?._id || isPaying) return;
    setIsPaying(true);
    try {
      const orderRes = await paymentService.createPaymentOrder(registration._id);
      if (orderRes.data?.alreadyPaid) {
        addToast('Payment already completed', 'success');
        fetchRegistration();
        return;
      }
      const loadRazorpayScript = () => {
        if (window.Razorpay) return Promise.resolve();
        const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (existing) {
          return new Promise((resolve, reject) => {
            if (window.Razorpay) return resolve();
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', reject, { once: true });
          });
        }
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      };
      try {
        await loadRazorpayScript();
      } catch {
        addToast('Payment gateway unavailable (network restricted).', 'warning');
        return;
      }
      if (!window.Razorpay) {
        addToast('Payment gateway failed to load.', 'error');
        return;
      }
      const evTitle = registration.event?.title || 'Event';
      const options = {
        key: orderRes.data.razorpayKeyId,
        amount: Math.round(orderRes.data.amount * 100),
        currency: orderRes.data.currency || 'INR',
        name: evTitle,
        description: `Payment for ${evTitle}`,
        order_id: orderRes.data.orderId,
        handler: async (response) => {
          try {
            await paymentService.verifyPayment({
              registrationId: registration._id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
            addToast('Payment successful! Registration confirmed.', 'success');
            fetchRegistration();
          } catch (verifyErr) {
            addToast(verifyErr.message || 'Payment verification failed', 'error');
            fetchRegistration();
          }
        },
        prefill: { name: registration.name, email: registration.email, contact: registration.phone },
        theme: { color: '#2563eb' },
        modal: { ondismiss: () => { addToast('Payment cancelled. You can retry.', 'warning'); } }
      };
      new window.Razorpay(options).open();
    } catch (err) {
      addToast(err.message || 'Failed to initiate payment', 'error');
    } finally {
      setIsPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="page-container" style={{ maxWidth: '900px' }}>
          <BackButton label="Back" />
          <SkeletonDetails />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="page-container" style={{ maxWidth: '900px' }}>
          <BackButton label="Back" />
          <ErrorState message={error} onRetry={fetchRegistration} onSecondary={() => navigate('/my-registrations')} secondaryLabel="My Registrations" />
        </div>
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="page-wrapper">
        <div className="page-container" style={{ maxWidth: '900px' }}>
          <BackButton label="Back" />
          <EmptyState icon="🔍" title="Registration not found" description="The registration you are looking for does not exist." action={<Link to="/my-registrations" className="btn-primary">My Registrations</Link>} />
        </div>
      </div>
    );
  }

  const ev = registration.event || {};
  const regUser = registration.user || {};
  const canCancel = registration.status === 'Pending' || registration.status === 'Confirmed';
  const isOwner = user && String(registration.user?._id || registration.user) === String(user._id);

  return (
    <div className="page-wrapper">
      <div className="page-container" style={{ maxWidth: '900px' }}>
        <BackButton label="Back to My Registrations" to="/my-registrations" />

        <article className="scheme-detail-wrapper fade-in">
          <header className="scheme-detail-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="scheme-detail-title" style={{ fontSize: '1.6rem' }}>Registration Details</h1>
              <div className="scheme-detail-meta">
                <span className={`status-badge ${registration.status === 'Confirmed' ? 'status-active' : registration.status === 'Rejected' || registration.status === 'Cancelled' ? 'status-inactive' : 'status-draft'}`}>{registration.status}</span>
                <span className="category-badge">ID: {String(registration._id).slice(-8)}</span>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Registered: {formatDate(registration.createdAt)}</span>
              </div>
            </div>
            {isOwner && canCancel && (
              <div className="scheme-detail-actions">
                <button className="btn-danger" onClick={() => setIsCancelOpen(true)}>Cancel Registration</button>
              </div>
            )}
          </header>

          <div className="scheme-detail-grid">
            <section className="scheme-section-card">
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">👤</div>
                <h2 className="scheme-section-title">Registration Information</h2>
              </div>
              <div className="scheme-section-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.92rem' }}>
                <div><strong>Registration ID:</strong> <span style={{ fontFamily: 'ui-monospace', fontSize: '0.82rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '6px' }}>{registration._id}</span></div>
                <div><strong>Name:</strong> {registration.name}</div>
                <div><strong>Email:</strong> {registration.email}</div>
                <div><strong>Phone:</strong> {registration.phone}</div>
                <div><strong>Number of Guests:</strong> {registration.numberOfGuests}</div>
                {registration.message && <div><strong>Message:</strong> {registration.message}</div>}
                <div><strong>Registered At:</strong> {formatDate(registration.registeredAt || registration.createdAt)}</div>
                <div><strong>Status:</strong> <span className={`status-badge ${registration.status === 'Confirmed' ? 'status-active' : registration.status === 'Rejected' || registration.status === 'Cancelled' ? 'status-inactive' : 'status-draft'}`}>{registration.status}</span></div>
                <div><strong>User:</strong> {regUser.name || regUser.email || String(registration.user).slice(-8)}</div>
              </div>
            </section>

            <section className="scheme-section-card">
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">💳</div>
                <h2 className="scheme-section-title">Payment Information</h2>
              </div>
              <div className="scheme-section-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
                {ev.isPaidEvent && ev.registrationFee > 0 ? (
                  <>
                    <div><strong>Fee per guest:</strong> ₹{ev.registrationFee}</div>
                    <div><strong>Total:</strong> ₹{ev.registrationFee * registration.numberOfGuests} <span style={{ color: '#64748b', fontSize: '0.8rem' }}>({registration.numberOfGuests} guests)</span></div>
                    <div>
                      <strong>Payment Status:</strong>{' '}
                      <span className={`status-badge ${registration.paymentStatus === 'Paid' ? 'status-active' : registration.paymentStatus === 'Pending' ? 'status-draft' : registration.paymentStatus === 'Failed' ? 'status-inactive' : registration.paymentStatus === 'Refunded' ? 'status-inactive' : 'status-draft'}`}>{registration.paymentStatus || 'Unpaid'}</span>
                    </div>
                    {payment?.status === 'Refunded' && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 12px', fontSize: '0.85rem', color: '#991b1b' }}>
                        <div><strong>⛔ Refunded</strong>{payment.refundAmount != null && <> — ₹{payment.refundAmount}</>}</div>
                        {payment.razorpayRefundId && <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Refund ID: <span style={{ fontFamily: 'ui-monospace, monospace' }}>{payment.razorpayRefundId}</span></div>}
                        {payment.refundedAt && <div style={{ fontSize: '0.78rem', marginTop: '2px' }}>Refunded: {formatDate(payment.refundedAt)}</div>}
                      </div>
                    )}
                    {user?.role === 'admin' && payment?.status === 'Paid' && (
                      <div>
                        <button type="button" className="btn-secondary" onClick={() => setIsRefundOpen(true)} style={{ borderColor: '#fde68a', color: '#92400e', background: '#fffbeb', fontWeight: 700 }}>
                          Refund Payment
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div><strong>Payment:</strong> <span className="status-badge status-active">FREE EVENT</span></div>
                )}
              </div>
            </section>

            <section className="scheme-section-card">
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">🎉</div>
                <h2 className="scheme-section-title">Event Information</h2>
              </div>
              <div className="scheme-section-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.92rem' }}>
                <div><strong>Title:</strong> {ev.title || '—'}</div>
                <div><strong>Category:</strong> {ev.category || '—'}</div>
                <div><strong>Date:</strong> {formatDate(ev.eventDate)}</div>
                <div><strong>Location:</strong> {ev.location || '—'}</div>
                <div><strong>Organizer:</strong> {ev.organizer?.name || ev.organizer?.email || '—'}</div>
                {ev.capacity && <div><strong>Capacity:</strong> {ev.capacity}</div>}
                <Link to={ev._id ? `/events/${ev._id}` : '/events'} className="btn-secondary" style={{ marginTop: '8px', alignSelf: 'flex-start' }}>View Event</Link>
              </div>
            </section>
          </div>

          {/* Status-specific ticket / message */}
          {registration.status === 'Confirmed' && (
            <div style={{ marginTop: '16px', background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#15803d', marginBottom: '6px' }}>Registration Confirmed</div>
              <p style={{ fontSize: '0.85rem', color: '#334155', marginBottom: '12px' }}>Your registration has been confirmed. View your digital ticket with QR code.</p>
              <Link to={`/registrations/${registration._id}/ticket`} className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>🎟 View Digital Ticket</Link>
            </div>
          )}
          {registration.status === 'Pending' && (
            <div style={{ marginTop: '16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px', textAlign: 'center', fontSize: '0.9rem', color: '#92400e', fontWeight: 600 }}>
              Waiting for organizer confirmation
            </div>
          )}
          {registration.status === 'Rejected' && (
            <div style={{ marginTop: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px', textAlign: 'center', fontSize: '0.9rem', color: '#b91c1c', fontWeight: 600 }}>
              Registration rejected
            </div>
          )}
          {registration.status === 'Cancelled' && (
            <div style={{ marginTop: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', textAlign: 'center', fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
              Registration cancelled
            </div>
          )}

          <div className="scheme-detail-cta-footer" style={{ display: 'flex', gap: '12px', paddingTop: '20px', marginTop: '20px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
            {isOwner && ev.isPaidEvent && ev.registrationFee > 0 && registration.paymentStatus !== 'Paid' && registration.status === 'Pending' && (
              <button className="btn-primary" onClick={handlePayNow} disabled={isPaying} style={{ background: '#f59e0b', borderColor: '#f59e0b' }}>{isPaying ? 'Processing...' : `Pay Now ₹${ev.registrationFee * registration.numberOfGuests}`}</button>
            )}
            {isOwner && canCancel && (
              <button className="btn-danger" onClick={() => setIsCancelOpen(true)}>Cancel Registration</button>
            )}
            {registration.status === 'Confirmed' && (
              <Link to={`/registrations/${registration._id}/ticket`} className="btn-primary" style={{ textDecoration: 'none' }}>View Digital Ticket</Link>
            )}
            <Link to="/my-registrations" className="btn-secondary">Back to My Registrations</Link>
            <Link to={ev._id ? `/events/${ev._id}` : '/events'} className="btn-secondary">View Event</Link>
          </div>
          {!canCancel && registration.status !== 'Confirmed' && registration.status !== 'Pending' && (
            <div style={{ marginTop: '10px', fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center' }}>
              {registration.status === 'Cancelled' ? 'This registration is already cancelled.' : 'Cancellation not available for this status.'}
            </div>
          )}
        </article>

        <ConfirmModal
          isOpen={isCancelOpen}
          onClose={() => setIsCancelOpen(false)}
          onConfirm={handleCancel}
          title="Cancel Registration"
          message="Are you sure you want to cancel this registration?"
          confirmText="Cancel Registration"
          cancelText="Keep Registration"
          loading={isCancelling}
          danger={true}
        />
        <ConfirmModal
          isOpen={isRefundOpen}
          onClose={() => { if (!isRefunding) { setIsRefundOpen(false); setRefundReason(''); } }}
          onConfirm={handleRefund}
          title="Refund Payment"
          message={payment ? `Refund this payment?\n\nEvent: ${ev.title || '—'}\nParticipant: ${registration.name || registration.email || '—'}\nAmount: ₹${payment.amount} ${payment.currency || 'INR'}\nPayment ID: ${String(payment._id).slice(-8)}\n\nThis action will issue a real Razorpay refund.` : 'Refund this payment? This action will issue a real Razorpay refund.'}
          confirmText="Issue Refund"
          cancelText="Cancel"
          loading={isRefunding}
          danger={true}
        />
      </div>
    </div>
  );
};

export default RegistrationDetails;
