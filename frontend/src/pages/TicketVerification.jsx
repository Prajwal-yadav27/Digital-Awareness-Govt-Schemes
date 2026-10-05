import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import BackButton from '../components/BackButton';
import * as ticketService from '../services/ticketService';

const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const TicketVerification = () => {
  const [ticketId, setTicketId] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [verifiedTicketId, setVerifiedTicketId] = useState('');
  const { addToast } = useToast();

  const handleVerify = async (e) => {
    e.preventDefault();
    const trimmed = ticketId.trim();
    if (!trimmed) {
      setError('Please enter a Ticket ID');
      return;
    }
    setVerifying(true);
    setError(null);
    setResult(null);
    setVerifiedTicketId(trimmed);
    try {
      const res = await ticketService.verifyTicket(trimmed);
      setResult({ type: 'valid', data: res.data });
      addToast('Valid ticket', 'success');
    } catch (err) {
      const msg = err.message || 'Verification failed';
      // Handle specific backend responses that include data even on error (e.g., already used, cancelled)
      // Our service throws error with message, but we try to parse body if available
      // For now, show error and try to extract data if err contains it
      setError(msg);
      // Try to check if err has data for already used/cancelled - we show as error state
      // The backend returns 400 with success:false and message, but we can show the message as is
      setResult({ type: 'error', message: msg });
      addToast(msg, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleCheckIn = async () => {
    if (!verifiedTicketId) return;
    setCheckingIn(true);
    setError(null);
    try {
      const res = await ticketService.checkInTicket(verifiedTicketId);
      addToast('Ticket checked in successfully', 'success');
      // Update result to show checked in
      setResult(prev => {
        if (!prev || prev.type !== 'valid') return prev;
        return {
          ...prev,
          type: 'checkedIn',
          data: {
            ...prev.data,
            ticketStatus: 'Used',
            checkedInAt: res.data?.checkedInAt || new Date().toISOString(),
            checkedInBy: res.data?.checkedInBy
          }
        };
      });
      // Re-verify to get updated status
      try {
        const verifyRes = await ticketService.verifyTicket(verifiedTicketId);
        setResult({ type: 'valid', data: verifyRes.data });
      } catch (_) {}
    } catch (err) {
      const msg = err.message || 'Check-in failed';
      setError(msg);
      addToast(msg, 'error');
      // If already used, update result to reflect that
      if (msg.toLowerCase().includes('already been used')) {
        setResult(prev => prev ? { ...prev, type: 'used', message: msg } : { type: 'used', message: msg });
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const getStatusDisplay = () => {
    if (!result) return null;
    if (result.type === 'valid') {
      const data = result.data;
      const isUsed = data.ticketStatus === 'Used';
      const isCancelled = data.ticketStatus === 'Cancelled';
      if (isUsed) return { icon: '⚠', title: 'TICKET ALREADY USED', color: '#92400e', bg: '#fffbeb', border: '#fde68a' };
      if (isCancelled) return { icon: '✕', title: 'TICKET CANCELLED', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
      return { icon: '✓', title: 'VALID TICKET', color: '#15803d', bg: '#f0fdf4', border: '#dcfce7' };
    }
    if (result.type === 'checkedIn') {
      return { icon: '✓', title: 'CHECK-IN SUCCESSFUL', color: '#15803d', bg: '#f0fdf4', border: '#dcfce7' };
    }
    if (result.type === 'used') {
      return { icon: '⚠', title: 'TICKET ALREADY USED', color: '#92400e', bg: '#fffbeb', border: '#fde68a' };
    }
    if (result.type === 'error') {
      const msg = result.message || '';
      if (msg.toLowerCase().includes('cancelled')) return { icon: '✕', title: 'TICKET CANCELLED', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
      if (msg.toLowerCase().includes('already been used') || msg.toLowerCase().includes('already used')) return { icon: '⚠', title: 'TICKET ALREADY USED', color: '#92400e', bg: '#fffbeb', border: '#fde68a' };
      return { icon: '✕', title: 'INVALID TICKET', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
    }
    return null;
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="page-wrapper">
      <div className="page-container" style={{ maxWidth: '720px' }}>
        <BackButton label="Back to Organizer Dashboard" to="/organizer" />

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span className="pro-list-eyebrow">Organizer operations</span>
          <h1 className="page-title" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Verify Government Event Ticket</h1>
          <p className="page-subtitle" style={{ maxWidth: '520px', margin: '0 auto' }}>Enter a Ticket ID to verify its validity and check in attendees</p>
        </div>

        <form onSubmit={handleVerify} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)', marginBottom: '20px' }}>
          <label className="form-label" htmlFor="ticket-id" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Enter Ticket ID</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              id="ticket-id"
              type="text"
              className="form-input"
              placeholder="e.g., EVT-2026-A8F39K21"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              style={{ flex: 1, minWidth: '200px', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.04em' }}
              disabled={verifying || checkingIn}
            />
            <button type="submit" className="btn-primary" disabled={verifying || checkingIn || !ticketId.trim()} style={{ whiteSpace: 'nowrap', minWidth: '120px' }}>
              {verifying ? <><span className="loading-spinner"></span> Verifying...</> : 'Verify Ticket'}
            </button>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '8px' }}>Scan QR code with ticket ID or enter manually. QR scanning via camera not required for this version.</div>
          {error && !result && (
            <div className="form-error" style={{ marginTop: '12px', marginBottom: 0 }}>{error}</div>
          )}
        </form>

        {result && (
          <div style={{ background: '#ffffff', border: `1px solid ${statusDisplay ? statusDisplay.border : '#e2e8f0'}`, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,0.04)', animation: 'fadeIn 0.3s ease' }}>
            <div style={{ background: statusDisplay ? statusDisplay.bg : '#f8fafc', borderBottom: `1px solid ${statusDisplay ? statusDisplay.border : '#e2e8f0'}`, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', marginBottom: '6px' }}>{statusDisplay?.icon}</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: statusDisplay?.color || '#0f172a', letterSpacing: '-0.01em' }}>{statusDisplay?.title}</div>
              {error && result.type === 'error' && <div style={{ fontSize: '0.82rem', color: '#b91c1c', marginTop: '6px' }}>{error}</div>}
            </div>

            {(result.type === 'valid' || result.type === 'checkedIn') && result.data && (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>Event</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{result.data.event?.title || '—'}</div>
                    <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '4px' }}>{result.data.event?.category || ''}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>📅 {result.data.event?.eventDate ? new Date(result.data.event.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                    {result.data.event?.location && <div style={{ fontSize: '0.82rem', color: '#64748b' }}>📍 {result.data.event.location}</div>}
                    {result.data.event?.organizer && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>Organizer: {typeof result.data.event.organizer === 'object' ? result.data.event.organizer.name || result.data.event.organizer.email : String(result.data.event.organizer).slice(-8)}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>Attendee</div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{result.data.attendee?.name || result.data.name || '—'}</div>
                    <div style={{ fontSize: '0.82rem', color: '#475569' }}>{result.data.attendee?.email || result.data.email || ''}</div>
                    <div style={{ fontSize: '0.82rem', color: '#475569' }}>Guests: <strong>{result.data.numberOfGuests ?? '—'}</strong></div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Ticket</div>
                    <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', display: 'inline-block' }}>{result.data.ticketId}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Status</div>
                    <span className={`status-badge ${result.data.ticketStatus === 'Active' ? 'status-active' : result.data.ticketStatus === 'Used' ? 'status-inactive' : 'status-draft'}`}>{result.data.ticketStatus}</span>
                    <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px' }}>Registration: {result.data.registrationStatus}</div>
                  </div>
                  {result.data.checkedInAt && (
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Checked In</div>
                      <div style={{ fontSize: '0.82rem', color: '#0f172a' }}>{new Date(result.data.checkedInAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  )}
                </div>

                {result.type === 'valid' && result.data.ticketStatus === 'Active' && (
                  <button onClick={handleCheckIn} disabled={checkingIn} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginTop: '8px' }}>
                    {checkingIn ? <><span className="loading-spinner"></span> Checking In...</> : 'CHECK IN'}
                  </button>
                )}
                {result.type === 'checkedIn' && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '12px', padding: '12px', textAlign: 'center', color: '#15803d', fontWeight: 700, fontSize: '0.9rem' }}>
                    ✓ CHECK-IN SUCCESSFUL — Status: Used {result.data.checkedInAt ? `· ${new Date(result.data.checkedInAt).toLocaleString('en-IN')}` : ''}
                  </div>
                )}
              </div>
            )}

            {result.type === 'error' && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#475569', fontSize: '0.9rem' }}>
                <p>{result.message || error}</p>
                <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '8px' }}>Please check the Ticket ID and try again.</p>
              </div>
            )}
          </div>
        )}

        {!result && !error && (
          <div style={{ background: '#ffffff', border: '1px dashed #e2e8f0', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🎟</div>
            <div style={{ fontWeight: 600, color: '#334155' }}>Enter a Ticket ID to verify</div>
            <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>Only organizers can verify tickets for their own events. Admins can verify any ticket.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketVerification;
