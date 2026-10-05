import { Link } from 'react-router-dom';

const AdminSidebar = ({ active, onChange, pendingEvents = 0, eventsActive = false, onEventsClick, onSchemesClick, collapsed = false, onToggleCollapse }) => {
  return (
    <div className="admin-sidebar-inner">
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-logo" aria-hidden="true">🛡️</div>
        <div className="admin-sidebar-title">
          <div className="admin-sidebar-name">Admin Panel</div>
          <div className="admin-sidebar-sub">Government Schemes</div>
        </div>
      </div>

      <nav className="admin-nav" aria-label="Admin sections">
        <button
          type="button"
          className={`admin-nav-item ${active === 'overview' ? 'active' : ''}`}
          onClick={() => onChange('overview')}
          aria-current={active === 'overview' ? 'page' : undefined}
          title="Overview"
        >
          <span className="admin-nav-icon" aria-hidden="true">📊</span>
          <span className="admin-nav-label">Overview</span>
        </button>
        <button
          type="button"
          className={`admin-nav-item ${active === 'schemes' && !eventsActive ? 'active' : ''}`}
          onClick={onSchemesClick || (() => onChange('schemes'))}
          aria-current={active === 'schemes' && !eventsActive ? 'page' : undefined}
          title="Schemes"
        >
          <span className="admin-nav-icon" aria-hidden="true">📋</span>
          <span className="admin-nav-label">Schemes</span>
        </button>
        <button
          type="button"
          className={`admin-nav-item ${eventsActive ? 'active' : ''}`}
          onClick={onEventsClick}
          aria-current={eventsActive ? 'page' : undefined}
          title="Events"
        >
          <span className="admin-nav-icon" aria-hidden="true">🎫</span>
          <span className="admin-nav-label">Events</span>
          {pendingEvents > 0 && <span className="admin-nav-badge" aria-label={`${pendingEvents} pending events`}>{pendingEvents}</span>}
        </button>
        <button
          type="button"
          className={`admin-nav-item ${active === 'users' ? 'active' : ''}`}
          onClick={() => onChange('users')}
          aria-current={active === 'users' ? 'page' : undefined}
          title="Users"
        >
          <span className="admin-nav-icon" aria-hidden="true">👥</span>
          <span className="admin-nav-label">Users</span>
        </button>
      </nav>

      <div className="admin-sidebar-footer">
        <button
          type="button"
          className="admin-collapse-btn"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span aria-hidden="true">{collapsed ? '→' : '←'}</span>
          <span className="admin-nav-label">{collapsed ? 'Expand' : 'Collapse'}</span>
        </button>
        <Link to="/" className="admin-site-link" title="Back to public site">
          <span aria-hidden="true">🌐</span>
          <span>View public site</span>
        </Link>
      </div>
    </div>
  );
};

export default AdminSidebar;
