import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * Organizer portal shell: sidebar navigation + compact top header.
 * All destinations are existing routes; logout reuses AuthContext.
 */
const OrganizerLayout = ({
  active = 'dashboard',
  onNavigate,
  onCreateEvent,
  title = 'Organizer Dashboard',
  subtitle,
  actions,
  children
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const go = (section) => {
    if (onNavigate) onNavigate(section);
  };

  const handleLogout = () => {
    logout();
    addToast('Logged out successfully', 'success');
    navigate('/login');
  };

  const itemClass = (key) => `org-nav-item${active === key ? ' active' : ''}`;

  return (
    <div className="org-shell">
      <aside className="org-sidebar" aria-label="Organizer navigation">
        <div className="org-sidebar-inner">
          <div className="org-brand">
            <span className="org-brand-mark" aria-hidden="true">🏢</span>
            <span>
              <span className="org-brand-name" style={{ display: 'block' }}>Organizer</span>
              <span className="org-brand-sub" style={{ display: 'block' }}>GovSchemes</span>
            </span>
          </div>

          <nav className="org-nav" aria-label="Organizer sections">
            <span className="org-nav-section">Manage</span>
            <button type="button" className={itemClass('dashboard')} onClick={() => go('dashboard')} aria-current={active === 'dashboard' ? 'page' : undefined}>
              <span className="org-nav-icon" aria-hidden="true">📊</span>
              <span className="org-nav-text">Dashboard</span>
            </button>
            <button type="button" className={itemClass('events')} onClick={() => go('events')} aria-current={active === 'events' ? 'page' : undefined}>
              <span className="org-nav-icon" aria-hidden="true">🎫</span>
              <span className="org-nav-text">My Events</span>
            </button>
            <button type="button" className="org-nav-item" onClick={onCreateEvent}>
              <span className="org-nav-icon" aria-hidden="true">➕</span>
              <span className="org-nav-text">Create Event</span>
            </button>
            <Link to="/organizer/ticket-verification" className="org-nav-item">
              <span className="org-nav-icon" aria-hidden="true">✅</span>
              <span className="org-nav-text">Ticket Verification</span>
            </Link>
            <span className="org-nav-section">Account</span>
            <Link to="/notifications" className="org-nav-item">
              <span className="org-nav-icon" aria-hidden="true">🔔</span>
              <span className="org-nav-text">Notifications</span>
            </Link>
            <Link to="/profile" className="org-nav-item">
              <span className="org-nav-icon" aria-hidden="true">👤</span>
              <span className="org-nav-text">Profile</span>
            </Link>
            <Link to="/events" className="org-nav-item">
              <span className="org-nav-icon" aria-hidden="true">🌐</span>
              <span className="org-nav-text">Public Events</span>
            </Link>
          </nav>

          <div className="org-sidebar-footer">
            <button type="button" className="org-nav-item" onClick={handleLogout} style={{ color: '#b91c1c' }}>
              <span className="org-nav-icon" aria-hidden="true">↩</span>
              <span className="org-nav-text">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="org-main">
        <div className="org-topbar">
          <div className="org-topbar-inner">
            <div>
              <h1 className="org-topbar-title">
                {title}
                {user?.isOrganizerVerified && (
                  <span className="org-verified-pill">
                    <span aria-hidden="true">✓</span> Verified Organizer
                  </span>
                )}
              </h1>
              <div className="org-topbar-sub">
                {subtitle || `Welcome, ${user?.name?.split(' ')[0] || 'Organizer'}`}
              </div>
            </div>
            <div className="org-topbar-actions">
              {actions}
            </div>
          </div>
        </div>
        <div className="org-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default OrganizerLayout;
