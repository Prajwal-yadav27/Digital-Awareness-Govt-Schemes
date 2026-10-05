import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { coverPlaceholder } from '../utils/placeholder';
import { useToast } from '../context/ToastContext';
import { SkeletonSchemesGrid } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ConfirmModal from '../components/ConfirmModal';
import * as registrationService from '../services/registrationService';
import * as paymentService from '../services/paymentService';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusTone = (status) => (status === 'Confirmed' ? 'approved' : status === 'Pending' ? 'pending' : 'rejected');
const statusIcon = (status) => (status === 'Confirmed' ? '✓' : status === 'Pending' ? '⏳' : status === 'Rejected' ? '⛔' : status === 'Cancelled' ? '🚫' : '•');

const statusBadge = (status) => {
  const s = status || 'Pending';
  // Pending -> amber, Confirmed -> green, Rejected/Cancelled -> red; icon + text, never color alone
  return (
    <span className={`pro-status pro-status--${statusTone(s)}`}>
      <span className="pro-status-icon" aria-hidden="true">{statusIcon(s)}</span>
      <span>{s}</span>
    </span>
  );
};

const MyRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [cancelTarget, setCancelTarget] = useState(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const { addToast } = useToast();

  const fetchRegistrations = useCallback(async (targetPage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await registrationService.getMyRegistrations({ page: targetPage, limit: 10 });
      setRegistrations(res.data || []);
      setPagination(res.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRegistrations(page); }, [page, fetchRegistrations]);

  const handleCancelClick = (reg) => {
    setCancelTarget(reg);
    setIsCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await registrationService.cancelRegistration(cancelTarget._id);
      addToast('Registration cancelled successfully', 'success');
      setIsCancelOpen(false);
      setCancelTarget(null);
      fetchRegistrations(page);
    } catch (err) {
      addToast(err.message || 'Failed to cancel', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handlePayNow = async (reg) => {
    if (!reg?._id || payingId) return;
    setPayingId(reg._id);
    try {
      const orderRes = await paymentService.createPaymentOrder(reg._id);
      if (orderRes.data?.alreadyPaid) {
        addToast('Payment already completed', 'success');
        fetchRegistrations(page);
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
        addToast('Payment gateway unavailable (network restricted). Please try again.', 'warning');
        return;
      }
      if (!window.Razorpay) {
        addToast('Payment gateway failed to load.', 'error');
        return;
      }
      const evTitle = reg.event?.title || 'Event';
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
              registrationId: reg._id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
            addToast('Payment successful! Registration confirmed.', 'success');
            fetchRegistrations(page);
          } catch (verifyErr) {
            addToast(verifyErr.message || 'Payment verification failed', 'error');
            fetchRegistrations(page);
          }
        },
        prefill: { name: reg.name, email: reg.email, contact: reg.phone },
        theme: { color: '#2563eb' },
        modal: { ondismiss: () => { addToast('Payment cancelled. You can retry.', 'warning'); } }
      };
      new window.Razorpay(options).open();
    } catch (err) {
      addToast(err.message || 'Failed to initiate payment', 'error');
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-container">
        <header className="page-header">
          <div>
            <h1 className="page-title">My Registrations</h1>
            <p className="page-subtitle">Track your event registrations and their status</p>
          </div>
          <Link to="/events" className="btn-secondary">Browse Events</Link>
        </header>

        {loading && <SkeletonSchemesGrid count={4} />}
        {error && !loading && <ErrorState message={error} onRetry={() => fetchRegistrations(page)} />}
        {!loading && !error && registrations.length === 0 && (
          <EmptyState icon="📋" title="No registrations yet." description="You haven't registered for any events yet. Browse approved events to register." action={<Link to="/events" className="btn-primary">Browse Events</Link>} />
        )}

        {!loading && !error && registrations.length > 0 && (
          <>
            <div className="schemes-grid">
              {registrations.map((reg) => {
                const ev = reg.event || {};
                const canCancel = reg.status === 'Pending' || reg.status === 'Confirmed';
                return (
                  <article key={reg._id} className="scheme-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ height: '140px', overflow: 'hidden', background: '#f1f5f9', position: 'relative' }}>
                      <img src={ev.imageUrl || coverPlaceholder({ title: ev.title, category: ev.category, state: ev.state, sourceType: ev.sourceType, type: 'event' })} alt={ev.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      <span className={`pro-status pro-status--${statusTone(reg.status)}`} style={{ position: 'absolute', top: '10px', right: '10px' }}>
                        <span className="pro-status-icon" aria-hidden="true">{statusIcon(reg.status)}</span>
                        <span>{reg.status}</span>
                      </span>
                    </div>
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ev.title || 'Event'}</h3>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '0.76rem', color: '#475569' }}>
                        <span style={{ background: '#f8fafc', border: '1px solid #f1f5f9', padding: '3px 7px', borderRadius: '999px' }}>📅 {formatDate(ev.eventDate)}</span>
                        {ev.location && <span style={{ background: '#f8fafc', border: '1px solid #f1f5f9', padding: '3px 7px', borderRadius: '999px' }}>📍 {ev.location.length > 18 ? ev.location.slice(0, 18) + '...' : ev.location}</span>}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span><strong>Guests:</strong> {reg.numberOfGuests}</span>
                        <span>· {formatDate(reg.createdAt)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {ev.isPaidEvent && ev.registrationFee > 0 ? (
                          <>
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#92400e' }}>₹{ev.registrationFee}</span>
                            <span className={`status-badge ${reg.paymentStatus === 'Paid' ? 'status-active' : reg.paymentStatus === 'Pending' ? 'status-draft' : 'status-inactive'}`}>{reg.paymentStatus || 'Unpaid'}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.74rem', color: '#15803d', background: '#f0fdf4', border: '1px solid #dcfce7', padding: '2px 7px', borderRadius: '999px' }}>FREE</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                      <Link to={`/events/${ev._id || ev}`} className="btn-card-secondary" style={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#ffffff', color: '#334155', textDecoration: 'none' }}>View Event</Link>
                      <Link to={`/registrations/${reg._id}`} className="btn-card-secondary" style={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#ffffff', color: '#334155', textDecoration: 'none' }}>View Registration</Link>
                      {reg.status === 'Confirmed' && (
                        <Link to={`/registrations/${reg._id}/ticket`} className="pro-ticket-cta" style={{ flex: 1, textAlign: 'center' }} aria-label={`View ticket for ${ev.title || 'event'}`}>
                          <span aria-hidden="true">🎟</span> View Ticket
                        </Link>
                      )}
                      {ev.isPaidEvent && ev.registrationFee > 0 && reg.paymentStatus !== 'Paid' && reg.status === 'Pending' && (
                        <button type="button" onClick={() => handlePayNow(reg)} disabled={payingId === reg._id} className="btn-card-secondary" style={{ flex: 1, fontSize: '0.78rem', padding: '7px 10px', border: '1px solid #fde68a', color: '#92400e', background: '#fffbeb', borderRadius: '8px', cursor: 'pointer' }}>{payingId === reg._id ? 'Processing...' : 'Pay Now'}</button>
                      )}
                      {canCancel && (
                        <button type="button" onClick={() => handleCancelClick(reg)} className="btn-card-secondary" style={{ flex: 1, fontSize: '0.78rem', padding: '7px 10px', border: '1px solid #fecaca', color: '#b91c1c', background: '#ffffff', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {pagination.pages > 1 && (
              <div className="pagination" role="navigation" aria-label="Pagination">
                <button className="btn-secondary pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Previous</button>
                <span className="pagination-info">Page <strong>{page}</strong> of <strong>{pagination.pages}</strong></span>
                <button className="btn-secondary pagination-btn" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>Next →</button>
              </div>
            )}
          </>
        )}

        <ConfirmModal
          isOpen={isCancelOpen}
          onClose={() => { setIsCancelOpen(false); setCancelTarget(null); }}
          onConfirm={handleConfirmCancel}
          title="Cancel Registration"
          message={`Are you sure you want to cancel this registration?${cancelTarget?.event?.title ? ` for "${cancelTarget.event.title}"` : ''}`}
          confirmText="Cancel Registration"
          cancelText="Keep Registration"
          loading={isCancelling}
          danger={true}
        />
      </div>
    </div>
  );
};

export default MyRegistrations;
