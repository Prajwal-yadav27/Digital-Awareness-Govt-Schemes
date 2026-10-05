import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { publicFetch } from '../services/api';
const Government3DScene = lazy(() => import('../components/Government3DScene'));

const ResetPassword = () => {
  const { token } = useParams();
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!formData.password) {
      setError('New password is required');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await publicFetch(`/auth/reset-password/${token}`, {
        method: 'POST',
        body: JSON.stringify({ password: formData.password })
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Password reset failed. The link may be invalid or expired.');
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
            <p className="auth-visual-subtitle">Choose a strong new password to secure your account.</p>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-card auth-container">
            <div className="auth-header">
              <h2 className="auth-title">Reset Password</h2>
              <p className="auth-subtitle">Enter and confirm your new password</p>
            </div>

            {error && <div className="form-error">{error}</div>}

            {success ? (
              <div>
                <div className="form-success" role="status">
                  Password has been reset successfully. Please login with your new password.
                </div>
                <div className="auth-footer">
                  <Link to="/login" className="auth-link">Go to Login</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-password">New Password</label>
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="form-input"
                    placeholder="At least 6 characters"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reset-confirm">Confirm Password</label>
                  <input
                    id="reset-confirm"
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    className="form-input"
                    placeholder="Re-enter your new password"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-group" style={{ marginTop: '-4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      disabled={loading}
                    />
                    Show passwords
                  </label>
                </div>

                <button type="submit" className="btn-primary btn-full" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            )}

            {!success && (
              <div className="auth-footer">
                <Link to="/login" className="auth-link">Back to Login</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
