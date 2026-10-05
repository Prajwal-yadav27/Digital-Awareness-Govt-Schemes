import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSchemeImage } from '../utils/images';

const truncate = (value, length) => (value?.length > length ? `${value.slice(0, length)}...` : value);

const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

const getDeadlineState = (scheme) => {
  if (!scheme?.endDate) return null;
  const end = new Date(scheme.endDate);
  if (isNaN(end.getTime())) return null;
  const now = Date.now();
  const label = end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (end.getTime() < now) {
    return { tone: 'expired', text: `Applications closed · Ended ${label}` };
  }
  if (end.getTime() - now <= EXPIRING_SOON_MS) {
    return { tone: 'warn', text: `Closing soon · Ends ${label}` };
  }
  return { tone: 'ok', text: `Ends: ${label}` };
};

  const SchemeCard = ({ scheme, onEdit, onDelete, isAdmin, showBookmark = true }) => {
    const [imgError, setImgError] = useState(false);
    const { isAuthenticated, toggleBookmark, isBookmarked } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const bookmarked = isBookmarked(scheme._id);

  const handleBookmark = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!scheme || !scheme._id) {
      addToast('Invalid scheme data', 'error');
      return;
    }
    if (!isAuthenticated()) {
      addToast('Please login to bookmark schemes', 'warning');
      navigate('/login');
      return;
    }
    if (bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      const result = await toggleBookmark(scheme._id);
      addToast(
        result?.bookmarked ? `${scheme.title} added to bookmarks` : `${scheme.title} removed from bookmarks`,
        'success'
      );
    } catch (err) {
      addToast(err.message || 'Failed to update bookmark', 'error');
    } finally {
      setBookmarkLoading(false);
    }
  };

  const isCentral = scheme.sourceType === 'CENTRAL' || scheme.sourceType === 'Central Govt';
  const isState = scheme.sourceType === 'STATE' || scheme.sourceType === 'State Govt';
  const cover = getSchemeImage(scheme);

  const deadline = getDeadlineState(scheme);

  return (
    <article
      className="scheme-card"
      aria-labelledby={`scheme-title-${scheme._id}`}
    >
      <Link to={`/schemes/${scheme._id}`} className="scheme-card-image-wrap" aria-label={`View ${scheme.title}`}>
        <img src={(!imgError && scheme.imageUrl) ? scheme.imageUrl : cover} alt={`${scheme.title} — ${scheme.category} scheme`} className="scheme-card-image" loading="lazy" onError={() => setImgError(true)} />
        <div className="scheme-card-image-overlay">
          <span className="category-badge" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', borderColor: 'rgba(255,255,255,0.9)', color: '#0f172a' }}>{scheme.category}</span>
        </div>
        {showBookmark && (
          <button
            type="button"
            className={`scheme-card-bookmark ${bookmarked ? 'bookmarked' : ''}`}
            onClick={handleBookmark}
            disabled={bookmarkLoading}
            title={bookmarked ? 'Remove from bookmarks' : 'Save to bookmarks'}
            aria-label={bookmarked ? `Remove ${scheme.title} from bookmarks` : `Save ${scheme.title} to bookmarks`}
            aria-pressed={bookmarked}
          >
            {bookmarked ? '★' : '☆'}
          </button>
        )}
      </Link>

      <div className="scheme-card-body">
        <Link to={`/schemes/${scheme._id}`} className="scheme-card-title-link" style={{ textDecoration: 'none' }}>
          <h3 id={`scheme-title-${scheme._id}`} className="scheme-card-title">{scheme.title}</h3>
        </Link>

        <div className="scheme-card-meta">
          {isCentral && <span className="source-badge source-central">Central Govt</span>}
          {isState && <span className="source-badge source-state">State Govt{scheme.state ? ` · ${scheme.state}` : ''}</span>}
          {!isCentral && !isState && scheme.sourceType && <span className="source-badge source-central">{scheme.sourceType}</span>}
          {scheme.status && <span className={`status-badge ${scheme.status === 'Active' ? 'status-active' : scheme.status === 'Inactive' ? 'status-inactive' : 'status-draft'}`} style={{ fontSize: '0.68rem' }}>{scheme.status}</span>}
        </div>

        <p className="scheme-card-desc">{truncate(scheme.description, 140)}</p>

        {scheme.eligibilityTags?.length > 0 && (
          <div className="scheme-card-eligibility" aria-label="Eligibility tags">
            {scheme.eligibilityTags.slice(0, 3).map((tag) => (
              <span key={tag} className="eligibility-tag" style={{ fontSize: '0.7rem', padding: '3px 7px' }}>{tag}</span>
            ))}
            {scheme.eligibilityTags.length > 3 && <span className="eligibility-tag eligibility-tag-more">+{scheme.eligibilityTags.length - 3}</span>}
          </div>
        )}

        <div className="scheme-card-benefits">
          <strong>Benefits:</strong> {truncate(scheme.benefits, 90)}
        </div>
        {deadline && (
          <div
            className={`pro-card-deadline pro-card-deadline--${deadline.tone}`}
            role="status"
            aria-label={`Application deadline: ${deadline.text}`}
          >
            <span aria-hidden="true">{deadline.tone === 'expired' ? '⛔' : deadline.tone === 'warn' ? '⏳' : '📅'}</span>
            <span>{deadline.text}</span>
          </div>
        )}
      </div>

      <div className="scheme-card-footer">
        <Link to={`/schemes/${scheme._id}`} className="btn-card-primary">View Details</Link>
        {isAdmin && onEdit && (
          <button type="button" className="btn-card-secondary" onClick={() => onEdit(scheme)} aria-label={`Edit ${scheme.title}`}>Edit</button>
        )}
        {isAdmin && onDelete && (
          <button type="button" className="btn-card-secondary" onClick={() => onDelete(scheme)} aria-label={`Delete ${scheme.title}`} style={{ color: '#dc2626', borderColor: '#fecaca' }}>Delete</button>
        )}
        {scheme.officialURL && !isAdmin && (
          <a href={scheme.officialURL} target="_blank" rel="noopener noreferrer" className="btn-card-secondary" onClick={(e) => e.stopPropagation()}>Official</a>
        )}
      </div>
    </article>
  );
};

export default SchemeCard;
