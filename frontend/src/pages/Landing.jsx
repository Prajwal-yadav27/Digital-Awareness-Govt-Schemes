import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SchemeCard from '../components/SchemeCard';
import EventCard from '../components/EventCard';
import { SkeletonSchemesGrid } from '../components/SkeletonLoader';
import * as schemeService from '../services/schemeService';
import * as eventService from '../services/eventService';
import * as adminService from '../services/adminService';

const Landing = () => {
  const [featuredSchemes, setFeaturedSchemes] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [heroSearch, setHeroSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const [schemesRes, eventsRes] = await Promise.all([
          schemeService.getSchemes({ limit: 3, sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ data: [] })),
          eventService.getEvents({ limit: 3 }).catch(() => ({ data: [] })),
        ]);
        setFeaturedSchemes((schemesRes.data || []).slice(0, 3));
        setUpcomingEvents((eventsRes.data || []).slice(0, 3));
      } catch {
        // silent
      } finally {
        setLoadingFeatured(false);
      }
    };
    fetchFeatured();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await adminService.getAdminOverview().catch(() => null);
        if (res?.data) {
          setStats({
            totalSchemes: res.data.totalSchemes,
            activeSchemes: res.data.activeSchemes,
            totalUsers: res.data.totalUsers,
            totalEvents: res.data.totalEvents ?? null,
          });
        } else {
          // Fallback to public counts
          const [schemesRes, eventsRes] = await Promise.all([
            schemeService.getSchemes({ limit: 1 }).catch(() => null),
            eventService.getEvents({ limit: 1 }).catch(() => null),
          ]);
          setStats({
            totalSchemes: schemesRes?.pagination?.total ?? null,
            activeSchemes: null,
            totalUsers: null,
            totalEvents: eventsRes?.pagination?.total ?? null,
          });
        }
      } catch {
        setStatsError(true);
      }
    };
    fetchStats();
  }, []);

  const handleHeroSearch = (e) => {
    e.preventDefault();
    const q = heroSearch.trim();
    navigate(q ? `/schemes?search=${encodeURIComponent(q)}` : '/schemes');
  };

  return (
    <div className="page-wrapper page-landing">
      {/* Hero — two-column: copy + search left, CSS visual right */}
      <section className="pro-hero" aria-labelledby="landing-hero-title">
        <div className="pro-hero-grid">
          <div>
            <span className="pro-eyebrow">Central &amp; State government services</span>
            <h1 id="landing-hero-title" className="pro-hero-title">
              Discover government schemes <span>and public events</span>
            </h1>
            <p className="pro-hero-sub">
              Citizens can discover government welfare schemes and find relevant public events —
              with clear eligibility, benefits, and organised, accessible information in one place.
            </p>
            <div className="pro-cta-row">
              <Link to="/schemes" className="btn-primary">Explore Government Schemes</Link>
              <Link to="/events" className="btn-secondary">View Public Events</Link>
            </div>
            <form className="pro-search-card" onSubmit={handleHeroSearch} role="search" aria-label="Find government schemes">
              <label htmlFor="landing-scheme-search">Find Government Schemes</label>
              <div className="pro-search-row">
                <input
                  id="landing-scheme-search"
                  type="search"
                  placeholder="Search schemes by name, category, department…"
                  value={heroSearch}
                  onChange={(e) => setHeroSearch(e.target.value)}
                  aria-label="Search schemes by name, category, department"
                />
                <button type="submit" className="btn-primary">Search</button>
              </div>
              <p className="pro-search-hint">Uses the same search as the Schemes page — try “education”, “health”, or “agriculture”.</p>
            </form>
          </div>
          <div className="pro-visual" aria-hidden="true">
            <div className="pro-visual-head">
              <span className="pro-visual-dot" />
              <span className="pro-visual-dot" />
              <span className="pro-visual-dot" />
              <span className="pro-visual-title">GovSchemes Portal</span>
            </div>
            <div className="pro-visual-card">
              <span className="pro-visual-tag">Central Govt</span>
              <strong>Scholarship &amp; Education Support</strong>
              <span>Eligibility · Benefits · Deadline</span>
            </div>
            <div className="pro-visual-card">
              <span className="pro-visual-tag">State Govt</span>
              <strong>Health &amp; Welfare Camp</strong>
              <span>12 Dec · District venue · Free entry</span>
            </div>
            <div className="pro-visual-card">
              <span className="pro-visual-tag">Saved</span>
              <strong>Bookmarked schemes</strong>
              <span>Track schemes you care about</span>
            </div>
            <div className="pro-visual-foot">
              <span className="pro-visual-chip">Verified listings</span>
              <span className="pro-visual-chip">Clear eligibility</span>
              <span className="pro-visual-chip">Timely alerts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick access */}
      <section className="pro-section" aria-labelledby="quick-access-title">
        <div className="pro-section-head">
          <div>
            <h2 id="quick-access-title" className="pro-section-title">Quick access</h2>
            <p className="pro-section-sub">Jump straight to the parts of the platform you use most.</p>
          </div>
        </div>
        <div className="pro-quick-grid">
          <Link to="/schemes" className="pro-quick-card">
            <span className="pro-quick-icon" aria-hidden="true">📋</span>
            <h3>Government Schemes</h3>
            <p>Discover available government welfare and support schemes.</p>
            <span className="pro-quick-link">Browse schemes →</span>
          </Link>
          <Link to="/events" className="pro-quick-card">
            <span className="pro-quick-icon" aria-hidden="true">🎟️</span>
            <h3>Public Events</h3>
            <p>Find upcoming government and public awareness events.</p>
            <span className="pro-quick-link">Browse events →</span>
          </Link>
          <Link to="/bookmarks" className="pro-quick-card">
            <span className="pro-quick-icon" aria-hidden="true">⭐</span>
            <h3>My Bookmarks</h3>
            <p>Access schemes you have saved for later.</p>
            <span className="pro-quick-link">View bookmarks →</span>
          </Link>
          <Link to="/notifications" className="pro-quick-card">
            <span className="pro-quick-icon" aria-hidden="true">🔔</span>
            <h3>Notifications</h3>
            <p>View important updates and alerts.</p>
            <span className="pro-quick-link">View notifications →</span>
          </Link>
        </div>
      </section>

      {/* Statistics — real platform data only */}
      <section className="landing-section landing-stats-section" aria-labelledby="stats-title">
        <div className="page-container">
          <h2 id="stats-title" className="landing-section-title">Platform at a Glance</h2>
          <p className="landing-section-subtitle">Real data from the platform — gracefully handled if unavailable.</p>
          {statsError ? (
            <div className="landing-stats-empty">Statistics are currently unavailable. Please check back later.</div>
          ) : !stats ? (
            <div className="landing-stats-grid">
              {[1,2,3,4].map(i => <div key={i} className="landing-stat-card skeleton" style={{ height: '100px', background: 'var(--bg-card)', borderRadius: '16px' }}></div>)}
            </div>
          ) : (
            <div className="landing-stats-grid">
              <div className="landing-stat-card">
                <div className="landing-stat-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#2563eb' }}>📊</div>
                <div className="landing-stat-value">{stats.totalSchemes ?? '—'}</div>
                <div className="landing-stat-label">Total Schemes</div>
              </div>
              <div className="landing-stat-card">
                <div className="landing-stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>✓</div>
                <div className="landing-stat-value">{stats.activeSchemes ?? '—'}</div>
                <div className="landing-stat-label">Active Schemes</div>
              </div>
              <div className="landing-stat-card">
                <div className="landing-stat-icon" style={{ background: 'rgba(168,85,247,0.12)', color: '#7c3aed' }}>🎫</div>
                <div className="landing-stat-value">{stats.totalEvents ?? '—'}</div>
                <div className="landing-stat-label">Government/Public Events</div>
              </div>
              <div className="landing-stat-card">
                <div className="landing-stat-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>👥</div>
                <div className="landing-stat-value">{stats.totalUsers ?? '—'}</div>
                <div className="landing-stat-label">Registered Citizens</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Featured */}
      <section className="landing-section" aria-labelledby="featured-title">
        <div className="page-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div>
              <h2 id="featured-title" className="landing-section-title" style={{ marginBottom: '6px' }}>Featured Government Schemes</h2>
              <p className="landing-section-subtitle" style={{ margin: 0 }}>Latest verified schemes from the portal.</p>
            </div>
            <Link to="/schemes" className="btn-secondary">View all schemes</Link>
          </div>
          {loadingFeatured ? <SkeletonSchemesGrid count={3} /> : featuredSchemes.length > 0 ? (
            <div className="schemes-grid">
              {featuredSchemes.map(s => <SchemeCard key={s._id} scheme={s} showBookmark={false} />)}
            </div>
          ) : (
            <div className="landing-empty">No schemes available right now.</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '40px', marginBottom: '18px' }}>
            <div>
              <h2 className="landing-section-title" style={{ marginBottom: '6px' }}>Upcoming Government/Public Events</h2>
              <p className="landing-section-subtitle" style={{ margin: 0 }}>Approved public events from verified organizers.</p>
            </div>
            <Link to="/events" className="btn-secondary">View all events</Link>
          </div>
          {loadingFeatured ? <SkeletonSchemesGrid count={3} /> : upcomingEvents.length > 0 ? (
            <div className="schemes-grid">
              {upcomingEvents.map(ev => <EventCard key={ev._id} event={ev} />)}
            </div>
          ) : (
            <div className="landing-empty">No upcoming events at the moment.</div>
          )}
        </div>
      </section>

      {/* Trust / information */}
      <section className="pro-section" aria-labelledby="platform-purpose-title" style={{ paddingTop: 8 }}>
        <div className="pro-trust">
          <div className="pro-trust-card">
            <h2 id="platform-purpose-title">One platform for government information</h2>
            <p className="pro-trust-sub">A single, organised place for citizens to stay informed — without hunting across portals.</p>
            <div className="pro-trust-item">
              <strong>Discover relevant schemes</strong>
              <span>Search and filter schemes by category, department, and eligibility.</span>
            </div>
            <div className="pro-trust-item">
              <strong>Stay informed about public events</strong>
              <span>Find approved government events with dates, venues, and registration.</span>
            </div>
            <div className="pro-trust-item">
              <strong>Receive important updates</strong>
              <span>Get notifications about deadlines, approvals, and event changes.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Accessibility */}
      <section className="landing-section landing-accessibility" aria-labelledby="accessibility-title">
        <div className="page-container">
          <div className="landing-accessibility-card">
            <div>
              <h2 id="accessibility-title" className="landing-section-title" style={{ textAlign: 'left', marginBottom: '10px' }}>Accessibility for Every Citizen</h2>
              <p className="landing-section-subtitle" style={{ textAlign: 'left', margin: '0 0 14px 0' }}>
                This platform is designed with accessibility in mind.
              </p>
              <ul className="landing-accessibility-list">
                <li>✓ Clear, readable typography and sufficient color contrast</li>
                <li>✓ Keyboard-friendly navigation and focus indicators</li>
                <li>✓ Responsive layout for mobile, tablet and desktop</li>
                <li>✓ Semantic HTML and ARIA labels for assistive technologies</li>
                <li>✓ Text size controls and high-contrast support via browser and theme</li>
              </ul>
              <p className="landing-accessibility-note">
                Accessibility is part of the official project title. The UI foundation above ensures the platform remains usable for all citizens. Additional assistive features can be extended without breaking existing functionality.
              </p>
            </div>
            <div className="landing-accessibility-visual" aria-hidden="true">
              <div className="a11y-circle">Aa</div>
              <div className="a11y-badge">♿ Accessible</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
