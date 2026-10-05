import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as eventReviewService from '../services/eventReviewService';
import ConfirmModal from './ConfirmModal';

const formatDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const renderStars = (rating, size = '0.85rem') => {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{ color: i < rating ? '#f59e0b' : '#e2e8f0', fontSize: size }} aria-hidden="true">★</span>
  ));
};

const EventReviews = ({ eventId, isAuthenticated, user, userRole }) => {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [hasConfirmedReg, setHasConfirmedReg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetchReviews();
    if (isAuthenticated && userRole === 'user') {
      checkEligibility();
    }
  }, [eventId]);

  const fetchReviews = async () => {
    try {
      const res = await eventReviewService.getEventReviews(eventId, { limit: 20 });
      setReviews(res.data || []);
      setSummary(res.summary || null);
    } catch (_) {}
    setLoading(false);
  };

  const checkEligibility = async () => {
    try {
      const myRes = await eventReviewService.getMyEventReview(eventId);
      if (myRes.data) {
        setMyReview(myRes.data);
      } else {
        // Check if user has confirmed registration
        const regCheck = await fetch(`/api/registrations/my?limit=100`).then(r => r.json()).catch(() => null);
        const hasReg = regCheck?.data?.some(r =>
          String(r.event?._id || r.event) === String(eventId) && r.status === 'Confirmed'
        );
        setHasConfirmedReg(hasReg);
      }
    } catch (_) {}
  };

  const canWrite = isAuthenticated && userRole === 'user' && !myReview;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Summary */}
      {summary && summary.totalReviews > 0 && (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap', padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{summary.averageRating}</div>
            <div>{renderStars(Math.round(summary.averageRating))}</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{summary.totalReviews} review{summary.totalReviews !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = summary.distribution[star] || 0;
              const pct = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;
              return (
                <div key={star} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 30px', gap: '8px', alignItems: 'center', fontSize: '0.78rem' }}>
                  <span style={{ color: '#64748b' }}>{star} ★</span>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#f59e0b', borderRadius: '999px' }} />
                  </div>
                  <span style={{ color: '#64748b', textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Write Review CTA */}
      {isAuthenticated && userRole === 'user' && !myReview && hasConfirmedReg && !loading && (
        !showForm ? (
          <button className="btn-primary" onClick={() => setShowForm(true)} style={{ alignSelf: 'flex-start' }}>Write a Review</button>
        ) : (
          <ReviewForm eventId={eventId} onSubmitted={() => { setShowForm(false); fetchReviews(); checkEligibility(); }} onCancel={() => setShowForm(false)} />
        )
      )}
      {!isAuthenticated && (
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>Login to write a review after attending this event.</p>
      )}

      {/* My existing review */}
      {myReview && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2563eb', marginBottom: '8px' }}>Your Review</div>
          {editingId ? (
            <ReviewForm
              eventId={eventId}
              initialData={myReview}
              onSubmitted={() => { setEditingId(null); fetchReviews(); checkEligibility(); }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <>
              <div>{renderStars(myReview.rating)}</div>
              <p style={{ fontSize: '0.88rem', color: '#334155', marginTop: '6px' }}>{myReview.comment || ''}</p>
              <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '4px' }}>{formatDate(myReview.createdAt)}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button className="btn-secondary" style={{ fontSize: '0.76rem', padding: '4px 10px' }} onClick={() => { setEditingId(myReview._id); setEditRating(myReview.rating); setEditComment(myReview.comment); }}>Edit</button>
                <button className="btn-secondary" style={{ fontSize: '0.76rem', padding: '4px 10px', borderColor: '#fecaca', color: '#b91c1c' }} onClick={() => setDeleteTarget(myReview)}>Delete</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Not eligible message */}
      {isAuthenticated && userRole === 'user' && !myReview && !hasConfirmedReg && !loading && (
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>Reviews are available after confirming this event.</p>
      )}

      {/* All reviews list */}
      {loading ? (
        <div>Loading reviews...</div>
      ) : reviews.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reviews.filter(r => !myReview || r._id !== myReview._id).map(review => (
            <div key={review._id} style={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.88rem' }}>{review.user?.name || 'Anonymous'}</div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{formatDate(review.createdAt)}</div>
                </div>
                <div>{renderStars(review.rating)}</div>
              </div>
              {review.comment && <p style={{ fontSize: '0.86rem', color: '#334155', margin: 0, lineHeight: 1.55 }}>{review.comment}</p>}
            </div>
          ))}
        </div>
      ) : !loading && (!summary || summary.totalReviews === 0) ? (
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>No reviews yet. Be the first to review!</p>
      ) : null}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try {
            await eventReviewService.deleteReview(deleteTarget._id);
            setDeleteTarget(null);
            setMyReview(null);
            fetchReviews();
          } catch (err) {}
        }}
        title="Delete Review"
        message="Are you sure you want to delete your review?"
        confirmText="Delete"
        danger={true}
      />
    </div>
  );
};

const ReviewForm = ({ eventId, initialData, onSubmitted, onCancel }) => {
  const [rating, setRating] = useState(initialData?.rating || 5);
  const [comment, setComment] = useState(initialData?.comment || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { eventId, rating, comment: comment.trim() };
      if (initialData?._id) {
        await eventReviewService.updateReview(initialData._id, { rating, comment: comment.trim() });
      } else {
        await eventReviewService.createReview(payload);
      }
      onSubmitted();
    } catch (err) {}
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <label className="form-label" style={{ marginBottom: 0 }}>Rating</label>
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} type="button" onClick={() => setRating(star)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: star <= rating ? '#f59e0b' : '#e2e8f0', padding: 0, transition: 'color 0.15s ease' }} aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}>★</button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        className="form-textarea"
        rows={3}
        placeholder="Share your experience..."
        maxLength={1000}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{comment.length} / 1000</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn-secondary" style={{ fontSize: '0.8rem', padding: '5px 12px' }} onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting} style={{ fontSize: '0.8rem', padding: '5px 14px' }}>
            {initialData?._id ? 'Update Review' : 'Submit Review'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default EventReviews;
