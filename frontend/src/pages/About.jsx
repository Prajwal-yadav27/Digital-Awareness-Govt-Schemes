import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FeatureIcon = ({ type }) => {
  const icons = {
    search: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    filter: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    bookmark: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
    file: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    lock: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    shield: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  };
  return <span style={{ color: 'var(--blue-400)' }}>{icons[type]}</span>;
};

const About = () => {
  const { isAuthenticated, user, isAdmin } = useAuth();

  const features = [
    { icon: 'search', title: 'Smart Search', desc: 'Find relevant schemes using full-text search across titles, descriptions, and categories.' },
    { icon: 'filter', title: 'Category Filters', desc: 'Browse schemes by category: education, housing, healthcare, agriculture, and more.' },
    { icon: 'bookmark', title: 'Bookmark Schemes', desc: 'Save schemes to your personal bookmarks list for quick access anytime.' },
    { icon: 'file', title: 'Detailed Views', desc: 'Each scheme has a dedicated page with eligibility, benefits, and full information.' },
    { icon: 'lock', title: 'Secure Access', desc: 'JWT-based authentication with bcrypt-hashed passwords and role-based access control.' },
    { icon: 'shield', title: 'Admin Panel', desc: 'Admins can create, update, and delete schemes through a dedicated dashboard.' }
  ];

  const techStack = [
    { name: 'MongoDB Atlas', desc: 'Cloud NoSQL database for production-grade scalability' },
    { name: 'Express.js', desc: 'Fast, minimal Node.js web framework for REST APIs' },
    { name: 'React 18', desc: 'Component-based UI with hooks, context, and React Router' },
    { name: 'Node.js', desc: 'JavaScript runtime for high-performance backend services' },
    { name: 'JWT Auth', desc: 'Stateless token-based authentication with 30-day sessions' },
    { name: 'Pure CSS', desc: 'Hand-crafted responsive styles with no UI frameworks' }
  ];

  return (
    <div className="page-wrapper page-about">
      <div className="page-container">
        <section className="about-hero fade-in">
          <div className="about-hero-content">
            <span className="pill-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              Government Schemes Portal
            </span>
            <h1 className="about-title">
              Bridging Citizens & Welfare Schemes
            </h1>
            <p className="about-subtitle">
              Discover and bookmark government welfare schemes in one place.
            </p>
            <div className="about-hero-cta">
              <Link to="/" className="btn-primary btn-large">
                Browse Schemes
              </Link>
              {!isAuthenticated() && (
                <Link to="/register" className="btn-secondary btn-large">
                  Create Account
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="about-section">
          <div className="section-header">
            <h2 className="section-heading">Key Features</h2>
            <p className="section-desc">
              Everything you need from a modern web application - polished UI, secure backend,
              and a delightful user experience.
            </p>
          </div>
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card fade-in" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="feature-icon"><FeatureIcon type={f.icon} /></div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="about-section about-dark">
          <div className="section-header">
            <h2 className="section-heading">Tech Stack</h2>
            <p className="section-desc">
              Industry-standard technologies chosen for maintainability and performance.
            </p>
          </div>
          <div className="tech-grid">
            {techStack.map((t, i) => (
              <div key={i} className="tech-card fade-in" style={{ animationDelay: `${i * 0.07}s` }}>
                <h4 className="tech-name">{t.name}</h4>
                <p className="tech-desc">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="about-section">
          <div className="section-header">
            <h2 className="section-heading">User Types</h2>
            <p className="section-desc">
              Role-based access control for a secure, segmented experience.
            </p>
          </div>
          <div className="roles-grid">
            <div className="role-card role-user fade-in">
              <div className="role-badge">Citizen / User</div>
              <ul className="role-list">
                <li>Register & login securely</li>
                <li>Browse & search all schemes</li>
                <li>View complete scheme details</li>
                <li>Bookmark favorite schemes</li>
                <li>Filter by category & pagination</li>
              </ul>
            </div>
            <div className="role-card role-admin fade-in">
              <div className="role-badge admin">Administrator</div>
              <ul className="role-list">
                <li>Everything a User can do</li>
                <li>Access Admin Dashboard</li>
                <li>Create new government schemes</li>
                <li>Edit existing scheme details</li>
                <li>Delete obsolete schemes</li>
                <li>View stats & overview panel</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="about-cta fade-in">
          <div>
            <h2 className="about-cta-title">Ready to explore?</h2>
            <p className="about-cta-subtitle">
              {isAuthenticated()
                ? `Welcome back, ${user?.name?.split(' ')[0] || 'User'}! Head to the home page to see all available schemes.`
                : 'Start by creating a free account - it takes less than 30 seconds.'}
            </p>
          </div>
          <div className="about-cta-buttons">
            {isAdmin() && (
              <Link to="/admin" className="btn-primary btn-large">
                Admin Panel
              </Link>
            )}
            <Link to="/" className="btn-secondary btn-large">
              View Schemes
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
