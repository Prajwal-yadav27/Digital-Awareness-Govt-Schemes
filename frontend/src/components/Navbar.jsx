import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as notificationService from '../services/notificationService';
import ThemeToggle from './ThemeToggle';

const navLinkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

const Navbar = () => {
  const { user, isAdmin, isOrganizer, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const moreRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    if (user) {
      notificationService.getUnreadCount().then(res => {
        setNotifCount(res.data?.unreadCount || 0);
      }).catch(() => {});
    } else {
      setNotifCount(0);
    }
  }, [user]);

  // Close dropdowns on outside click / Escape
  useEffect(() => {
    const onPointerDown = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setIsMoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setIsProfileOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMoreOpen(false);
        setIsProfileOpen(false);
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const closeAll = () => {
    setIsMenuOpen(false);
    setIsMoreOpen(false);
    setIsProfileOpen(false);
  };

  const handleLogout = () => {
    logout();
    closeAll();
    addToast('Logged out successfully', 'success');
    navigate('/login');
  };

  const showOrganizerLinks = isOrganizer() || isAdmin();
  const isUserRole = isAuthenticated() && user?.role === 'user';

  const moreItems = user ? (
    <>
      <NavLink to="/bookmarks" className={navLinkClass} role="menuitem" onClick={closeAll}>Bookmarks</NavLink>
      {isUserRole && <NavLink to="/my-registrations" className={navLinkClass} role="menuitem" onClick={closeAll}>My Registrations</NavLink>}
      <NavLink to="/notifications" className={navLinkClass} role="menuitem" onClick={closeAll}>Notifications</NavLink>
      {isOrganizer() && <NavLink to="/organizer" className={navLinkClass} role="menuitem" onClick={closeAll}>Organizer Dashboard</NavLink>}
      {showOrganizerLinks && <NavLink to="/organizer/ticket-verification" className={navLinkClass} role="menuitem" onClick={closeAll}>Ticket Verification</NavLink>}
    </>
  ) : null;

  return (
    <nav className="navbar glass-strong" aria-label="Main navigation" role="navigation">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" aria-label="GovSchemes Portal home" onClick={closeAll}>
          <span className="navbar-logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </span>
          <span className="navbar-title">GovSchemes</span>
        </Link>

        <button
          type="button"
          className="navbar-menu-toggle press-down"
          aria-controls="primary-nav"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setIsMenuOpen(open => !open)}
        >
          <span className="sr-only">Toggle navigation menu</span>
          <span aria-hidden="true" className="nav-toggle-icon">
            {isMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </span>
        </button>

        <div className={`navbar-links ${isMenuOpen ? 'is-open' : ''}`} id="primary-nav" role="navigation">
          <NavLink to="/" end className={navLinkClass} onClick={closeAll}>Home</NavLink>
          <NavLink to="/schemes" className={navLinkClass} onClick={closeAll}>Schemes</NavLink>
          <NavLink to="/events" className={navLinkClass} onClick={closeAll}>Events</NavLink>
          <NavLink to="/about" className={navLinkClass} onClick={closeAll}>About</NavLink>
          {user && (
            <div className="nav-dropdown" ref={moreRef}>
              <button
                type="button"
                className={`nav-link nav-dropdown-toggle${isMoreOpen ? ' active' : ''}`}
                aria-haspopup="menu"
                aria-expanded={isMoreOpen}
                onClick={() => { setIsMoreOpen(open => !open); setIsProfileOpen(false); }}
              >
                More
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: isMoreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {isMoreOpen && (
                <div className="nav-dropdown-menu" role="menu">
                  {moreItems}
                </div>
              )}
            </div>
          )}

          <div className="nav-spacer" />
          <ThemeToggle />
          {isAdmin() && (
            <NavLink to="/admin" className="nav-admin-btn" onClick={closeAll}>Admin Dashboard</NavLink>
          )}
          {!user ? (
            <>
              <NavLink to="/login" className={navLinkClass} onClick={closeAll}>Login</NavLink>
              <NavLink to="/register" className="nav-link nav-btn-primary" onClick={closeAll}>Register</NavLink>
              <NavLink to="/admin/login" className="nav-link nav-admin-login-link" onClick={closeAll} title="Admin Login — use admin credentials">Admin Login</NavLink>
            </>
          ) : (
            <div className="navbar-actions">
              <Link to="/notifications" className="nav-bell" aria-label={notifCount > 0 ? `Notifications, ${notifCount} unread` : 'Notifications'} onClick={closeAll}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {notifCount > 0 && (
                  <span className="nav-badge" aria-hidden="true">{notifCount > 99 ? '99+' : notifCount}</span>
                )}
              </Link>
              <div className="nav-dropdown" ref={profileRef}>
                <button
                  type="button"
                  className="nav-profile-btn"
                  aria-haspopup="menu"
                  aria-expanded={isProfileOpen}
                  aria-label={`Account menu for ${user.name}`}
                  onClick={() => { setIsProfileOpen(open => !open); setIsMoreOpen(false); }}
                >
                  <span className="user-avatar user-avatar-sm" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</span>
                  <span className="user-name nav-profile-name">{user.name.split(' ')[0]}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: isProfileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isProfileOpen && (
                  <div className="nav-dropdown-menu nav-profile-menu" role="menu">
                    <div className="nav-profile-meta" aria-hidden="true">
                      <span className="user-name">{user.name}</span>
                      <span className="user-role">{user.role.toUpperCase()}</span>
                    </div>
                    <NavLink to="/profile" className={navLinkClass} role="menuitem" onClick={closeAll}>Profile</NavLink>
                    {isUserRole && <NavLink to="/my-registrations" className={navLinkClass} role="menuitem" onClick={closeAll}>My Registrations</NavLink>}
                    <NavLink to="/bookmarks" className={navLinkClass} role="menuitem" onClick={closeAll}>Bookmarks</NavLink>
                    <NavLink to="/notifications" className={navLinkClass} role="menuitem" onClick={closeAll}>Notifications</NavLink>
                    <button type="button" className="nav-btn-logout nav-dropdown-logout" role="menuitem" onClick={handleLogout}>Logout</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
