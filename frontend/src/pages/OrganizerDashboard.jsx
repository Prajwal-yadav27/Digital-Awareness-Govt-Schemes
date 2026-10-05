import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonSchemesGrid, SkeletonStats } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ConfirmModal from '../components/ConfirmModal';
import EventForm from '../components/EventForm';
import OrganizerEventCard from '../components/OrganizerEventCard';
import OrganizerLayout from '../components/OrganizerLayout';
import * as eventService from '../services/eventService';
import * as paymentService from '../services/paymentService';

const OrganizerDashboard = () => {
  const [active, setActive] = useState('overview');
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0, pending: 0, approved: 0, rejected: 0, draft: 0,
    totalRegistrations: 0, confirmedRegistrations: 0, pendingRegistrations: 0,
    cancelledRegistrations: 0, totalGuests: 0, paidEvents: 0, freeEvents: 0,
    totalRevenue: 0
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [eventPerformance, setEventPerformance] = useState([]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addToast } = useToast();
  const { user } = useAuth();

  const fetchEvents = useCallback(async (targetPage) => {
    setLoading(true);
    setError(null);
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const params = { page: targetPage, limit: 9, search: search.trim(), category: categoryFilter, status: statusFilter };
      const [res, analyticsRes] = await Promise.all([
        eventService.getOrganizerEvents(params),
        eventService.getOrganizerAnalytics().catch(() => null)
      ]);
      setEvents(res.data || []);
      setPagination(res.pagination || { total: 0, pages: 1 });
      setEventPerformance(Array.isArray(analyticsRes?.data?.eventPerformance) ? analyticsRes.data.eventPerformance : []);
      if (analyticsRes) {
        const ov = analyticsRes.data?.overview || {};
        setStats({
          total: ov.totalEvents || 0,
          pending: ov.pendingEvents || 0,
          approved: ov.approvedEvents || 0,
          rejected: ov.rejectedEvents || 0,
          draft: ov.draftEvents || 0,
          totalRegistrations: ov.totalRegistrations || 0,
          confirmedRegistrations: ov.confirmedRegistrations || 0,
          pendingRegistrations: ov.pendingRegistrations || 0,
          cancelledRegistrations: ov.cancelledRegistrations || 0,
          totalGuests: ov.totalGuests || 0,
          paidEvents: ov.paidEvents || 0,
          freeEvents: ov.freeEvents || 0,
          totalRevenue: ov.totalRevenue || 0
        });
      } else {
        setAnalyticsError('Failed to load analytics');
      }
    } catch (err) {
      setError(err.message || 'Failed to load events');
      setAnalyticsError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
      setAnalyticsLoading(false);
    }
  }, [search, categoryFilter, statusFilter]);

  useEffect(() => { fetchEvents(page); }, [page, fetchEvents]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (page !== 1) setPage(1);
      else fetchEvents(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search, categoryFilter, statusFilter]);

  const handleCreate = async (payload, response) => {
    setIsSubmitting(true);
    try {
      addToast(response?.message || 'Event submitted for admin approval.', 'success');
      setIsCreateOpen(false);
      fetchEvents(1);
      setPage(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = async (event) => {
    try {
      const res = await eventService.getEventById(event._id);
      setEditingEvent(res.data);
      setIsEditOpen(true);
    } catch (err) {
      addToast(err.message || 'Failed to load event', 'error');
    }
  };

  const handleUpdate = async (payload, response) => {
    setIsSubmitting(true);
    try {
      addToast(response?.message || 'Event updated. Approved events require re-approval.', 'success');
      setIsEditOpen(false);
      setEditingEvent(null);
      fetchEvents(page);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (event) => {
    setDeletingEvent(event);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await eventService.deleteEvent(deletingEvent._id);
      addToast('Event deleted successfully', 'success');
      setIsDeleteOpen(false);
      setDeletingEvent(null);
      fetchEvents(page);
    } catch (err) {
      addToast(err.message || 'Failed to delete', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasFilters = search || categoryFilter || statusFilter;

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const upcomingEvents = events
    .filter((ev) => {
      if (ev.status !== 'Approved' || !ev.eventDate) return false;
      const d = new Date(ev.eventDate);
      return !isNaN(d.getTime()) && d.getTime() >= Date.now();
    })
    .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))
    .slice(0, 4);

  const handleSidebarNavigate = (section) => {
    if (section === 'events') setActive('events');
    else setActive('overview');
  };

  return (
    <OrganizerLayout
      active={active === 'events' ? 'events' : 'dashboard'}
      onNavigate={handleSidebarNavigate}
      onCreateEvent={() => setIsCreateOpen(true)}
      title={active === 'events' ? 'My Events' : 'Organizer Dashboard'}
      subtitle={active === 'events'
        ? 'Search, edit and manage your events and their registrations.'
        : `Manage your events and registrations — Welcome, ${user?.name?.split(' ')[0] || 'Organizer'}!`}
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={() => fetchEvents(page)} disabled={loading}>↻ Refresh</button>
          <button type="button" className="btn-primary" onClick={() => setIsCreateOpen(true)}>+ Create Event</button>
        </>
      }
    >

        {active === 'overview' && (
          <>
            <div className="admin-overview-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '20px' }}>
              <div className="admin-stat-card">
                <div className="admin-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>📋</div>
                <div>
                  <div className="admin-stat-value">{stats.total}</div>
                  <div className="admin-stat-label">Total Events</div>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon" style={{ background: '#fefce8', color: '#a16207' }}>⏳</div>
                <div>
                  <div className="admin-stat-value">{stats.pending}</div>
                  <div className="admin-stat-label">Pending</div>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon" style={{ background: '#f0fdf4', color: '#15803d' }}>✓</div>
                <div>
                  <div className="admin-stat-value">{stats.approved}</div>
                  <div className="admin-stat-label">Approved</div>
                </div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon" style={{ background: '#fef2f2', color: '#b91c1c' }}>✕</div>
                <div>
                  <div className="admin-stat-value">{stats.rejected}</div>
                  <div className="admin-stat-label">Rejected</div>
                </div>
              </div>
              <div className="admin-stat-card" onClick={() => setActive('events')} style={{ cursor: 'pointer' }}>
                <div className="admin-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>📨</div>
                <div>
                  <div className="admin-stat-value">{stats.totalRegistrations}</div>
                  <div className="admin-stat-label">Total Registrations</div>
                  <div className="admin-stat-sub">{stats.confirmedRegistrations} confirmed · {stats.pendingRegistrations} pending · {stats.cancelledRegistrations} cancelled</div>
                </div>
              </div>
              <div className="admin-stat-card" onClick={() => setActive('events')} style={{ cursor: 'pointer' }}>
                <div className="admin-stat-icon" style={{ background: '#fdf4ff', color: '#a21caf' }}>👥</div>
                <div>
                  <div className="admin-stat-value">{stats.totalGuests}</div>
                  <div className="admin-stat-label">Total Guests</div>
                </div>
              </div>
            </div>

            {/* Revenue + Registration Status */}
            <div className="admin-analytics-grid" style={{ marginBottom: '20px' }}>
              <section className="analytics-card">
                <div className="analytics-card-header">
                  <h3 id="analytics-revenue-title" className="analytics-card-title">Revenue</h3>
                  <p className="analytics-card-subtitle">From verified paid registrations only (Payment.status = Paid)</p>
                </div>
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: stats.totalRevenue > 0 ? '#15803d' : '#0f172a' }}>
                    ₹{stats.totalRevenue.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>{stats.paidEvents} paid event{stats.paidEvents !== 1 ? 's' : ''} · {stats.freeEvents} free event{stats.freeEvents !== 1 ? 's' : ''}</div>
                </div>
              </section>

              <section className="analytics-card">
                <div className="analytics-card-header">
                  <h3 id="analytics-regstatus-title" className="analytics-card-title">Registration Status</h3>
                  <p className="analytics-card-subtitle">All statuses across your events</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Confirmed', value: stats.confirmedRegistrations, color: '#15803d' },
                    { label: 'Pending', value: stats.pendingRegistrations, color: '#92400e' },
                    { label: 'Cancelled', value: stats.cancelledRegistrations, color: '#b91c1c' }
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#334155' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, display: 'inline-block', marginRight: '8px', flexShrink: 0 }} aria-hidden="true"></span> {s.label}
                      </span>
                      <span style={{ fontWeight: 700, color: s.color, fontSize: '0.88rem' }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="admin-panel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">Quick Actions</div>
              </div>
              <div style={{ padding: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => setIsCreateOpen(true)}>+ Create Event</button>
                <button className="btn-secondary" onClick={() => setActive('events')}>View My Events</button>
                <Link to="/events" className="btn-secondary">Browse Approved Events</Link>
              </div>
            </div>

            <div className="org-section-card">
              <div className="org-section-head">
                <div>
                  <h2 className="org-section-title">Upcoming Events</h2>
                  <p className="org-section-sub">Approved events happening soon — nearest first.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setActive('events')}>Manage →</button>
              </div>
              {loading ? (
                <div style={{ padding: '16px' }}><SkeletonStats /></div>
              ) : upcomingEvents.length === 0 ? (
                <div style={{ padding: '18px', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  No upcoming approved events. New approvals will appear here automatically.
                </div>
              ) : (
                <div className="org-upcoming-list">
                  {upcomingEvents.map((ev) => {
                    const d = new Date(ev.eventDate);
                    return (
                      <Link key={ev._id} to={`/events/${ev._id}`} className="org-upcoming-row" aria-label={`View ${ev.title}`}>
                        <span className="org-upcoming-date" aria-hidden="true">
                          <span className="org-upcoming-day">{d.toLocaleDateString('en-IN', { day: '2-digit' })}</span>
                          <span className="org-upcoming-mon">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                        </span>
                        <span className="org-upcoming-main">
                          <span className="org-upcoming-title" style={{ display: 'block' }}>{ev.title}</span>
                          <span className="org-upcoming-meta">
                            {d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                            {ev.location ? ` · ${ev.location}` : ''} · {ev.registrationCount || 0} registered
                          </span>
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }} aria-hidden="true">→</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="admin-panel">
              <div className="admin-panel-header">
                <div className="admin-panel-title">Recent Events</div>
                <button className="btn-secondary" onClick={() => setActive('events')}>Manage →</button>
              </div>
              {loading ? <div style={{ padding: '16px' }}><SkeletonStats /></div> : events.length === 0 ? (
                <div style={{ padding: '12px' }}><EmptyState icon="📅" title="You haven't created any events yet." description="Create your first event to get started." action={<button className="btn-primary" onClick={() => setIsCreateOpen(true)}>+ Create Event</button>} /></div>
              ) : (
                <div className="schemes-grid" style={{ padding: '16px', gap: '16px' }}>
                  {events.slice(0, 3).map(ev => (
                    <OrganizerEventCard key={ev._id} event={ev} onEdit={handleEditClick} onDelete={handleDeleteClick} onViewRegistrations={(e) => window.location.href = `/organizer/events/${e._id}/registrations`} />
                  ))}
                </div>
              )}
            </div>

            <div className="org-section-card">
              <div className="org-section-head">
                <div>
                  <h2 className="org-section-title">Event Performance</h2>
                  <p className="org-section-sub">Registrations and capacity per event — live from your analytics.</p>
                </div>
                <button type="button" className="btn-secondary" onClick={() => setActive('events')}>Manage →</button>
              </div>
              {analyticsLoading ? (
                <div style={{ padding: '16px' }}><SkeletonStats /></div>
              ) : analyticsError || eventPerformance.length === 0 ? (
                <div style={{ padding: '18px', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                  {analyticsError || 'No event performance data yet. It appears here once your events receive registrations.'}
                </div>
              ) : (
                <div className="admin-table-scroll">
                  <div className="admin-table" style={{ minWidth: '640px' }}>
                    <div className="admin-table-head" style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.6fr 0.7fr 0.7fr 0.7fr', padding: '10px 14px' }}>
                      <div>Event</div>
                      <div>Status</div>
                      <div>Registrations</div>
                      <div>Capacity</div>
                      <div>Fee</div>
                    </div>
                    <div className="admin-table-body">
                      {eventPerformance.slice(0, 8).map((ev) => (
                        <div key={ev._id} className="admin-table-row" style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.6fr 0.7fr 0.7fr 0.7fr', padding: '10px 14px', alignItems: 'center' }}>
                          <div className="admin-table-cell" style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.title}>
                            <Link to={`/events/${ev._id}`} className="link-inline">{ev.title}</Link>
                          </div>
                          <div className="admin-table-cell">
                            <span className={`pro-status pro-status--${ev.status === 'Approved' ? 'approved' : ev.status === 'Pending' ? 'pending' : ev.status === 'Rejected' ? 'rejected' : 'draft'}`}>
                              <span className="pro-status-icon" aria-hidden="true">{ev.status === 'Approved' ? '✓' : ev.status === 'Pending' ? '⏳' : ev.status === 'Rejected' ? '⛔' : '📝'}</span>
                              <span>{ev.status}</span>
                            </span>
                          </div>
                          <div className="admin-table-cell" style={{ fontWeight: 700 }}>{ev.registrations ?? 0}</div>
                          <div className="admin-table-cell">{ev.capacity || '∞'}</div>
                          <div className="admin-table-cell">{ev.isPaidEvent && ev.registrationFee > 0 ? `₹${ev.registrationFee}` : 'Free'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {active === 'events' && (
          <>
            <div className="admin-filters-bar">
              <div className="admin-filter-row">
                <input className="form-input admin-filter-search" type="search" placeholder="Search my events..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search my events" />
                <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All Categories</option>
                  <option value="Agriculture">Agriculture</option>
                  <option value="Education">Education</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Housing">Housing</option>
                  <option value="Employment">Employment</option>
                  <option value="Finance / Loans">Finance / Loans</option>
                  <option value="Startup">Startup</option>
                  <option value="Women & Child">Women & Child</option>
                  <option value="Social Welfare">Social Welfare</option>
                </select>
                <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Draft">Draft</option>
                </select>
                {hasFilters && <button type="button" className="btn-secondary" onClick={clearFilters}>Clear</button>}
              </div>
            </div>

            {loading && <SkeletonSchemesGrid count={6} />}
            {error && !loading && <ErrorState message={error} onRetry={() => fetchEvents(page)} />}
            {!loading && !error && events.length === 0 && (
              <EmptyState icon="📅" title={hasFilters ? 'No matching events' : "You haven't created any events yet."} description={hasFilters ? 'Try adjusting filters.' : 'Create your first event to get started.'} action={<button className="btn-primary" onClick={() => setIsCreateOpen(true)}>+ Create Event</button>} />
            )}
            {!loading && !error && events.length > 0 && (
              <>
                <div className="schemes-grid">
                  {events.map(ev => (
                    <OrganizerEventCard key={ev._id} event={ev} onEdit={handleEditClick} onDelete={handleDeleteClick} onViewRegistrations={(e) => window.location.href = `/organizer/events/${e._id}/registrations`} />
                  ))}
                </div>
                {pagination.pages > 1 && (
                  <div className="pagination" role="navigation" aria-label="Organizer events pagination">
                    <button className="btn-secondary pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Previous</button>
                    <span className="pagination-info">Page <strong>{page}</strong> of <strong>{pagination.pages}</strong></span>
                    <button className="btn-secondary pagination-btn" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>Next →</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <EventForm isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSubmit={handleCreate} mode="create" loading={isSubmitting} />
        <EventForm isOpen={isEditOpen} onClose={() => { setIsEditOpen(false); setEditingEvent(null); }} onSubmit={handleUpdate} mode="edit" initialData={editingEvent} loading={isSubmitting} />
        <ConfirmModal isOpen={isDeleteOpen} onClose={() => { setIsDeleteOpen(false); setDeletingEvent(null); }} onConfirm={handleConfirmDelete} title="Delete Event" message={`Are you sure you want to delete "${deletingEvent?.title}"? This action cannot be undone.`} confirmText="Delete Event" loading={isDeleting} danger={true} />
    </OrganizerLayout>
  );
};

export default OrganizerDashboard;
