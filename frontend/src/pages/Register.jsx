import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { lazy, Suspense } from 'react';
const Government3DScene = lazy(() => import('../components/Government3DScene'));

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { register } = useAuth();
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { confirmPassword, ...userData } = formData;
      const data = await register(userData);
      addToast(`Account created! Welcome, ${data.name}!`, 'success');
      navigate('/');
    } catch (err) {
      setError(err.message);
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper page-auth page-register">
      <Suspense fallback={null}>
        <Government3DScene variant="auth" />
      </Suspense>
      <div className="auth-split-layout">
        {/* Left Visual Panel — Cinematic 3D Government */}
        <div className="auth-visual-panel" aria-hidden="true">
          <div className="auth-visual-overlay" aria-hidden="true"></div>
          <div className="auth-visual-bg">
            <div className="auth-glow auth-glow-1"></div>
            <div className="auth-glow auth-glow-2"></div>
            <div className="auth-glow auth-glow-3"></div>
            <div className="auth-shape auth-shape-1"></div>
            <div className="auth-shape auth-shape-2"></div>
            <div className="auth-shape auth-shape-3"></div>
          </div>
          <div className="auth-visual-content">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.20)', color: '#7dd3fc', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }}></span>
              Digital Government Platform
            </div>
            <h1 className="auth-visual-title" style={{ fontSize: '1.9rem', lineHeight: 1.15 }}>Join GovSchemes Portal</h1>
            <p style={{ fontSize: '1.05rem', fontWeight: 700, background: 'linear-gradient(135deg, #38bdf8, #22d3ee 50%, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: '8px 0 12px', lineHeight: 1.3 }}>
              Government Services,<br/>Built for Every Citizen
            </p>
            <p className="auth-visual-subtitle">Create an account to bookmark schemes, track your interests, and stay updated on government welfare programs.</p>
            <div className="login-3d-scene" aria-hidden="true">
              <div className="login-float-card">
                <span className="login-float-icon" style={{ background: 'rgba(34,197,94,0.14)', borderColor: 'rgba(34,197,94,0.22)', color: '#4ade80' }}>🌾</span>
                <span><strong style={{ color: '#fff', fontSize: '0.82rem' }}>Agriculture</strong><br/><span style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.70rem' }}>Farmer Support</span></span>
              </div>
              <div className="login-float-card">
                <span className="login-float-icon" style={{ background: 'rgba(59,130,246,0.14)', borderColor: 'rgba(59,130,246,0.22)', color: '#60a5fa' }}>🎓</span>
                <span><strong style={{ color: '#fff', fontSize: '0.82rem' }}>Education</strong><br/><span style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.70rem' }}>Student Scholarships</span></span>
              </div>
              <div className="login-float-card">
                <span className="login-float-icon" style={{ background: 'rgba(236,72,153,0.14)', borderColor: 'rgba(236,72,153,0.22)', color: '#f472b6' }}>👩</span>
                <span><strong style={{ color: '#fff', fontSize: '0.82rem' }}>Women & Child</strong><br/><span style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.70rem' }}>Women Empowerment</span></span>
              </div>
              <div className="login-float-card">
                <span className="login-float-icon" style={{ background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.20)', color: '#f87171' }}>🏥</span>
                <span><strong style={{ color: '#fff', fontSize: '0.82rem' }}>Healthcare</strong><br/><span style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.70rem' }}>Health & Welfare</span></span>
              </div>
              <div className="login-float-card">
                <span className="login-float-icon" style={{ background: 'rgba(139,92,246,0.14)', borderColor: 'rgba(139,92,246,0.22)', color: '#a78bfa' }}>🏛️</span>
                <span><strong style={{ color: '#fff', fontSize: '0.82rem' }}>Citizen Services</strong><br/><span style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.70rem' }}>Digital Access</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="auth-form-panel">
          <div className="auth-card auth-container">
            <div className="auth-header">
              <h2 className="auth-title">Create Account</h2>
              <p className="auth-subtitle">Register to discover government schemes</p>
            </div>

            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="John Doe"
                  disabled={loading}
                  autoComplete="name"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">Email Address</label>
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="you@example.com"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">Password</label>
                <input
                  id="reg-password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="At least 6 characters"
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
                <input
                  id="reg-confirm"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="Re-enter your password"
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-phone">Phone Number (Optional)</label>
                <input
                  id="reg-phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="+91 XXXXX XXXXX"
                  disabled={loading}
                  autoComplete="tel"
                  maxLength={15}
                />
                <p className="form-hint" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Indian mobile number. Used for important alerts. Can be added later.
                </p>
              </div>

              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>

              {/* Social Login Section */}
              <div className="social-divider">
                <span className="divider-text">Or continue with</span>
              </div>

              <div className="social-buttons">
                <button
                  className="btn-social btn-google"
                  onClick={() => window.location.href = '/api/auth/google'}
                  aria-label="Register with Google"
                >
                  <svg className="social-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  </svg>
                  Continue with Google
                </button>

                <button
                  className="btn-social btn-x"
                  onClick={() => window.location.href = '/api/auth/twitter'}
                  aria-label="Register with X"
                >
                  <svg className="social-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M18.244 2.25h3.308l-6.732 7.63 8.92 9.857-7.733.746 4.305 7.636-8.378-1.82L.72 17.005l9.882-1.41 2.348 6.575h2.71l-6.123-7.42 6.738-9.106-3.213 4.092z"/>
                  </svg>
                  Continue with X
                </button>
              </div>
            </form>

            <div className="auth-footer">
              Already have an account? <Link to="/login" className="auth-link">Sign in here</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
