import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getEventImage } from '../utils/images';

const formatShortDate = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: d.toLocaleDateString('en-IN', { month: 'short' }),
    year: d.toLocaleDateString('en-IN', { year: 'numeric' }),
    full: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  };
};

const formatTime = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const capitalize = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const EventCard = ({ event }) => {
  const [imgError, setImgError] = useState(false);
  const availableSeats = event.capacity ? Math.max(0, event.capacity - (event.registrationCount || 0)) : null;
  const isFull = event.capacity && availableSeats === 0;
  const organizerName = event.organizer?.name || event.organizer?.organizationName || 'Organizer';
  const cover = getEventImage(event);
  const date = formatShortDate(event.eventDate);
  const time = formatTime(event.eventDate);
  const isPaid = event.isPaidEvent && event.registrationFee > 0;
  const ended = (() => {
    if (!event.eventDate) return false;
    const d = new Date(event.eventDate);
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
  })();

  return (
    <article
      className="scheme-card event-card"
      aria-labelledby={`event-title-${event._id}`}
    >
      <Link to={`/events/${event._id}`} className="scheme-card-image-wrap event-card-image-wrap" aria-label={`View ${event.title}`}>
        <img src={(!imgError && event.imageUrl) ? event.imageUrl : cover} alt={`${event.title} — ${event.department || event.category} government event`} className="scheme-card-image" loading="lazy" onError={() => setImgError(true)} />
        <div className="scheme-card-image-overlay">
          <span className="category-badge" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', borderColor: 'rgba(255,255,255,0.9)', color: '#0f172a' }}>{event.category}</span>
        </div>
      </Link>

      <div className="scheme-card-body event-card-body">
        <Link to={`/events/${event._id}`} className="scheme-card-title-link" style={{ textDecoration: 'none' }}>
          <h3 id={`event-title-${event._id}`} className="scheme-card-title">{event.title}</h3>
        </Link>

        {date ? (
          <div className="pro-event-date" aria-label={`Event date: ${date.full}${time ? `, ${time}` : ''}`}>
            <span className="pro-date-block" aria-hidden="true">
              <span className="pro-date-day">{date.day}</span>
              <span className="pro-date-month">{date.month}</span>
              <span className="pro-date-year">{date.year}</span>
            </span>
            <span className="pro-date-text">
              {date.full}
              {time ? <><br />{time}</> : null}
            </span>
          </div>
        ) : (
          <div className="pro-event-date" aria-label="Event date to be announced">
            <span className="pro-date-block" aria-hidden="true">
              <span className="pro-date-day">–</span>
              <span className="pro-date-month">TBA</span>
            </span>
            <span className="pro-date-text">Date to be announced</span>
          </div>
        )}

        <div className="pro-meta-row">
          {event.location && (
            <span className="pro-meta-chip" title={event.location}>
              <span aria-hidden="true">📍</span>
              <span>{event.location.length > 24 ? event.location.slice(0, 24) + '…' : event.location}</span>
            </span>
          )}
          {event.eventFormat && (
            <span className="pro-meta-chip" title={`Event format: ${capitalize(event.eventFormat)}`}>
              <span aria-hidden="true">{event.eventFormat === 'online' ? '💻' : event.eventFormat === 'hybrid' ? '🔀' : '🏢'}</span>
              <span>{capitalize(event.eventFormat)}</span>
            </span>
          )}
          {event.department && (
            <span className="pro-meta-chip" title={event.department}>
              <span aria-hidden="true">🏛️</span>
              <span>{event.department.length > 22 ? event.department.slice(0, 22) + '…' : event.department}</span>
            </span>
          )}
          {event.sourceType && event.sourceType !== 'Local' && (
            <span className="pro-meta-chip" title={`Source: ${event.sourceType}`}>
              <span aria-hidden="true">🏷️</span>
              <span>{event.sourceType}</span>
            </span>
          )}
        </div>

        <div className="pro-meta-row">
          {isPaid ? (
            <span className="pro-fee-pill pro-fee-pill--paid" aria-label={`Paid event, fee rupees ${event.registrationFee}`}>
              <span aria-hidden="true">🎟️</span>
              <span>Paid · ₹{event.registrationFee}</span>
            </span>
          ) : (
            <span className="pro-fee-pill pro-fee-pill--free">
              <span aria-hidden="true">✓</span>
              <span>Free</span>
            </span>
          )}
          {ended ? (
            <span className="pro-ended-pill">
              <span aria-hidden="true">■</span>
              <span>Event ended</span>
            </span>
          ) : event.capacity ? (
            <span className={`pro-seats-note${isFull ? ' pro-seats-note--full' : availableSeats <= Math.ceil(event.capacity * 0.2) ? ' pro-seats-note--low' : ''}`}>
              {isFull ? 'Event full' : `${availableSeats} of ${event.capacity} seats left`}
            </span>
          ) : (
            <span className="pro-seats-note">{event.registrationCount || 0} registered</span>
          )}
        </div>

        <div style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          by {organizerName}
        </div>
      </div>

      <div className="scheme-card-footer event-card-footer">
        <Link to={`/events/${event._id}`} className="btn-card-primary">View Details</Link>
      </div>
    </article>
  );
};

export default EventCard;
