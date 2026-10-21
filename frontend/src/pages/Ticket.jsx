import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { coverPlaceholder } from '../utils/placeholder';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import BackButton from '../components/BackButton';
import { SkeletonDetails } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import * as ticketService from '../services/ticketService';

const formatDateTime = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Ticket = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const fetchTicket = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ticketService.getTicket(id);
      setTicket(res.data);
      if (res.data?.qrPayload) {
        try {
          const QRCode = await import('qrcode');
          const url = await QRCode.toDataURL(res.data.qrPayload, { width: 200, margin: 1 });
          setQrDataUrl(url);
        } catch (e) {
          console.error('QR generation failed', e);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTicket(); }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="page-container" style={{ maxWidth: '720px' }}>
          <BackButton label="Back to Registration" to={`/registrations/${id}`} />
          <SkeletonDetails />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="page-container" style={{ maxWidth: '720px' }}>
          <BackButton label="Back to Registration" to={`/registrations/${id}`} />
          <ErrorState message={error} onRetry={fetchTicket} onSecondary={() => navigate(`/registrations/${id}`)} secondaryLabel="Back to Registration" />
          {error.toLowerCase().includes('not available') || error.toLowerCase().includes('pending') ? (
            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Only confirmed registrations have active tickets. Current status may be pending, rejected or cancelled.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="page-wrapper">
        <div className="page-container" style={{ maxWidth: '720px' }}>
          <BackButton label="Back to Registration" to={`/registrations/${id}`} />
          <ErrorState message="Ticket not found" onRetry={fetchTicket} />
        </div>
      </div>
    );
  }

  const ev = ticket.event || {};
  const attendee = ticket.attendee || {};

  return (
    <div className="page-wrapper" style={{ background: 'var(--surface-muted)' }}>
      <div className="page-container" style={{ maxWidth: '720px' }}>
        <BackButton label="Back to Registration" to={`/registrations/${id}`} />

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)', marginTop: '16px' }}>
          {/* Header */}
          <div style={{ background: 'var(--brand-primary)', color: 'var(--brand-text-on-primary)', padding: '20px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8, marginBottom: '6px' }}>Event Ticket</div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{ev.title || 'Event Ticket'}</h1>
            <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '6px' }}>{ev.category || ''} {ev.category ? '·' : ''} {ev.status || ''}</div>
          </div>

          {/* Event Image */}
          <div style={{ height: '180px', overflow: 'hidden', background: 'var(--surface-muted)', borderBottom: '1px solid var(--border)' }}>
            <img src={coverPlaceholder({ title: ev.title, category: ev.category, state: ev.state, sourceType: ev.sourceType, type: 'event' })} alt={ev.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>

          {/* Event Details */}
          <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', borderBottom: '1px solid var(--surface-muted)' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Event</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{ev.title || '—'}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{ev.category || ''}</div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>Date:</strong> {formatDate(ev.eventDate)}</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Time:</strong> {ev.eventDate ? new Date(ev.eventDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Location:</strong> {ev.location || '—'}</div>
            </div>
          </div>

          {/* Attendee */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-muted)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Attendee</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>{attendee.name || '—'}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{attendee.email || ''}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{attendee.phone || ''}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Ticket</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}><strong>ID:</strong> <span style={{ fontFamily: 'ui-monospace, monospace', background: 'var(--surface-muted)', padding: '2px 6px', borderRadius: '6px', fontSize: '0.78rem' }}>{ticket.ticketId}</span></div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}><strong>Guests:</strong> {ticket.numberOfGuests}</div>
              <div style={{ marginTop: '6px' }}>
                <span className={`status-badge ${ticket.ticketStatus === 'Active' ? 'status-active' : ticket.ticketStatus === 'Used' ? 'status-inactive' : ticket.ticketStatus === 'Cancelled' ? 'status-inactive' : 'status-draft'}`}>{ticket.ticketStatus}</span>
                {registration?.paymentStatus && (
                  <span className={`status-badge ${registration.paymentStatus === 'Paid' ? 'status-active' : registration.paymentStatus === 'Failed' ? 'status-inactive' : registration.paymentStatus === 'Pending' ? 'status-draft' : 'status-draft'}`} style={{ marginLeft: '6px' }}>
                    {event.isPaidEvent ? (registration.paymentStatus || 'Unpaid') : 'FREE'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div style={{ padding: '20px 24px', textAlign: 'center', borderBottom: '1px solid var(--surface-muted)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>QR Code</div>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR for ${ticket.ticketId}`} style={{ width: '200px', height: '200px', border: '1px solid var(--border)', borderRadius: '12px', padding: '8px', background: '#ffffff' }} />
            ) : (
              <div style={{ width: '200px', height: '200px', margin: '0 auto', border: '1px dashed var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Generating QR...</div>
            )}
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '8px', wordBreak: 'break-all' }}>{ticket.qrPayload}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Contains ticketId, registrationId, eventId only</div>
          </div>

          {/* Issued */}
          <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--surface-muted)', borderTop: '1px solid var(--surface-muted)' }}>
            <span>Issued: {formatDateTime(ticket.ticketIssuedAt)}</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', background: 'var(--surface)', border: '1px solid var(--border)', padding: '3px 7px', borderRadius: '6px' }}>{ticket.ticketId}</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '16px' }}>
          <button onClick={handlePrint} className="btn-primary" style={{ padding: '10px 18px' }}>Print Ticket</button>
          <Link to={`/registrations/${id}`} className="btn-secondary" style={{ padding: '10px 18px', textDecoration: 'none' }}>Back to Registration</Link>
          <Link to={`/events/${ticket.eventId || ev._id || ''}`} className="btn-secondary" style={{ padding: '10px 18px', textDecoration: 'none' }}>View Event</Link>
        </div>
      </div>

      <style>{`@media print { .page-wrapper { background: #fff !important; } nav, footer, .btn-secondary, .btn-primary { display: none !important; } }`}</style>
    </div>
  );
};

export default Ticket;
