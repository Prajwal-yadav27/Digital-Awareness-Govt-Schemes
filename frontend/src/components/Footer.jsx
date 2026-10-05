import { Link } from 'react-router-dom';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-label="Site footer">
      <div className="pro-footer-grid">
        <div>
          <div className="pro-footer-brand">
            <span className="pro-footer-logo" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </span>
            <span>GovSchemes</span>
          </div>
          <p className="pro-footer-desc">
            Digital Awareness Platform and Accessibility for Govt Schemes — discover
            government schemes and public events in one organised place.
          </p>
        </div>
        <nav className="pro-footer-col" aria-label="Explore">
          <h4>Explore</h4>
          <Link to="/schemes">Government Schemes</Link>
          <Link to="/events">Government/Public Events</Link>
          <Link to="/about">About</Link>
        </nav>
        <nav className="pro-footer-col" aria-label="Account">
          <h4>Account</h4>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
          <Link to="/bookmarks">My Bookmarks</Link>
          <Link to="/notifications">Notifications</Link>
        </nav>
        <nav className="pro-footer-col" aria-label="Administration">
          <h4>Administration</h4>
          <Link to="/admin/login">Admin Login</Link>
          <Link to="/profile">Profile</Link>
        </nav>
      </div>
      <div className="pro-footer-bottom">
        <span>&copy; {currentYear} GovSchemes Portal. All rights reserved.</span>
        <span>Government Schemes Awareness + Public Events Platform</span>
      </div>
    </footer>
  );
};

export default Footer;
