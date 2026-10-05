import '../styles/schemeDetails.css';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getSchemeImage } from '../utils/images';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonDetails } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import BackButton from '../components/BackButton';
import * as schemeService from '../services/schemeService';

const splitIntoList = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/[.\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
};

const normalizeSourceType = (value) => {
  if (!value) return null;
  const raw = String(value).trim().toUpperCase();
  if (raw === 'CENTRAL' || raw.includes('CENTRAL')) return 'CENTRAL';
  if (raw === 'STATE' || raw.includes('STATE')) return 'STATE';
  return null;
};

const SchemeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, toggleBookmark, isBookmarked, bookmarks } = useAuth();
  const { addToast } = useToast();

  const [scheme, setScheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  const bookmarked = isBookmarked(id);
  const officialURL =
    scheme?.officialURL ||
    scheme?.officialUrl ||
    scheme?.official_url ||
    '';

  const fetchScheme = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await schemeService.getSchemeById(id);
      setScheme(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load scheme details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheme();
  }, [id]);

  useEffect(() => {
    if (!scheme || !bookmarks || bookmarks.length === 0) return;
  }, [bookmarks, scheme]);

  const handleBookmark = async () => {
    if (!isAuthenticated()) {
      addToast('Please login to bookmark schemes', 'warning');
      navigate('/login');
      return;
    }

    if (bookmarkLoading) return;

    setBookmarkLoading(true);

    try {
      const result = await toggleBookmark(id);

      addToast(
        result?.bookmarked
          ? `${scheme?.title || 'Scheme'} added to bookmarks`
          : `${scheme?.title || 'Scheme'} removed from bookmarks`,
        'success'
      );
    } catch (err) {
      addToast(err.message || 'Failed to update bookmark', 'error');
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleApplyNow = async () => {
    if (applyLoading) return;

    if (!isAuthenticated()) {
      addToast('Please login to continue', 'warning');
      navigate('/login');
      return;
    }

    if (!officialURL) {
      addToast('Official website not available', 'warning');
      return;
    }

    setApplyLoading(true);

    const opened = window.open(officialURL, '_blank', 'noopener,noreferrer');

    try {
      const result = await schemeService.recordApplyNow(id);

      setScheme(prev =>
        prev
          ? {
              ...prev,
              applyCount:
                result.data?.applyCount ||
                (prev.applyCount || 0) + 1,
            }
          : prev
      );

      addToast('Opening official website...', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to record apply action', 'warning');
      if (!opened) {
        addToast('Please allow popups to open the official website', 'warning');
      }
    } finally {
      setApplyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="page-container">
          <BackButton label="Back to Schemes" />
          <SkeletonDetails />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="page-container">
          <BackButton label="Back" />
          <ErrorState
            message={error}
            onRetry={fetchScheme}
            onSecondary={() => navigate('/')}
            secondaryLabel="Go Home"
          />
        </div>
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="page-wrapper">
        <div className="page-container">
          <BackButton label="Back" />
          <EmptyState
            icon="🔍"
            title="Scheme not found"
            description="The scheme you are looking for does not exist."
            action={
              <Link to="/" className="btn-primary">
                Browse All Schemes
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const sourceType = normalizeSourceType(scheme.sourceType);
  const isCentral = sourceType === 'CENTRAL';
  const isState = sourceType === 'STATE';

  const title = scheme.title || 'Untitled Scheme';
  const category = scheme.category || 'Uncategorized';
  const description = scheme.description || 'Description not specified.';
  const eligibilityText = scheme.eligibility || 'Eligibility not specified.';
  const benefitsText = scheme.benefits || 'Benefits not specified.';

  const eligibilityItems = splitIntoList(eligibilityText);
  const benefitsItems = splitIntoList(benefitsText);

  const hasEligibility = eligibilityItems.length > 0;
  const hasBenefits = benefitsItems.length > 0;
  const hasDocs = Array.isArray(scheme.documentsRequired) && scheme.documentsRequired.length > 0;
  const hasTags = Array.isArray(scheme.eligibilityTags) && scheme.eligibilityTags.length > 0;
  const endDateObj = scheme.endDate ? new Date(scheme.endDate) : null;
  const hasEndDate = !!(endDateObj && !isNaN(endDateObj.getTime()));
  const isExpired = hasEndDate && endDateObj.getTime() < Date.now();
  const isExpiringSoon = hasEndDate && !isExpired && (endDateObj.getTime() - Date.now()) <= 7 * 24 * 60 * 60 * 1000;
  const endDateLabel = hasEndDate
    ? endDateObj.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="page-wrapper page-scheme-detail">
      <div className="page-container" style={{ maxWidth: '900px' }}>
        <nav className="pro-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">→</span>
          <Link to="/schemes">Schemes</Link>
          <span aria-hidden="true">→</span>
          <span className="pro-breadcrumb-current" aria-current="page">{title}</span>
        </nav>
        <BackButton label="Back to Schemes" />

        <article className="scheme-detail-wrapper fade-in">
           <div className="pro-detail-hero">
              <img src={getSchemeImage(scheme)} alt={`${scheme.title} — ${scheme.category} scheme`} loading="lazy" />
            </div>

          <header className="scheme-detail-header">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="scheme-detail-title">{title}</h1>

              <div className="scheme-detail-meta">
                <span className="category-badge" style={{ background: '#f1f5f9', color: '#475569', borderColor: '#e2e8f0' }}>{category}</span>

                {isCentral && (
                  <span className="source-badge source-central">
                    Central Government
                  </span>
                )}

                {isState && (
                  <span className="source-badge source-state">
                    {scheme.state || 'State Government'}
                  </span>
                )}

                {!isCentral && !isState && scheme.sourceType && (
                  <span className="source-badge source-central">
                    {scheme.sourceType}
                  </span>
                )}

                {scheme.status && (
                  <span className={`status-badge ${scheme.status === 'Active' ? 'status-active' : scheme.status === 'Inactive' ? 'status-inactive' : 'status-draft'}`}>
                    {scheme.status}
                  </span>
                )}

                {scheme.applyCount != null && scheme.applyCount > 0 && (
                  <span className="apply-count-badge" style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#dcfce7' }}>
                    {scheme.applyCount} applied
                  </span>
                )}
                {isExpired && (
                  <span className="status-badge status-inactive">Expired — Applications closed</span>
                )}
                {isExpiringSoon && (
                  <span className="status-badge status-draft" style={{ background: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}>
                    Closing soon — Ends {endDateLabel}
                  </span>
                )}
                {!isExpired && !isExpiringSoon && hasEndDate && (
                  <span className="status-badge status-draft" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                    Ends: {endDateLabel}
                  </span>
                )}
              </div>

              {hasTags && (
                <div className="detail-eligibility-tags" style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {scheme.eligibilityTags.slice(0, 8).map((tag, i) => (
                    <span key={`${tag}-${i}`} className="eligibility-tag eligibility-tag-lg" style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#dcfce7' }}>
                      {tag}
                    </span>
                  ))}
                  {scheme.eligibilityTags.length > 8 && (
                    <span className="eligibility-tag eligibility-tag-more eligibility-tag-lg">
                      +{scheme.eligibilityTags.length - 8} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="scheme-detail-actions">
              <button
                type="button"
                className={`btn-bookmark ${bookmarked ? 'active bookmarked' : ''}`}
                onClick={handleBookmark}
                disabled={bookmarkLoading}
                aria-pressed={bookmarked}
                aria-label={bookmarked ? `Remove ${title} from bookmarks` : `Save ${title} to bookmarks`}
                title={bookmarked ? 'Remove from bookmarks' : 'Save to bookmarks'}
                style={{ background: bookmarked ? '#fef3c7' : '#ffffff', borderColor: bookmarked ? '#fcd34d' : '#e2e8f0', color: bookmarked ? '#92400e' : '#475569' }}
              >
                {bookmarkLoading
                  ? 'Updating...'
                  : bookmarked
                    ? '★ Saved'
                    : '☆ Save'}
              </button>
            </div>
          </header>

          <section className="pro-info-panel" aria-label="Important information">
            <h2>Important information</h2>
            <div className="pro-info-grid">
              <div className="pro-info-item">
                <span className="pro-info-label">Category</span>
                <span className="pro-info-value">{category}</span>
              </div>
              <div className="pro-info-item">
                <span className="pro-info-label">Source</span>
                <span className="pro-info-value">
                  {isCentral ? 'Central Government' : isState ? (scheme.state ? `State Government · ${scheme.state}` : 'State Government') : (scheme.sourceType || '—')}
                </span>
              </div>
              <div className="pro-info-item">
                <span className="pro-info-label">Status</span>
                <span className="pro-info-value">{isExpired ? 'Expired' : (scheme.status || '—')}</span>
              </div>
              <div className="pro-info-item">
                <span className="pro-info-label">End date</span>
                <span className="pro-info-value">{hasEndDate ? endDateLabel : 'No deadline specified'}</span>
              </div>
              <div className="pro-info-item">
                <span className="pro-info-label">Applications</span>
                <span className="pro-info-value">{scheme.applyCount != null && scheme.applyCount > 0 ? `${scheme.applyCount} applied` : '—'}</span>
              </div>
              <div className="pro-info-item">
                <span className="pro-info-label">Eligibility tags</span>
                <span className="pro-info-value">{hasTags ? `${scheme.eligibilityTags.length} tag${scheme.eligibilityTags.length > 1 ? 's' : ''}` : '—'}</span>
              </div>
            </div>
          </section>

          <div className="scheme-detail-grid">
            <section className="scheme-section-card">
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <h2 className="scheme-section-title">Description</h2>
              </div>
              <div className="scheme-section-body">
                {description ? <p>{description}</p> : <p className="scheme-muted">Not specified</p>}
              </div>
            </section>

            <section className="scheme-section-card">
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <h2 className="scheme-section-title">Eligibility</h2>
              </div>
              <div className="scheme-section-body">
                {hasEligibility ? (
                  <ul className="scheme-bullets">
                    {eligibilityItems.map((item, i) => (
                      <li key={`elig-${i}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="scheme-muted">{eligibilityText || 'Not specified'}</p>
                )}
              </div>
            </section>

            <section className="scheme-section-card">
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9"/>
                    <line x1="15" y1="9" x2="15.01" y2="9"/>
                  </svg>
                </div>
                <h2 className="scheme-section-title">Benefits</h2>
              </div>
              <div className="scheme-section-body">
                {hasBenefits ? (
                  <ul className="scheme-bullets">
                    {benefitsItems.map((item, i) => (
                      <li key={`ben-${i}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="scheme-muted">{benefitsText || 'Not specified'}</p>
                )}
              </div>
            </section>

            <section className="scheme-section-card">
              <div className="scheme-section-head">
                <div className="scheme-section-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </div>
                <h2 className="scheme-section-title">Required Documents</h2>
              </div>
              <div className="scheme-section-body">
                {hasDocs ? (
                  <div className="docs-preview-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {scheme.documentsRequired.map((doc, i) => (
                      <span key={`doc-${i}`} className="doc-chip" style={{ background: '#f8fafc', color: '#334155', borderColor: '#e2e8f0' }}>
                        {doc}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="scheme-muted">Not specified</p>
                )}
              </div>
            </section>

            {(officialURL || scheme.imageUrl) && (
              <section className="scheme-section-card" style={{ gridColumn: '1 / -1' }}>
                <div className="scheme-section-head">
                  <div className="scheme-section-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </div>
                  <h2 className="scheme-section-title">Important Links</h2>
                </div>
                <div className="scheme-section-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {officialURL && (
                      <a href={officialURL} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        🔗 Official Website — {officialURL}
                      </a>
                    )}
                    {scheme.imageUrl && (
                      <span style={{ fontSize: '0.85rem', color: '#64748b', wordBreak: 'break-all' }}>🖼️ Image: {scheme.imageUrl}</span>
                    )}
                    {!officialURL && !scheme.imageUrl && <span className="scheme-muted">No links available</span>}
                  </div>
                </div>
              </section>
            )}
          </div>

          {isExpired && (
            <div className="pro-banner pro-banner--expired" role="status">
              <span aria-hidden="true">⛔</span>
              <span>This scheme ended on {endDateLabel} and is no longer accepting applications.</span>
            </div>
          )}
          {isExpiringSoon && (
            <div className="pro-banner pro-banner--warn" role="status">
              <span aria-hidden="true">⏳</span>
              <span>Closing soon — this scheme ends on {endDateLabel}. Apply before the deadline.</span>
            </div>
          )}
          {!isExpired && !isExpiringSoon && hasEndDate && (
            <div className="pro-banner pro-banner--info" role="status">
              <span aria-hidden="true">📅</span>
              <span>Applications are open until {endDateLabel}.</span>
            </div>
          )}
          <div className="scheme-detail-cta-footer">
            <button
              className="btn-primary btn-apply-now"
              onClick={handleApplyNow}
              disabled={applyLoading || !officialURL || isExpired}
              title={isExpired ? 'This scheme has expired' : undefined}
              style={{ padding: '12px 24px', fontSize: '0.95rem' }}
            >
              {applyLoading ? 'Processing...' : 'Apply Now'}
            </button>
            {officialURL ? (
              <a
                className="btn-secondary scheme-official-link btn-visit-website btn-visit-website-lg"
                href={officialURL}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '12px 24px', background: '#ffffff', borderColor: '#e2e8f0', color: '#334155' }}
              >
                Official Website
              </a>
            ) : (
              <span className="cta-note" style={{ fontSize: '0.85rem', color: '#64748b' }}>Official website link not available for this scheme yet.</span>
            )}
          </div>

          {isAdmin() && (
            <div className="scheme-admin-shortcut" style={{ marginTop: '16px', textAlign: 'right' }}>
              <Link to="/admin" className="link-inline" style={{ color: '#2563eb', fontWeight: 600 }}>Go to Admin Dashboard</Link>
            </div>
          )}

        </article>
      </div>
    </div>
  );
};

export default SchemeDetails;
