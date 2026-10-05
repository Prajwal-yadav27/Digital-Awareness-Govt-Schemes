import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';
import * as registrationService from '../services/registrationService';
import * as paymentService from '../services/paymentService';
import * as authService from '../services/authService';

const Profile = () => {
  const { user, bookmarks, logout, loading: authLoading, refreshUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeletePhoneConfirm, setShowDeletePhoneConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [registrations, setRegistrations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [loadingPays, setLoadingPays] = useState(false);
  
  // Phone verification states
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneStep, setPhoneStep] = useState('enter'); // enter, verify
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [notificationPrefs, setNotificationPrefs] = useState({ inApp: true, email: true, sms: false });
  const [prefsLoading, setPrefsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingRegs(true);
    registrationService.getMyRegistrations({ limit: 50 }).then(r => setRegistrations(r.data || [])).catch(()=>{}).finally(()=> setLoadingRegs(false));
    setLoadingPays(true);
    paymentService.getMyPayments({ limit: 50 }).then(r => setPayments(r.data || [])).catch(()=>{}).finally(()=> setLoadingPays(false));
    
    if (user.notificationPreferences) {
      setNotificationPrefs(user.notificationPreferences);
    }
  }, [user]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => setResendCooldown(c => Math.max(0, c - 1)), 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  if (authLoading) {
    return (
      <div className="page-wrapper page-profile">
        <div className="page-container">
          <div className="loader-wrapper" style={{ marginTop: '2rem' }}>
            <div className="loader-spinner"></div>
            <p className="loader-text">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-wrapper page-profile">
        <div className="page-container">
          <EmptyState
            icon="🔐"
            title="Login to view your profile"
            description="You need to be logged in to access your profile page."
            action={<Link to="/login" className="btn-primary">Login Now</Link>}
            secondaryAction={<Link to="/register" className="btn-secondary">Register</Link>}
          />
        </div>
      </div>
    );
  }

  const bookmarkedCount = bookmarks.filter(b => b && typeof b === 'object' && b._id).length;
  const confirmedCount = registrations.filter(r => r.status === 'Confirmed').length;
  const pendingCount = registrations.filter(r => r.status === 'Pending').length;
  const ticketsCount = registrations.filter(r => r.ticketStatus === 'Active').length;
  const isLoadingStats = loadingRegs || loadingPays;

  const formatPhone = (phone) => {
    if (!phone) return 'Not added';
    if (phone.startsWith('+91') && phone.length === 13) {
      return `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`;
    }
    return phone;
  };

  // Accept a plain 10-digit Indian mobile number, with optional spaces,
  // dashes, parentheses, or a +91/91 prefix (e.g. pasted "+919964075156").
  // Returns the E.164 form (+91XXXXXXXXXX) or null when invalid.
  const normalizeInputToE164 = (raw) => {
    const cleaned = (raw || '').replace(/[\s\-()]/g, '');
    if (!cleaned) return null;
    let digits = cleaned;
    if (digits.startsWith('+')) {
      if (!digits.startsWith('+91')) return null;
      digits = digits.slice(3);
    } else if (digits.startsWith('91') && digits.length === 12) {
      digits = digits.slice(2);
    }
    if (!/^[6-9]\d{9}$/.test(digits)) return null;
    return '+91' + digits;
  };

  // Smart Send OTP routing:
  // - no phone on file, or same number entered  -> POST /api/auth/phone/send-otp
  // - different number entered (change flow)    -> PATCH /api/auth/phone
  // The backend enforces uniqueness against OTHER accounts on both paths.
  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) {
      setPhoneError('Please enter a phone number');
      return;
    }
    const normalized = normalizeInputToE164(phoneNumber);
    if (!normalized) {
      setPhoneError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9');
      return;
    }
    setPhoneLoading(true);
    setPhoneError(null);
    try {
      if (user.phone && normalized !== user.phone) {
        await authService.updatePhone(normalized);
        addToast('OTP sent to new phone number', 'success');
      } else {
        await authService.sendPhoneOtp(normalized);
        addToast('OTP sent successfully', 'success');
      }
      setPhoneStep('verify');
      setResendCooldown(60);
    } catch (err) {
      setPhoneError(err.message || 'Failed to send OTP');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setPhoneError('Please enter a valid 6-digit OTP');
      return;
    }
    setPhoneLoading(true);
    setPhoneError(null);
    try {
      const data = await authService.verifyPhoneOtp(otp);
      await refreshUser();
      addToast('Phone number verified successfully!', 'success');
      setShowPhoneModal(false);
      setPhoneStep('enter');
      setPhoneNumber('');
      setOtp('');
      setPhoneError(null);
    } catch (err) {
      setPhoneError(err.message || 'Invalid OTP');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setPhoneLoading(true);
    setPhoneError(null);
    try {
      await authService.resendPhoneOtp();
      setResendCooldown(60);
      addToast('New OTP sent', 'success');
    } catch (err) {
      setPhoneError(err.message || 'Failed to resend OTP');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleDeletePhone = async () => {
    setPhoneLoading(true);
    try {
      await authService.deletePhone();
      await refreshUser();
      addToast('Phone number removed', 'success');
      setShowPhoneModal(false);
      setShowDeletePhoneConfirm(false);
      setPhoneStep('enter');
      setPhoneNumber('');
      setOtp('');
      setPhoneError(null);
    } catch (err) {
      addToast(err.message || 'Failed to remove phone', 'error');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    setPrefsLoading(true);
    try {
      await authService.updateNotificationPreferences(notificationPrefs);
      addToast('Preferences saved', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to save preferences', 'error');
    } finally {
      setPrefsLoading(false);
    }
  };

  const openPhoneModal = () => {
    setPhoneStep(user.phone && user.phoneVerified ? 'enter' : 'enter');
    // Strip +91 prefix if present for the input field
    const displayPhone = user.phone ? user.phone.replace(/^\+91/, '') : '';
    setPhoneNumber(displayPhone);
    setOtp('');
    setPhoneError(null);
    setShowPhoneModal(true);
  };

  const handleLogoutConfirm = () => {
    logout();
    addToast('Logged out successfully', 'success');
    navigate('/login');
  };

  const formattedDate = user.formattedCreatedAt || (user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : null);

  return (
    <div className="page-wrapper page-profile">
      <div className="page-container" style={{ maxWidth: '1100px' }}>
        <div className="profile-wrapper fade-in">
          {/* Profile header */}
          <section className="profile-hero" style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', padding: '24px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--pro-shadow-sm)' }}>
            <div className="profile-avatar-large" style={{ width: '76px', height: '76px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '1.9rem', fontWeight: 800, color: '#fff', background: '#2563eb', flexShrink: 0 }} aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="profile-info-block" style={{ flex: 1, minWidth: '200px' }}>
              <h1 className="profile-name" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{user.name}</h1>
              <p className="profile-email" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>{user.email}</p>
              <div className="profile-badges" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                <span className="pro-status pro-status--approved">
                  <span className="pro-status-icon" aria-hidden="true">{user.role === 'admin' ? '🛡️' : user.role === 'organizer' ? '🏢' : '👤'}</span>
                  <span>{user.role === 'admin' ? 'Administrator' : user.role === 'organizer' ? 'Organizer' : 'Citizen'}</span>
                </span>
                {user.role === 'organizer' && user.isOrganizerVerified && (
                  <span className="pro-status pro-status--approved">
                    <span className="pro-status-icon" aria-hidden="true">✓</span>
                    <span>Verified Organizer</span>
                  </span>
                )}
                {formattedDate && <span className="pro-meta-chip">📅 Joined {formattedDate}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link to="/my-registrations" className="btn-secondary" style={{ textDecoration: 'none' }}>My Events</Link>
              <button type="button" className="btn-secondary" onClick={() => setShowLogoutConfirm(true)} style={{ borderColor: 'rgba(239,68,68,0.22)', color: '#ef4444' }}>Logout</button>
            </div>
          </section>

          {/* Stats — neon */}
          <div className="profile-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginTop: '18px' }}>
            {[
              { icon: '⭐', label: 'Bookmarks', value: bookmarkedCount, loading: false, to: '/bookmarks', color: '#f59e0b' },
              { icon: '🎟️', label: 'Registered', value: registrations.length, loading: loadingRegs, to: '/my-registrations', color: '#38bdf8' },
              { icon: '✅', label: 'Confirmed', value: confirmedCount, loading: loadingRegs, to: '/my-registrations', color: '#22c55e' },
              { icon: '🎫', label: 'Tickets', value: ticketsCount, loading: loadingRegs, to: '/my-registrations', color: '#a855f7' },
              { icon: '💳', label: 'Payments', value: payments.length, loading: loadingPays, to: '/my-registrations', color: '#06b6d4' },
            ].map(s => (
              <div key={s.label} className="profile-stat-card" style={{ padding: '16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--pro-shadow-sm)' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: `${s.color}14`, border: `1px solid ${s.color}22`, color: s.color, fontSize: '1.1rem' }}>{s.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{s.loading ? '0' : s.value}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>{s.label}</div>
                </div>
                <Link to={s.to} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>→</Link>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '22px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'registrations', label: `My Events (${registrations.length})` },
              { id: 'bookmarks', label: `Bookmarks (${bookmarkedCount})` },
              { id: 'payments', label: `Payments (${payments.length})` },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                aria-pressed={activeTab===t.id}
                style={{
                  padding: '8px 14px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700,
                  border: `1px solid ${activeTab===t.id ? '#bfdbfe' : 'var(--border)'}`,
                  background: activeTab===t.id ? 'var(--pro-brand-50)' : 'var(--bg-card)',
                  color: activeTab===t.id ? 'var(--pro-brand-700)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 180ms ease'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ marginTop: '16px' }}>
            {activeTab==='overview' && (
              <div style={{ display: 'grid', gap: '14px' }}>
                <div style={{ padding: '18px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: 'var(--primary)' }}>●</span> Account Overview</h3>
                  <div style={{ display: 'grid', gap: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    <div><strong style={{ color: 'var(--text-primary)' }}>Email:</strong> {user.email}</div>
                    <div><strong style={{ color: 'var(--text-primary)' }}>Role:</strong> {user.role}</div>
                    <div><strong style={{ color: 'var(--text-primary)' }}>Member since:</strong> {formattedDate || '—'}</div>
                    <div><strong style={{ color: 'var(--text-primary)' }}>Bookmarks:</strong> {bookmarkedCount} schemes</div>
                    <div><strong style={{ color: 'var(--text-primary)' }}>Registrations:</strong> {registrations.length} events {confirmedCount>0 && `(${confirmedCount} confirmed)`}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div><strong style={{ color: 'var(--text-primary)' }}>Phone:</strong> {formatPhone(user.phone)}</div>
                      {user.phone ? (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: user.phoneVerified ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.14)',
                          border: `1px solid ${user.phoneVerified ? 'rgba(34,197,94,0.22)' : 'rgba(245,158,11,0.22)'}`,
                          color: user.phoneVerified ? '#22c55e' : '#f59e0b'
                        }}>
                          {user.phoneVerified ? '✓ Verified' : 'Not Verified'}
                        </span>
                      ) : null}
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem', height: 'auto' }}
                        onClick={openPhoneModal}
                      >
                        {user.phone ? (user.phoneVerified ? 'Change' : 'Verify') : 'Add Phone'}
                      </button>
                    </div>
                  </div>
                </div>
                {user.role === 'admin' && (
                  <div style={{ padding: '18px', borderRadius: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>Admin Access</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Manage schemes, events, users and platform analytics.</p>
                    <Link to="/admin" className="btn-primary" style={{ textDecoration: 'none' }}>Open Admin Dashboard →</Link>
                  </div>
                )}
              </div>
            )}
            {activeTab==='registrations' && (
              <div>
                {loadingRegs ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading registrations…</div> : registrations.length===0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>📋</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No registrations yet</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Register for government events to see them here.</div>
                    <Link to="/events" className="btn-primary" style={{ marginTop: '12px', display: 'inline-flex', textDecoration: 'none' }}>Browse Events</Link>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {registrations.slice(0,10).map(r => (
                      <div key={r._id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.status==='Confirmed' ? '#22c55e' : r.status==='Pending' ? '#f59e0b' : '#ef4444', boxShadow: `0 0 8px ${r.status==='Confirmed' ? '#22c55e55' : '#f59e0b55'}`, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.event?.title || 'Event'}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.status} · {r.paymentStatus || 'Unpaid'} {r.ticketStatus==='Active' && '· 🎫 Ticket'}</div>
                        </div>
                        <Link to={`/registrations/${r._id}`} style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>View →</Link>
                      </div>
                    ))}
                    <Link to="/my-registrations" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>View all registrations →</Link>
                  </div>
                )}
              </div>
            )}
            {activeTab==='bookmarks' && (
              <div style={{ padding: '18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Saved Schemes</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{bookmarkedCount} schemes saved. Access them quickly for applications.</p>
                <Link to="/bookmarks" className="btn-secondary" style={{ textDecoration: 'none' }}>Go to Bookmarks</Link>
              </div>
            )}
            {activeTab==='payments' && (
              <div>
                {loadingPays ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading payments…</div> : payments.length===0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No payments yet</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Paid event registrations will appear here after checkout.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {payments.slice(0,10).map(p => (
                      <div key={p._id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: p.status==='Paid' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', border: `1px solid ${p.status==='Paid' ? 'rgba(34,197,94,0.22)' : 'rgba(245,158,11,0.22)'}`, color: p.status==='Paid' ? '#22c55e' : '#f59e0b' }}>{p.status==='Paid' ? '✓' : '⏳'}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{p.event?.title || 'Event'} — {p.status}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>₹{p.amount} · {p.currency} {p.razorpayOrderId ? `· ${p.razorpayOrderId.slice(-8)}` : ''}</div>
                        </div>
                        <span style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '999px', background: p.status==='Paid' ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)', color: p.status==='Paid' ? '#22c55e' : 'var(--text-muted)', border: `1px solid ${p.status==='Paid' ? 'rgba(34,197,94,0.18)' : 'var(--border)'}`, fontWeight: 700 }}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phone Verification Modal */}
      {showPhoneModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="modal-content" style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-card)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {phoneStep === 'enter' ? (user.phone && user.phoneVerified ? 'Change Phone Number' : 'Add Phone Number') : 'Verify Phone Number'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              {phoneStep === 'enter' 
                ? 'Enter your Indian mobile number to receive important alerts about government schemes and public events.'
                : `Enter the 6-digit OTP sent to ${formatPhone(phoneNumber || user.phone)}`}
            </p>

            {phoneError && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.22)', color: '#ef4444', padding: '10px 12px', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '16px' }}>
                {phoneError}
              </div>
            )}

            {phoneStep === 'enter' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Phone Number (+91)
                </label>
                {user.phone && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Current: <strong>{formatPhone(user.phone)}</strong>{' '}
                    {user.phoneVerified ? '(verified)' : '(not verified)'}
                    <br />Enter a different number below to change it, or re-send OTP to verify the current one.
                  </p>
                )}
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="9876543210"
                  disabled={phoneLoading}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  maxLength={16}
                  autoComplete="tel"
                />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Enter 10 digits (you may also paste with +91). We'll send a 6-digit OTP. Valid for 5 minutes.
                </p>
                <button
                  className="btn-primary btn-full"
                  onClick={handleSendOtp}
                  disabled={phoneLoading || !phoneNumber.trim()}
                  style={{ marginTop: '16px' }}
                >
                  {phoneLoading ? 'Sending...' : 'Send OTP'}
                </button>
                {user.phone && (
                  <button
                    className="btn-secondary btn-full"
                    onClick={() => setShowDeletePhoneConfirm(true)}
                    disabled={phoneLoading}
                    style={{ marginTop: '8px', borderColor: 'rgba(239,68,68,0.22)', color: '#ef4444' }}
                  >
                    Remove phone number
                  </button>
                )}
              </div>
            )}

            {phoneStep === 'verify' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  disabled={phoneLoading}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '1.5rem', letterSpacing: '0.3em', textAlign: 'center' }}
                  maxLength={6}
                  autoComplete="one-time-code"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <button
                    className="btn-secondary"
                    onClick={handleResendOtp}
                    disabled={phoneLoading || resendCooldown > 0}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    OTP expires in ~5 minutes
                  </span>
                </div>
                <button
                  className="btn-primary btn-full"
                  onClick={handleVerifyOtp}
                  disabled={phoneLoading || !otp || otp.length !== 6}
                  style={{ marginTop: '16px' }}
                >
                  {phoneLoading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            )}

            <button
              className="btn-secondary"
              onClick={() => { setShowPhoneModal(false); setPhoneStep('enter'); setPhoneNumber(''); setOtp(''); setPhoneError(null); }}
              style={{ marginTop: '16px', width: '100%' }}
              disabled={phoneLoading}
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}

      {/* Notification Preferences Modal - could be added to a settings tab later */}

      <ConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to logout of your account?"
        confirmText="Logout"
      />
      <ConfirmModal
        isOpen={showDeletePhoneConfirm}
        onClose={() => setShowDeletePhoneConfirm(false)}
        onConfirm={handleDeletePhone}
        title="Remove Phone Number"
        message="Are you sure you want to remove your phone number? You will no longer receive SMS alerts."
        confirmText="Remove"
      />
    </div>
  );
};

export default Profile;



