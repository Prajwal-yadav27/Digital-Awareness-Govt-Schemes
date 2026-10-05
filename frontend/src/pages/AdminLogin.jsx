import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_BASE_URL } from '../services/api';
import { lazy, Suspense } from 'react';
const Government3DScene = lazy(() => import('../components/Government3DScene'));

const AdminLogin = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(formData);
      if (data.role !== 'admin') {
        setError('Access denied: Admin credentials required.');
        addToast('Access denied: Admin credentials required.', 'error');
        return;
      }
      addToast(`Welcome back, ${data.name}!`, 'success');
      navigate('/admin');
    } catch (err) {
      setError(err.message);
      addToast(err.message, 'error');
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
            <div className="auth-shape auth-shape-1"></div>
            <div className="auth-shape auth-shape-2"></div>
            <div className="auth-shape auth-shape-3"></div>
          </div>
          <div className="auth-visual-content">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#fca5a5', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '16px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.5)' }}></span>
              Secure Admin Access
            </div>
            <h1 className="auth-visual-title" style={{ fontSize: '1.9rem', lineHeight: 1.15 }}>Admin Portal</h1>
            <p style={{ fontSize: '1.05rem', fontWeight: 700, background: 'linear-gradient(135deg, #f87171, #fb7185 50%, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', margin: '8px 0 12px', lineHeight: 1.3 }}>
              Government Schemes<br/>Administration
            </p>
            <p className="auth-visual-subtitle">Secure access for verified administrators to manage schemes, events, and citizen services.</p>
            <div className="login-3d-scene" aria-hidden="true">
              <div className="login-float-card">
                <span className="login-float-icon" style={{ background: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.22)', color: '#f87171' }}>🛡️</span>
                <span><strong style={{ color: '#fff', fontSize: '0.82rem' }}>Secure Access</strong><br/><span style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.70rem' }}>Role Verified</span></span>
              </div>
              <div className="login-float-card">
                <span className="login-float-icon" style={{ background: 'rgba(59,130,246,0.14)', borderColor: 'rgba(59,130,246,0.22)', color: '#60a5fa' }}>📊</span>
                <span><strong style={{ color: '#fff', fontSize: '0.82rem' }}>Dashboard</strong><br/><span style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.70rem' }}>Analytics & Control</span></span>
              </div>
              <div className="login-float-card">
                <span className="login-float-icon" style={{ background: 'rgba(139,92,246,0.14)', borderColor: 'rgba(139,92,246,0.22)', color: '#a78bfa' }}>🏛️</span>
                <span><strong style={{ color: '#fff', fontSize: '0.82rem' }}>Government Services</strong><br/><span style={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.70rem' }}>Secure Management</span></span>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-card auth-container">
            <div className="auth-header">
              <div style={{ width: '48px', height: '48px', margin: '0 auto 12px', borderRadius: '12px', background: 'linear-gradient(135deg, #dc2626, #991b1b)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '1.4rem', boxShadow: '0 8px 20px rgba(220,38,38,0.25)' }}>🛡️</div>
              <h2 className="auth-title">Admin Login</h2>
              <p className="auth-subtitle">Sign in with administrator credentials</p>
            </div>

            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="admin-email">Email Address</label>
                <input id="admin-email" type="email" name="email" value={formData.email} onChange={handleChange} required className="form-input" placeholder="admin@example.com" disabled={loading} autoComplete="email" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="admin-password">Password</label>
                <input id="admin-password" type="password" name="password" value={formData.password} onChange={handleChange} required className="form-input" placeholder="Your password" disabled={loading} autoComplete="current-password" />
              </div>

              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? <><span className="loading-spinner"></span> Authenticating...</> : 'Sign In as Admin'}
              </button>

              <div style={{ textAlign: 'right', marginTop: '10px' }}>
                <Link to="/forgot-password" className="auth-link" style={{ fontSize: '0.85rem' }}>Forgot Password?</Link>
              </div>

              <div className="social-divider">
                <span className="divider-text">Or continue with</span>
              </div>

              <div className="social-buttons">
                <button type="button" className="btn-social btn-google" onClick={() => { window.location.href = `${API_BASE_URL}/auth/google`; }} aria-label="Login with Google">
                  <svg className="social-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  </svg>
                  Continue with Google
                </button>
                <button type="button" className="btn-social btn-x" onClick={() => { window.location.href = `${API_BASE_URL}/auth/twitter`; }} aria-label="Login with X">
                  <svg className="social-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M18.244 2.25h3.308l-6.732 7.63 8.92 9.857-7.733.746 4.305 7.636-8.378-1.82L.72 17.005l9.882-1.41 2.348 6.575h2.71l-6.123-7.42 6.738-9.106-3.213 4.092z"/>
                  </svg>
                  Continue with X
                </button>
              </div>
            </form>

            <div className="auth-footer">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <Link to="/login" className="auth-link">User / Client Login →</Link>
                <Link to="/" className="auth-link" style={{ fontSize: '0.85rem', opacity: 0.85 }}>← Back to Home</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
