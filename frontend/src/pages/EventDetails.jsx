import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getEventImage } from '../utils/images';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonDetails } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import BackButton from '../components/BackButton';
import RegistrationModal from '../components/RegistrationModal';
import ConfirmModal from '../components/ConfirmModal';
import * as eventService from '../services/eventService';
import * as registrationService from '../services/registrationService';
import * as paymentService from '../services/paymentService';
import { getSchemeById } from '../services/schemeService';
import EventReviews from '../components/EventReviews';
import AddToCalendar from '../components/AddToCalendar';

const formatDate = (d) => {
  if (!d) return 'TBA';
  const date = new Date(d);
  if (isNaN(date.getTime())) return 'TBA';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, isOrganizer, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(null);
  const [linkedScheme, setLinkedScheme] = useState(null);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [isAdminDeleteOpen, setIsAdminDeleteOpen] = useState(false);

  const fetchEvent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventService.getEventById(id);
      setEvent(res.data);
      if (res.data?.schemeId) {
        getSchemeById(res.data.schemeId).then(sch => {
          setLinkedScheme(sch.data || null);
        }).catch(() => setLinkedScheme(null));
      }
    } catch (err) {
      setError(err.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvent(); }, [id]);

  const handleAdminStatusChange = async (newStatus) => {
    if (!event) return;
    setAdminActionLoading(true);
    try {
      await eventService.updateEventStatus(event._id, newStatus);
      setEvent(prev => (prev ? { ...prev, status: newStatus } : prev));
      addToast(`Event ${newStatus.toLowerCase()} successfully`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update event status', 'error');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminDelete = async () => {
    if (!event) return;
    setAdminActionLoading(true);
    try {
      await eventService.deleteEvent(event._id);
      addToast('Event deleted successfully', 'success');
      setIsAdminDeleteOpen(false);
      navigate('/admin');
    } catch (err) {
      addToast(err.message || 'Failed to delete event', 'error');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleRegister = async (formData) => {
    setRegisterLoading(true);
    try {
      const res = await registrationService.createRegistration(formData);
      const regId = res.data?._id;
      // Close modal immediately after successful registration so UI does not appear stuck
      setRegisterSuccess(res.data);
      setShowRegister(false);
      // Check if this is a paid event
      if (event.isPaidEvent && event.registrationFee > 0) {
        try {
          const orderRes = await paymentService.createPaymentOrder(regId);
          if (orderRes.data?.alreadyPaid) {
            addToast('Registration submitted successfully', 'success');
          } else {
            // Load Razorpay checkout (reuse if already loaded, handle network restrictions gracefully)
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
            } catch (loadErr) {
              addToast('Payment gateway unavailable (network restricted). You can retry payment from My Registrations.', 'warning');
              fetchEvent();
              return;
            }
            if (!window.Razorpay) {
              addToast('Payment gateway failed to load. Please retry from My Registrations.', 'error');
              fetchEvent();
              return;
            }
            const options = {
              key: orderRes.data.razorpayKeyId,
              amount: Math.round(orderRes.data.amount * 100),
              currency: orderRes.data.currency || 'INR',
              name: event.title,
              description: `Registration for ${event.title}`,
              order_id: orderRes.data.orderId,
              handler: async (response) => {
                try {
                  await paymentService.verifyPayment({
                    registrationId: regId,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature
                  });
                  addToast('Payment successful! Registration confirmed. Ticket available.', 'success');
                } catch (verifyErr) {
                  addToast(verifyErr.message || 'Payment verification failed', 'error');
                }
                fetchEvent();
              },
              prefill: { name: formData.name, email: formData.email, contact: formData.phone },
              theme: { color: '#2563eb' },
              modal: { ondismiss: () => { addToast('Payment cancelled. You can retry from My Registrations.', 'warning'); fetchEvent(); } }
            };
            new window.Razorpay(options).open();
          }
        } catch (payErr) {
          addToast(payErr.message || 'Failed to initiate payment', 'error');
        }
      } else {
        addToast('Registration Submitted Successfully', 'success');
        fetchEvent();
      }
      return res;
    } catch (err) {
      throw err;
    } finally {
      setRegisterLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="page-container" style={{ maxWidth: '900px' }}>
          <BackButton label="Back to Events" />
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
          <ErrorState message={error} onRetry={fetchEvent} onSecondary={() => navigate('/events')} secondaryLabel="Browse Events" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="page-wrapper">
        <div className="page-container" style={{ maxWidth: '900px' }}>
          <BackButton label="Back" />
          <EmptyState icon="🔍" title="Event not found" description="The event you are looking for does not exist." action={<Link to="/events" className="btn-primary">Browse Events</Link>} />
        </div>
      </div>
    );
  }

  const now = new Date();
  const eventDate = event.eventDate ? new Date(event.eventDate) : null;
  const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;
  const isPast = eventDate && eventDate < now;
  const isDeadlinePassed = deadline && deadline < now;
  const isFull = event.capacity && (event.registrationCount || 0) >= event.capacity;
  const availableSeats = event.capacity ? Math.max(0, event.capacity - (event.registrationCount || 0)) : null;

  const getRegisterState = () => {
    if (!isAuthenticated()) return { disabled: false, label: 'Login to Register', action: () => navigate('/login'), reason: null };
    if (user?.role === 'organizer' || user?.role === 'admin') return { disabled: true, label: 'Organizer/Admin cannot register', reason: 'Organizer/Admin cannot register as participant' };
    if (isPast) return { disabled: true, label: 'Event Has Ended', reason: 'Event Has Ended' };
    if (isDeadlinePassed) return { disabled: true, label: 'Registration Closed', reason: 'Registration Closed' };
    if (isFull) return { disabled: true, label: 'Event Full', reason: 'Event Full' };
    return { disabled: false, label: 'Register Now', action: () => setShowRegister(true), reason: null };
  };

  const registerState = getRegisterState();

  return (
    <div className="page-wrapper page-scheme-detail">
      <div className="page-container" style={{ maxWidth: '900px' }}>
        <nav className="pro-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">→</span>
          <Link to="/events">Events</Link>
          <span aria-hidden="true">→</span>
          <span className="pro-breadcrumb-current" aria-current="page">{event.title}</span>
        </nav>
        <BackButton label="Back to Events" />

        <article className="scheme-detail-wrapper fade-in">
           <div className="pro-detail-hero" style={{ height: '260px' }}>
              <img src={getEventImage(event)} alt={`${event.title} — ${event.department || event.category} government event`} loading="lazy" />
            </div>

          <header className="scheme-detail-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="scheme-detail-title">{event.title}</h1>
              <div className="scheme-detail-meta">
                <span className="category-badge">{event.category}</span>
                <span className={`status-badge ${event.status === 'Approved' ? 'status-active' : event.status === 'Rejected' ? 'status-inactive' : 'status-draft'}`}>{event.status}</span>
                {event.eventFormat && (
                  <span className="pro-meta-chip" title={`Event format: ${event.eventFormat}`}>
                    <span aria-hidden="true">{event.eventFormat === 'online' ? '💻' : event.eventFormat === 'hybrid' ? '🔀' : '🏢'}</span>
                    <span>{event.eventFormat.charAt(0).toUpperCase() + event.eventFormat.slice(1)}</span>
                  </span>
                )}
                {event.isPaidEvent && event.registrationFee > 0 ? (
                  <span className="pro-fee-pill pro-fee-pill--paid" aria-label={`Paid event, fee rupees ${event.registrationFee}`}>
                    <span aria-hidden="true">🎟️</span>
                    <span>Paid · ₹{event.registrationFee} per guest</span>
                  </span>
                ) : (
                  <span className="pro-fee-pill pro-fee-pill--free">
                    <span aria-hidden="true">✓</span>
                    <span>Free</span>
                  </span>
                )}
                {isPast && (
                  <span className="pro-ended-pill" role="status">
                    <span aria-hidden="true">■</span>
                    <span>Event ended</span>
                  </span>
                )}
              </div>
              <div className="pro-event-date" style={{ marginTop: '12px' }} aria-label={`Event date and time: ${formatDate(event.eventDate)}`}>
                <span className="pro-date-block" aria-hidden="true">
                  {(() => {
                    const d = eventDate && !isNaN(eventDate.getTime()) ? eventDate : null;
                    if (!d) return (<><span className="pro-date-day">–</span><span className="pro-date-month">TBA</span></>);
                    return (<>
                      <span className="pro-date-day">{d.toLocaleDateString('en-IN', { day: '2-digit' })}</span>
                      <span className="pro-date-month">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                      <span className="pro-date-year">{d.toLocaleDateString('en-IN', { year: 'numeric' })}</span>
                    </>);
                  })()}
                </span>
                <span className="pro-date-text">
                  📅 {formatDate(event.eventDate)}
                  {event.location && <><br />📍 {event.location}</>}
                  {deadline && <><br />⏰ Deadline: {formatDate(deadline)}</>}
                </span>
              </div>
            </div>
            <div className="scheme-detail-actions">
              {isAuthenticated() && user?.role === 'user' && !registerState.disabled && (
                <button className="btn-primary" onClick={registerState.action} disabled={registerState.disabled}>{registerState.label}</button>
              )}
              {isAuthenticated() && user?.role === 'user' && registerState.disabled && registerState.reason && (
                <span style={{ fontSize: '0.82rem', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '10px', fontWeight: 600 }}>{registerState.reason}</span>
              )}
              {!isAuthenticated() && (
                <button className="btn-primary" onClick={() => navigate('/login')}>Login to Register</button>
              )}
              {isAdmin() && event && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {event.status === 'Pending' && (
                    <button className="btn-primary" onClick={() => handleAdminStatusChange('Approved')} disabled={adminActionLoading}>Approve</button>
                  )}
                  {event.status === 'Pending' && (
                    <button className="btn-secondary" onClick={() => handleAdminStatusChange('Rejected')} disabled={adminActionLoading} style={{ borderColor: '#fecaca', color: '#b91c1c' }}>Reject</button>
                  )}
                  <button className="btn-secondary" onClick={() => setIsAdminDeleteOpen(true)} disabled={adminActionLoading} style={{ borderColor: '#fecaca', color: '#b91c1c' }}>Delete</button>
                </div>
              )}
            </div>
          </header>

          <div className="scheme-detail-grid">
            <section className="scheme-section-card">
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">📝</div>
                <h2 className="scheme-section-title">Description</h2>
              </div>
              <div className="scheme-section-body"><p>{event.description || 'Not specified'}</p></div>
            </section>

            <section className="pro-info-panel" aria-label="Date, time and location">
              <h2>Date, time &amp; location</h2>
              <div className="pro-info-grid">
                <div className="pro-info-item">
                  <span className="pro-info-label">Date &amp; time</span>
                  <span className="pro-info-value">{formatDate(event.eventDate)}</span>
                </div>
                <div className="pro-info-item">
                  <span className="pro-info-label">Location</span>
                  <span className="pro-info-value">{event.location || '—'}</span>
                </div>
                <div className="pro-info-item">
                  <span className="pro-info-label">Format</span>
                  <span className="pro-info-value">{event.eventFormat ? event.eventFormat.charAt(0).toUpperCase() + event.eventFormat.slice(1) : '—'}</span>
                </div>
                <div className="pro-info-item">
                  <span className="pro-info-label">Registration deadline</span>
                  <span className="pro-info-value">{deadline ? formatDate(deadline) : '—'}</span>
                </div>
                <div className="pro-info-item">
                  <span className="pro-info-label">Department</span>
                  <span className="pro-info-value">{event.department || '—'}</span>
                </div>
                <div className="pro-info-item">
                  <span className="pro-info-label">District / State</span>
                  <span className="pro-info-value">{[event.district, event.state].filter(Boolean).join(', ') || '—'}</span>
                </div>
              </div>
              {event.capacity ? (
                <div style={{ marginTop: '12px' }} role="status" aria-label={isFull ? 'Event is full' : `${availableSeats} of ${event.capacity} seats left`}>
                  <div className="pro-capacity-meta">
                    <span><strong>{event.registrationCount || 0}</strong> / {event.capacity} registered</span>
                    <span>{isFull ? 'Event full' : `${availableSeats} seats left`}</span>
                  </div>
                  <div className="pro-capacity-bar" aria-hidden="true">
                    <div
                      className={`pro-capacity-fill${isFull ? ' pro-capacity-fill--full' : ''}`}
                      style={{ width: `${Math.min(100, Math.round(((event.registrationCount || 0) / event.capacity) * 100))}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="pro-capacity-meta" role="status">
                  <span><strong>{event.registrationCount || 0}</strong> registered · Unlimited capacity</span>
                </div>
              )}
            </section>

            {(event.eligibility || event.benefits) && (
              <>
                {event.eligibility && (
                  <section className="scheme-section-card">
                    <div className="scheme-section-head">
                      <div className="scheme-section-icon" aria-hidden="true">✓</div>
                      <h2 className="scheme-section-title">Eligibility</h2>
                    </div>
                    <div className="scheme-section-body"><p>{event.eligibility}</p></div>
                  </section>
                )}
                {event.benefits && (
                  <section className="scheme-section-card">
                    <div className="scheme-section-head">
                      <div className="scheme-section-icon" aria-hidden="true">🎁</div>
                      <h2 className="scheme-section-title">Benefits</h2>
                    </div>
                    <div className="scheme-section-body"><p>{event.benefits}</p></div>
                  </section>
                )}
              </>
            )}

            <section className="scheme-section-card">
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">📄</div>
                <h2 className="scheme-section-title">Required Documents</h2>
              </div>
              <div className="scheme-section-body">
                {Array.isArray(event.documentsRequired) && event.documentsRequired.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {event.documentsRequired.map((doc, i) => <span key={i} className="doc-chip">{doc}</span>)}
                  </div>
                ) : <p className="scheme-muted">No documents required</p>}
              </div>
            </section>

            {(event.department || event.sourceType || event.eventFormat || (event.targetAudience && event.targetAudience.length > 0) || event.ward || event.district || event.state || event.contactInfo || linkedScheme) && (
              <section className="scheme-section-card">
                <div className="scheme-section-head">
                  <div className="scheme-section-icon" aria-hidden="true">🏛️</div>
                  <h2 className="scheme-section-title">Government Event Details</h2>
                </div>
                <div className="scheme-section-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                  {event.department && <div><strong>Department:</strong> {event.department}</div>}
                  {linkedScheme && (
                    <div>
                      <strong>Related Scheme:</strong>{' '}
                      <Link to={`/schemes/${linkedScheme._id}`} className="gov-scheme-link">View {linkedScheme.title} ↗</Link>
                    </div>
                  )}
                  {event.sourceType && <div><strong>Source:</strong> {event.sourceType}</div>}
                  {event.eventFormat && <div><strong>Format:</strong> {event.eventFormat.charAt(0).toUpperCase() + event.eventFormat.slice(1)}</div>}
                  {event.targetAudience && event.targetAudience.length > 0 && (
                    <div>
                      <strong>Target Audience:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                        {event.targetAudience.map((a, i) => (
                          <span key={i} style={{ fontSize: '0.78rem', color: '#1e40af', background: '#eff6ff', border: '1px solid #dbeafe', padding: '3px 10px', borderRadius: '16px' }}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(event.ward || event.district || event.state) && (
                    <div>
                      <strong>Location Details:</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', color: '#475569' }}>
                        {event.ward && <div>Ward: {event.ward}</div>}
                        {event.district && <div>District: {event.district}</div>}
                        {event.state && <div>State: {event.state}</div>}
                      </div>
                    </div>
                  )}
                  {event.contactInfo && <div><strong>Contact:</strong> {event.contactInfo}</div>}
                </div>
              </section>
            )}

            <section className="scheme-section-card" style={{ gridColumn: '1 / -1' }}>
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">📍</div>
                <h2 className="scheme-section-title">Location</h2>
              </div>
              <div className="scheme-section-body">
                {event.location ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{event.location}</div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pro-map-link"
                    >
                      <span aria-hidden="true">🗺️</span> Open in Google Maps
                    </a>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.88rem', color: '#94a3b8', fontStyle: 'italic' }}>Location not specified</p>
                )}
              </div>
            </section>

            {event.eventDate && (
              <section className="scheme-section-card">
                <div className="scheme-section-head">
                  <div className="scheme-section-icon" aria-hidden="true">📅</div>
                  <h2 className="scheme-section-title">Add to Calendar</h2>
                </div>
                <div className="scheme-section-body">
                  <AddToCalendar event={event} />
                </div>
              </section>
            )}

            <section className="scheme-section-card">
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">👤</div>
                <h2 className="scheme-section-title">Organizer</h2>
              </div>
              <div className="scheme-section-body">
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{event.organizer?.name || event.organizer?.organizationName || 'Organizer'}</div>
                {event.organizer?.email && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{event.organizer.email}</div>}
                {event.organizer?.organizationName && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{event.organizer.organizationName}</div>}
              </div>
            </section>
          </div>

          <section className="pro-reg-card" aria-label="Registration">
            <h2>Registration</h2>
            {isPast ? (
              <p>This event has ended. Registration is no longer available.</p>
            ) : isDeadlinePassed ? (
              <p>The registration deadline has passed for this event.</p>
            ) : isFull ? (
              <p>This event is full. No seats are currently available.</p>
            ) : event.isPaidEvent && event.registrationFee > 0 ? (
              <p>Paid event — <strong>₹{event.registrationFee}</strong> per guest. Registration opens the secure Razorpay checkout.</p>
            ) : (
              <p>Free event — reserve your seat by registering below.</p>
            )}
            <div className="pro-action-row">
              {!isAuthenticated() ? (
                <button type="button" className="btn-primary" onClick={() => navigate('/login')}>Login to Register</button>
              ) : user?.role === 'user' ? (
                registerState.disabled ? (
                  <span className={`pro-reg-state ${isPast || isDeadlinePassed || isFull ? 'pro-reg-state--blocked' : 'pro-reg-state--muted'}`} role="status">
                    <span aria-hidden="true">{isPast ? '■' : isFull ? '⛔' : '⏸'}</span>
                    <span>{registerState.reason || registerState.label}</span>
                  </span>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => setShowRegister(true)}>
                    {event.isPaidEvent && event.registrationFee > 0 ? 'Register & Pay' : 'Register Now'}
                  </button>
                )
              ) : (
                <span className="pro-reg-state pro-reg-state--muted" role="status">
                  <span aria-hidden="true">👁</span>
                  <span>{user?.role === 'organizer' ? 'Organizer view — registration disabled' : 'Admin view — registration disabled'}</span>
                </span>
              )}
              <Link to="/events" className="btn-secondary">Browse Events</Link>
            </div>
          </section>
        </article>

        {/* Reviews Section */}
        <div className="pro-review-card" style={{ marginTop: '20px', padding: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span aria-hidden="true">⭐</span> Reviews & Ratings
          </h2>
          <EventReviews eventId={event._id} isAuthenticated={isAuthenticated()} user={user} userRole={user?.role} />
        </div>

        <RegistrationModal
          isOpen={showRegister}
          onClose={() => { setShowRegister(false); setRegisterSuccess(null); }}
          onSubmit={handleRegister}
          event={event}
          loading={registerLoading}
        />

        <ConfirmModal
          isOpen={isAdminDeleteOpen}
          onClose={() => setIsAdminDeleteOpen(false)}
          onConfirm={handleAdminDelete}
          title="Delete Event"
          message={`Are you sure you want to delete "${event?.title}"? This action cannot be undone.`}
          confirmText="Delete Event"
          loading={adminActionLoading}
          danger={true}
        />

        {registerSuccess && (
          <div style={{ marginTop: '16px', background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#15803d', marginBottom: '8px' }}>Registration Submitted Successfully</div>
            <div style={{ fontSize: '0.9rem', color: '#334155', marginBottom: '6px' }}>
              <strong>{event.title}</strong> — <span className="status-badge status-active" style={{ fontSize: '0.7rem' }}>Pending</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              Guests: <strong>{registerSuccess.numberOfGuests}</strong> · Date: {new Date(registerSuccess.createdAt || Date.now()).toLocaleDateString('en-IN')}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
              <Link to="/my-registrations" className="btn-primary">View My Registrations</Link>
              <button className="btn-secondary" onClick={() => setRegisterSuccess(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetails;
