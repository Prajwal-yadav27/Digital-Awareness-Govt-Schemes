import { useState } from 'react';
import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { publicFetch } from '../services/api';
const Government3DScene = lazy(() => import('../components/Government3DScene'));

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email address is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please provide a valid email address');
      return;
    }
    setLoading(true);
    try {
      const res = await publicFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed })
      });
      setEmailSent(Boolean(res?.data?.emailSent));
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper page-auth page-login">
      <Suspense fallback={null}>
        <Government3DScene variant="auth" />
      </Suspense>
      <div className="auth-split-layout auth-split-layout-login">
        <div className="auth-visual-panel auth-visual-panel-login" aria-hidden="true">
          <div className="auth-visual-overlay" aria-hidden="true"></div>
          <div className="auth-visual-bg">
            <div className="auth-glow auth-glow-1"></div>
            <div className="auth-glow auth-glow-2"></div>
            <div className="auth-glow auth-glow-3"></div>
          </div>
          <div className="auth-visual-content">
            <h1 className="auth-visual-title" style={{ fontSize: '1.9rem', lineHeight: 1.15 }}>GovSchemes Portal</h1>
            <p style={{ fontSize: '1.05rem', fontWeight: 700, background: 'linear-gradient(135deg, #38bdf8, #22d3ee 50%, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: '8px 0 12px', lineHeight: 1.3 }}>
              Government Services,<br />Built for Every Citizen
            </p>
            <p className="auth-visual-subtitle">Secure account recovery for citizens and administrators.</p>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-card auth-container">
            <div className="auth-header">
              <h2 className="auth-title">Forgot Password?</h2>
              <p className="auth-subtitle">Enter the email address associated with your account and we&apos;ll send you a password reset link.</p>
            </div>

            {error && <div className="form-error">{error}</div>}

            {submitted ? (
              <div>
                <div className="form-success" role="status">
                  If an account exists for this email, a password reset link has been sent.
                  {!emailSent && (
                    <span style={{ display: 'block', marginTop: '8px', fontSize: '0.85rem', opacity: 0.85 }}>
                      Email delivery is not configured right now — please contact support if you do not receive a link.
                    </span>
                  )}
                </div>
                <div className="auth-footer">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <Link to="/login" className="auth-link">Back to Login</Link>
                    <Link to="/" className="auth-link" style={{ fontSize: '0.85rem', opacity: 0.85 }}>← Back to Home</Link>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email">Email Address</label>
                  <input
                    id="forgot-email"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="form-input"
                    placeholder="you@example.com"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>

                <button type="submit" className="btn-primary btn-full" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            )}

            {!submitted && (
              <div className="auth-footer">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                  <Link to="/login" className="auth-link">Back to Login</Link>
                  <Link to="/" className="auth-link" style={{ fontSize: '0.85rem', opacity: 0.85 }}>← Back to Home</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
