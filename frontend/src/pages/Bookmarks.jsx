import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SchemeCard from '../components/SchemeCard';
import { SkeletonSchemesGrid } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';

const Bookmarks = () => {
  const { bookmarks, isAuthenticated, loading: authLoading, refreshBookmarks } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!authLoading && isAuthenticated()) {
        try {
          await refreshBookmarks();
        } catch (err) {
          addToast(err.message || 'Error loading bookmarks', 'error');
        }
      }
      setLoading(false);
    };
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [authLoading, isAuthenticated, refreshBookmarks, addToast]);

  if (loading || authLoading) {
    return (
      <div className="page-wrapper">
        <div className="page-container">
          <header className="page-header">
            <div>
              <h1 className="page-title">My Bookmarked Schemes</h1>
              <p className="page-subtitle">Your saved government schemes</p>
            </div>
          </header>
          <SkeletonSchemesGrid count={3} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return (
      <div className="page-wrapper">
        <div className="page-container">
          <EmptyState
            icon="🔐"
            title="Login to view your bookmarks"
            description="Create an account or login to bookmark schemes and view your saved list."
            action={<Link to="/login" className="btn-primary">Login</Link>}
            secondaryAction={<Link to="/register" className="btn-secondary">Register</Link>}
          />
        </div>
      </div>
    );
  }

  const bookmarkedSchemes = bookmarks
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'object') {
        if (entry.scheme && typeof entry.scheme === 'object' && entry.scheme._id) {
          return entry.scheme;
        }
        if (entry._id && (entry.title || entry.category)) {
          return entry;
        }
        if (entry.scheme) {
          return { _id: entry.scheme };
        }
      }
      return null;
    })
    .filter(Boolean);

  return (
    <div className="page-wrapper page-bookmarks">
      <div className="page-container">
        <header className="page-header">
          <div>
            <h1 className="page-title">⭐ My Bookmarked Schemes</h1>
            <p className="page-subtitle">You have bookmarked <strong>{bookmarkedSchemes.length}</strong> schemes</p>
          </div>
          <Link to="/" className="btn-secondary">
            Browse All
          </Link>
        </header>

        {bookmarkedSchemes.length === 0 ? (
          <EmptyState
            icon="☆"
            title="No bookmarks yet"
            description="Click the bookmark icon on any scheme to save it here for quick access later."
            action={<Link to="/" className="btn-primary">Explore Schemes</Link>}
          />
        ) : (
          <div className="schemes-grid">
            {bookmarkedSchemes.map(scheme => (
              <SchemeCard
                key={scheme._id}
                scheme={scheme}
                isAdmin={false}
                showBookmark={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Bookmarks;
