import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CapabilityIcon = ({ type }) => {
  const icons = {
    search: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    calendar: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    bookmark: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
    ticket: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>,
    bell: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
    user: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  };
  return <span className="about-cap-icon" aria-hidden="true">{icons[type] || icons.search}</span>;
};

const About = () => {
  const { isAuthenticated, user, isAdmin } = useAuth();

  const capabilities = [
    { icon: 'search', title: 'Discover schemes', desc: 'Search and filter government welfare schemes by category, department, and eligibility.' },
    { icon: 'calendar', title: 'Explore public events', desc: 'Find approved awareness programmes, workshops, and welfare camps with dates and venues.' },
    { icon: 'bookmark', title: 'Bookmark schemes', desc: 'Save schemes you care about and return to them any time from your account.' },
    { icon: 'ticket', title: 'Register and get tickets', desc: 'Register for supported events, track status, and access tickets with QR verification.' },
    { icon: 'bell', title: 'Stay updated', desc: 'Receive notifications about deadlines, approvals, registrations, and event changes.' },
    { icon: 'user', title: 'Manage your account', desc: 'Update contact details, verify your phone, and control notification preferences.' },
  ];

  return (
    <div className="page-wrapper page-about">
      <div className="page-container">
        {/* Introduction */}
        <section className="about-intro" aria-labelledby="about-title">
          <p className="pro-section-eyebrow">About the platform</p>
          <h1 id="about-title" className="about-display">
            One portal for government schemes and public events
          </h1>
          <p className="about-lede">
            The Digital Awareness Platform brings government welfare schemes and public events
            together in a single, accessible experience — so citizens can discover support they
            are eligible for, register for programmes near them, and stay informed without
            hunting across portals.
          </p>
          <div className="about-cta-row">
            <Link to="/schemes" className="btn-primary btn-large">Explore Schemes</Link>
            <Link to="/events" className="btn-secondary btn-large">Discover Events</Link>
          </div>
        </section>

        {/* Purpose */}
        <section className="about-purpose" aria-labelledby="about-purpose-title">
          <div className="about-purpose-text">
            <h2 id="about-purpose-title" className="about-h2">Our purpose</h2>
            <p>
              Government support only helps when people know about it. This platform organises
              scheme information — benefits, eligibility, deadlines, and official sources — and
              pairs it with a calendar of public events, so awareness turns into action.
            </p>
            <p>
              Every listing carries its own terms: always review the eligibility criteria,
              deadlines, and official sources on the scheme page before applying. This portal
              presents public information; the issuing authority for each scheme remains
              responsible for its rules and decisions.
            </p>
          </div>
          <aside aria-label="Civic heritage and platform principle">
            <figure className="about-photo">
              <img
                src="/images/government-hero.webp"
                alt="Taj Mahal at dawn — a symbol of India's shared public heritage"
                loading="lazy"
              />
              <figcaption>Public heritage, public service</figcaption>
            </figure>
            <div className="about-pullquote" aria-label="Platform principle">
            <p>“Clear information, responsibly presented.”</p>
            <span>Verification badges, deadlines, and official links on every listing</span>
            </div>
          </aside>
        </section>

        {/* Capabilities */}
        <section className="about-capabilities" aria-labelledby="about-capabilities-title">
          <h2 id="about-capabilities-title" className="about-h2">What citizens can do</h2>
          <p className="about-sub">Everything below is available in the product today.</p>
          <ul className="about-cap-list">
            {capabilities.map((c) => (
              <li key={c.title} className="about-cap-item">
                <CapabilityIcon type={c.icon} />
                <div>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Roles */}
        <section className="about-roles" aria-labelledby="about-roles-title">
          <h2 id="about-roles-title" className="about-h2">Who it serves</h2>
          <div className="about-roles-grid">
            <div className="about-role">
              <span className="pro-status pro-status--approved"><span>Citizen</span></span>
              <p>Discover and bookmark schemes, register for events, manage tickets and preferences.</p>
            </div>
            <div className="about-role">
              <span className="pro-status pro-status--pending"><span>Organizer</span></span>
              <p>Create and manage public events, track registrations, and verify tickets at the venue.</p>
            </div>
            <div className="about-role">
              <span className="pro-status pro-status--rejected"><span>Administrator</span></span>
              <p>Review organizers and events, curate schemes, and monitor platform activity.</p>
            </div>
          </div>
        </section>

        {/* Our Team */}
        <section className="about-team" aria-labelledby="about-team-title">
          <div className="about-team-header">
            <p className="pro-section-eyebrow">Our Team</p>
            <h2 id="about-team-title" className="about-h2">Building the platform together</h2>
            <p className="about-team-subtitle">
              The people behind the Digital Awareness Platform
            </p>
          </div>
          <div className="about-team-grid">
            <article className="about-team-card">
              <div className="about-team-avatar" aria-label="L Tarun">LT</div>
              <h3 className="about-team-name">L Tarun</h3>
            </article>
            <article className="about-team-card">
              <div className="about-team-avatar" aria-label="Kavana R J">KR</div>
              <h3 className="about-team-name">Kavana R J</h3>
            </article>
            <article className="about-team-card">
              <div className="about-team-avatar" aria-label="Prajwal R">PR</div>
              <h3 className="about-team-name">Prajwal R</h3>
            </article>
          </div>
        </section>

        {/* Accessibility and trust */}
        <section className="about-trust" aria-labelledby="about-trust-title">
          <div>
            <h2 id="about-trust-title" className="about-h2">Accessibility and trust</h2>
            <ul className="about-trust-list">
              <li>Readable typography, sufficient contrast, and keyboard-friendly navigation.</li>
              <li>Responsive layouts for mobile, tablet, and desktop, with light and dark themes.</li>
              <li>Semantic structure and focus indicators that work with assistive technologies.</li>
              <li>Secure sign-in with verified sessions; sensitive actions stay confirmed and explicit.</li>
            </ul>
          </div>
          <aside className="about-note" aria-label="Transparency note">
            <h3>Please verify before you apply</h3>
            <p>
              Scheme details can change. Confirm eligibility, deadlines, and application steps
              through the official source linked on each scheme page.
            </p>
          </aside>
        </section>

        {/* Next action */}
        <section className="about-cta" aria-labelledby="about-cta-title">
          <div>
            <h2 id="about-cta-title" className="about-cta-title">Ready to explore?</h2>
            <p className="about-cta-subtitle">
              {isAuthenticated()
                ? `Welcome back, ${user?.name?.split(' ')[0] || 'User'}! See the latest verified schemes and upcoming events.`
                : 'Start by creating a free account — it takes less than 30 seconds.'}
            </p>
          </div>
          <div className="about-cta-buttons">
            {!isAuthenticated() && (
              <Link to="/register" className="btn-primary btn-large">
                Create Account
              </Link>
            )}
            {isAdmin() && (
              <Link to="/admin" className="btn-primary btn-large">
                Admin Panel
              </Link>
            )}
            <Link to="/schemes" className="btn-secondary btn-large">
              View Schemes
            </Link>
          </div>
        </section>

        <p className="about-techline">
          Built with React, Node.js, Express, and MongoDB Atlas · Styled with hand-crafted CSS
        </p>
      </div>
    </div>
  );
};

export default About;
