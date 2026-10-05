import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { SkeletonSchemesGrid } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import BackButton from '../components/BackButton';
import * as registrationService from '../services/registrationService';
import * as eventService from '../services/eventService';

const EventRegistrations = () => {
  const { eventId } = useParams();
  const { addToast } = useToast();
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await eventService.getEventById(eventId);
      setEvent(res.data);
    } catch (err) {
    }
  }, [eventId]);

  const fetchRegistrations = useCallback(async (targetPage) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: targetPage, limit: 10, status: statusFilter || undefined, search: search.trim() || undefined };
      const res = await registrationService.getEventRegistrations(eventId, params);
      setRegistrations(res.data || []);
      setPagination(res.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [eventId, statusFilter, search]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);
  useEffect(() => { fetchRegistrations(page); }, [page, fetchRegistrations]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchRegistrations(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  const handleStatus = async (regId, newStatus) => {
    setUpdatingId(regId);
    try {
      await registrationService.updateRegistrationStatus(regId, newStatus);
      addToast(`Registration ${newStatus.toLowerCase()} successfully`, 'success');
      fetchRegistrations(page);
    } catch (err) {
      addToast(err.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const statusBadge = (status) => {
    const tone = status === 'Confirmed' ? 'approved' : status === 'Pending' ? 'pending' : 'rejected';
    const icon = status === 'Confirmed' ? '✓' : status === 'Pending' ? '⏳' : status === 'Rejected' ? '⛔' : '🚫';
    return (
      <span className={`pro-status pro-status--${tone}`}>
        <span className="pro-status-icon" aria-hidden="true">{icon}</span>
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="page-wrapper">
      <div className="page-container">
        <BackButton label="Back to Organizer Dashboard" to="/organizer" />

        <header className="page-header">
          <div>
            <h1 className="page-title" style={{ fontSize: '1.6rem' }}>Event Registrations</h1>
            {event ? (
              <p className="page-subtitle">
                <Link to={`/events/${event._id}`} className="link-inline">{event.title}</Link> · {event.category} · {event.location || 'No location'} · Capacity: {event.capacity || 'Unlimited'} · {event.registrationCount || 0} registered
              </p>
            ) : (
              <p className="page-subtitle">Loading event...</p>
            )}
          </div>
          <Link to="/organizer" className="btn-secondary">Back to Dashboard</Link>
        </header>

        <div className="admin-filters-bar">
          <div className="admin-filter-row">
            <input className="form-input admin-filter-search" type="search" placeholder="Search by name, email or phone..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search registrations" />
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: '180px' }}>
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading && <SkeletonSchemesGrid count={4} />}
        {error && !loading && <ErrorState message={error} onRetry={() => fetchRegistrations(page)} />}
        {!loading && !error && registrations.length === 0 && (
          <EmptyState icon="📋" title="No registrations yet." description="No attendees have registered for this event yet." />
        )}

        {!loading && !error && registrations.length > 0 && (
          <div className="admin-panel">
            <div className="admin-panel-header">
              <div className="admin-panel-title">Registrations <span className="section-count">({pagination.total})</span></div>
              <span className="admin-muted">Page {pagination.page} of {pagination.pages}</span>
            </div>
            <div className="admin-table-scroll">
              <div className="admin-table" style={{ minWidth: '720px' }}>
                  <div className="admin-table-head" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr 0.5fr 0.6fr 0.6fr 1.1fr', padding: '10px 14px' }}>
                    <div>Name</div>
                    <div>Email / Phone</div>
                    <div>Guests</div>
                    <div>Fee</div>
                    <div>Status</div>
                    <div>Date</div>
                    <div style={{ textAlign: 'right' }}>Actions</div>
                  </div>
                  <div className="admin-table-body">
                    {registrations.map((reg) => (
                      <div key={reg._id} className="admin-table-row" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr 0.5fr 0.6fr 0.6fr 1.1fr', padding: '10px 14px', alignItems: 'center' }}>
                        <div className="admin-table-cell">
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{reg.name}</div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b' }}>{new Date(reg.createdAt).toLocaleDateString('en-IN')}</div>
                        </div>
                        <div className="admin-table-cell" style={{ fontSize: '0.82rem' }}>
                          <div style={{ wordBreak: 'break-all' }}>{reg.email}</div>
                          <div style={{ color: '#64748b', fontSize: '0.76rem' }}>{reg.phone}</div>
                        </div>
                        <div className="admin-table-cell" style={{ fontSize: '0.82rem' }}>{reg.numberOfGuests}</div>
                          <div className="admin-table-cell" style={{ textAlign: 'center', fontSize: '0.78rem' }}>
                            {reg.event?.isPaidEvent ? <span className={`status-badge ${reg.paymentStatus === 'Paid' ? 'status-active' : reg.paymentStatus === 'Pending' ? 'status-draft' : 'status-inactive'}`}>{reg.paymentStatus || 'Unpaid'}</span> : <span style={{ color: '#15803d', fontWeight: 600 }}>FREE</span>}
                          </div>
                        <div className="admin-table-cell">{statusBadge(reg.status)}</div>
                        <div className="admin-table-cell" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{new Date(reg.createdAt).toLocaleDateString('en-IN')}</div>
                      <div className="admin-table-cell" style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {reg.status === 'Pending' && (
                          <>
                            <button className="btn-primary" onClick={() => handleStatus(reg._id, 'Confirmed')} disabled={updatingId === reg._id} style={{ padding: '6px 10px', fontSize: '0.76rem', opacity: updatingId === reg._id ? 0.6 : 1 }}>
                              {updatingId === reg._id ? '...' : 'Confirm'}
                            </button>
                            <button className="btn-danger" onClick={() => handleStatus(reg._id, 'Rejected')} disabled={updatingId === reg._id} style={{ padding: '6px 10px', fontSize: '0.76rem', opacity: updatingId === reg._id ? 0.6 : 1 }}>
                              Reject
                            </button>
                          </>
                        )}
                        {reg.status === 'Confirmed' && (
                          <button className="btn-secondary" onClick={() => handleStatus(reg._id, 'Rejected')} disabled={updatingId === reg._id} style={{ padding: '6px 10px', fontSize: '0.76rem' }}>
                            Reject
                          </button>
                        )}
                        {reg.status !== 'Pending' && reg.status !== 'Confirmed' && <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>No actions</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {pagination.pages > 1 && (
              <div className="pagination admin-pagination">
                <button className="btn-secondary pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Previous</button>
                <span className="pagination-info">Page <strong>{page}</strong> of <strong>{pagination.pages}</strong></span>
                <button className="btn-secondary pagination-btn" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>Next →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventRegistrations;
