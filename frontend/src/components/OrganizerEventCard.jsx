import { useState } from 'react';
import { Link } from 'react-router-dom';
import { coverPlaceholder } from '../utils/placeholder';

const formatDate = (dateStr) => {
  if (!dateStr) return 'TBA';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'TBA';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

  const OrganizerEventCard = ({ event, onEdit, onDelete, onViewRegistrations }) => {
    const [imgError, setImgError] = useState(false);
    const statusTone = event.status === 'Approved' ? 'approved' : event.status === 'Pending' ? 'pending' : event.status === 'Rejected' ? 'rejected' : 'draft';
    const statusIcon = event.status === 'Approved' ? '✓' : event.status === 'Pending' ? '⏳' : event.status === 'Rejected' ? '⛔' : '📝';
  const cover = coverPlaceholder({ title: event.title, category: event.category, state: event.state, sourceType: event.sourceType, type: 'event' });

  return (
    <article className="scheme-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="scheme-card-image-wrap" style={{ height: '140px', position: 'relative', overflow: 'hidden', background: 'var(--surface-muted)' }}>
        <img src={(!imgError && event.imageUrl) ? event.imageUrl : cover} alt={event.title} className="scheme-card-image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" onError={() => setImgError(true)} />
        <span className={`pro-status pro-status--${statusTone}`} style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <span className="pro-status-icon" aria-hidden="true">{statusIcon}</span>
          <span>{event.status}</span>
        </span>
      </div>

      <div className="scheme-card-body" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <h3 className="scheme-card-title" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.title}</h3>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="category-badge">{event.category}</span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{formatDate(event.eventDate)}</span>
        </div>
        {event.location && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📍 {event.location}</div>}
        {(event.department || event.eventFormat || event.sourceType) && (
          <div className="pro-meta-row" style={{ marginTop: '2px' }}>
            {event.department && <span className="pro-meta-chip" title={event.department}><span aria-hidden="true">🏛️</span><span>{event.department.length > 20 ? event.department.slice(0, 20) + '…' : event.department}</span></span>}
            {event.eventFormat && <span className="pro-meta-chip"><span aria-hidden="true">{event.eventFormat === 'online' ? '💻' : event.eventFormat === 'hybrid' ? '🔀' : '🏢'}</span><span>{event.eventFormat.charAt(0).toUpperCase() + event.eventFormat.slice(1)}</span></span>}
            {event.sourceType && <span className="pro-meta-chip"><span aria-hidden="true">🏷️</span><span>{event.sourceType}</span></span>}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
          {event.isPaidEvent && event.registrationFee > 0 ? (
            <span className="pro-fee-pill pro-fee-pill--paid"><span aria-hidden="true">🎟️</span><span>₹{event.registrationFee}</span></span>
          ) : (
            <span className="pro-fee-pill pro-fee-pill--free"><span aria-hidden="true">✓</span><span>Free</span></span>
          )}
          <span style={{ background: 'var(--surface-muted)', border: '1px solid var(--surface-muted)', padding: '3px 7px', borderRadius: '999px' }}>{event.registrationCount || 0} registered</span>
          {event.capacity ? <span style={{ background: 'var(--surface-muted)', border: '1px solid var(--surface-muted)', padding: '3px 7px', borderRadius: '999px' }}>Capacity: {event.capacity}</span> : <span style={{ background: 'var(--success-subtle)', border: '1px solid var(--success)', color: 'var(--success)', padding: '3px 7px', borderRadius: '999px' }}>Unlimited</span>}
        </div>
      </div>

      <div className="scheme-card-footer" style={{ display: 'flex', gap: '8px', padding: '10px 14px', borderTop: '1px solid var(--surface-muted)', flexWrap: 'wrap' }}>
        <button type="button" className="btn-card-secondary" onClick={() => onEdit(event)} style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', cursor: 'pointer' }}>Edit</button>
        <button type="button" className="btn-card-secondary" onClick={() => onDelete(event)} style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', background: 'var(--surface)', cursor: 'pointer' }}>Delete</button>
        <button type="button" className="btn-card-primary" onClick={() => onViewRegistrations(event)} style={{ flex: 1, padding: '7px 10px', fontSize: '0.78rem', background: 'var(--brand-primary)', color: 'var(--brand-text-on-primary)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Registrations</button>
      </div>
    </article>
  );
};

export default OrganizerEventCard;
