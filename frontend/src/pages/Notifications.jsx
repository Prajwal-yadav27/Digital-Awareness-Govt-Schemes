import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as notificationService from '../services/notificationService';
import { SkeletonStats } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';

const formatTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const typeIcon = (type) => {
  const map = {
    EVENT_APPROVED: { icon: '✅', color: '#15803d', bg: '#f0fdf4' },
    EVENT_REJECTED: { icon: '❌', color: '#b91c1c', bg: '#fef2f2' },
    REGISTRATION_SUCCESS: { icon: '📝', color: '#2563eb', bg: '#eff6ff' },
    REGISTRATION_CONFIRMED: { icon: '✅', color: '#15803d', bg: '#f0fdf4' },
    REGISTRATION_CANCELLED: { icon: '🗑', color: '#b91c1c', bg: '#fef2f2' },
    REGISTRATION_REJECTED: { icon: '❌', color: '#b91c1c', bg: '#fef2f2' },
    PAYMENT_SUCCESS: { icon: '💰', color: '#15803d', bg: '#f0fdf4' },
    PAYMENT_FAILED: { icon: '⚠️', color: '#b91c1c', bg: '#fef2f2' },
    TICKET_GENERATED: { icon: '🎟️', color: '#2563eb', bg: '#eff6ff' },
    SCHEME_EXPIRED: { icon: '⏳', color: '#b91c1c', bg: '#fef2f2' },
    EVENT_UPDATED: { icon: '📝', color: '#92400e', bg: '#fffbeb' },
    EVENT_PENDING: { icon: '🕒', color: '#92400e', bg: '#fffbeb' },
    CHECK_IN_SUCCESS: { icon: '📍', color: '#15803d', bg: '#f0fdf4' }
  };
  return map[type] || { icon: '🔔', color: '#475569', bg: '#f8fafc' };
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const { user } = useAuth();

  const fetchNotifications = useCallback(async (targetPage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationService.getMyNotifications({ page: targetPage, limit: 20 });
      setNotifications(res.data || []);
      setPagination(res.pagination || { total: 0, pages: 1 });
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(page); }, [page, fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (_) {}
  };

  return (
    <div className="page-wrapper">
      <div className="page-container" style={{ maxWidth: '720px' }}>
        <header className="page-header" style={{ marginBottom: '16px' }}>
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {unreadCount > 0 && <button className="btn-secondary" onClick={handleMarkAllRead}>Mark All Read</button>}
            <Link to="/" className="btn-secondary">Home</Link>
          </div>
        </header>

        {loading && <SkeletonStats />}

        {error && !loading && <ErrorState message={error} onRetry={() => fetchNotifications(page)} />}

        {!loading && !error && notifications.length === 0 && (
          <EmptyState icon="🔔" title="No notifications" description="You're all caught up! Notifications about your events and registrations will appear here." />
        )}

        {!loading && !error && notifications.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notifications.map(n => {
              const meta = typeIcon(n.type);
              const isUnread = !n.isRead;
              return (
                <div key={n._id} style={{
                  background: isUnread ? '#ffffff' : '#f8fafc',
                  border: `1px solid ${isUnread ? '#e2e8f0' : '#f1f5f9'}`,
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onClick={() => { if (!n.isRead) handleMarkRead(n._id); }}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') { if (!n.isRead) handleMarkRead(n._id); } }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0, background: meta.bg }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: isUnread ? 700 : 500, color: isUnread ? '#0f172a' : '#475569' }}>{n.title}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px', lineHeight: 1.45 }}>{n.message}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>{formatTime(n.createdAt)}</div>
                    {n.relatedEvent && (
                      <Link
                        to={`/events/${n.relatedEvent}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.78rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
                      >
                        Review Event →
                      </Link>
                    )}
                    {n.relatedScheme && (
                      <Link
                        to={`/schemes/${n.relatedScheme}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.78rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
                      >
                        View Scheme →
                      </Link>
                    )}
                  </div>
                  {isUnread && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', flexShrink: 0, marginTop: '6px' }} />}
                </div>
              );
            })}
            {pagination.pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', paddingTop: '10px' }}>
                <button className="btn-secondary" onClick={() => setPage(p => p - 1)} disabled={page === 1} style={{ padding: '6px 12px', fontSize: '0.82rem' }}>← Prev</button>
                <span style={{ alignSelf: 'center', fontSize: '0.82rem', color: '#64748b' }}>Page {page} of {pagination.pages}</span>
                <button className="btn-secondary" onClick={() => setPage(p => p + 1)} disabled={page === pagination.pages} style={{ padding: '6px 12px', fontSize: '0.82rem' }}>Next →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
