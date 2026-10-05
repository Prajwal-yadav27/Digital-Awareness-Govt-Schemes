import { useState, useEffect, useRef } from 'react';
import * as eventService from '../services/eventService';
import { getSchemes } from '../services/schemeService';

const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/i;

const AUDIENCE_OPTIONS = ['Farmers', 'Students', 'Youth', 'Women', 'Senior Citizens', 'Job Seekers', 'Entrepreneurs', 'Small Businesses', 'General Public'];

const EventForm = ({ isOpen, onClose, onSubmit, mode = 'create', initialData = null, loading = false }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
    eventDate: '',
    registrationDeadline: '',
    capacity: '',
    imageUrl: '',
    eligibility: '',
    benefits: '',
    documentsRequired: [],
    isPaidEvent: false,
    registrationFee: '',
    department: '',
    schemeId: '',
    sourceType: 'Local',
    eventFormat: 'offline',
    targetAudience: [],
    ward: '',
    district: '',
    state: '',
    contactInfo: ''
  });
  const [docDraft, setDocDraft] = useState('');
  const [error, setError] = useState(null);
  const [imageUrlError, setImageUrlError] = useState(null);
  const titleRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [schemesLoading, setSchemesLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setSchemesLoading(true);
    getSchemes({ limit: 200, status: 'Approved' }).then(res => {
      setSchemes(res.data || []);
    }).catch(() => setSchemes([])).finally(() => setSchemesLoading(false));

    if (mode === 'edit' && initialData) {
      const toInputDate = (d) => {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };
      setForm({
        title: initialData.title || '',
        category: initialData.category || '',
        description: initialData.description || '',
        location: initialData.location || '',
        eventDate: toInputDate(initialData.eventDate),
        registrationDeadline: toInputDate(initialData.registrationDeadline),
        capacity: initialData.capacity ? String(initialData.capacity) : '',
        imageUrl: initialData.imageUrl || '',
        eligibility: initialData.eligibility || '',
        benefits: initialData.benefits || '',
        documentsRequired: Array.isArray(initialData.documentsRequired) ? [...initialData.documentsRequired] : [],
        isPaidEvent: !!initialData.isPaidEvent,
        registrationFee: initialData.registrationFee ? String(initialData.registrationFee) : '',
        department: initialData.department || '',
        schemeId: initialData.schemeId || '',
        sourceType: initialData.sourceType || 'Local',
        eventFormat: initialData.eventFormat || 'offline',
        targetAudience: Array.isArray(initialData.targetAudience) ? [...initialData.targetAudience] : [],
        ward: initialData.ward || '',
        district: initialData.district || '',
        state: initialData.state || '',
        contactInfo: initialData.contactInfo || ''
      });
      setEditingId(initialData._id || null);
    } else {
      setForm({
        title: '',
        description: '',
        category: '',
        location: '',
        eventDate: '',
        registrationDeadline: '',
        capacity: '',
        imageUrl: '',
        eligibility: '',
        benefits: '',
        documentsRequired: [],
        isPaidEvent: false,
        registrationFee: '',
        department: '',
        schemeId: '',
        sourceType: 'Local',
        eventFormat: 'offline',
        targetAudience: [],
        ward: '',
        district: '',
        state: '',
        contactInfo: ''
      });
      setEditingId(null);
    }
    setError(null);
    setImageUrlError(null);
    setDocDraft('');
    setTimeout(() => titleRef.current?.focus?.(), 50);
  }, [isOpen, initialData, mode]);

  if (!isOpen) return null;

  const isEditing = mode === 'edit' && !!editingId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.description.trim() || !form.category.trim() || !form.eventDate) {
      setError('Title, Description, Category and Event Date are required');
      return;
    }
    if (form.title.trim().length < 3) { setError('Title must be at least 3 characters'); return; }
    if (form.description.trim().length < 10) { setError('Description must be at least 10 characters'); return; }
    if (form.category.trim().length < 2) { setError('Category must be at least 2 characters'); return; }

    const eventDateObj = new Date(form.eventDate);
    if (isNaN(eventDateObj.getTime())) { setError('Invalid event date'); return; }

    if (form.registrationDeadline) {
      const deadlineObj = new Date(form.registrationDeadline);
      if (isNaN(deadlineObj.getTime())) { setError('Invalid registration deadline'); return; }
      if (deadlineObj > eventDateObj) { setError('Registration deadline cannot be after event date'); return; }
    }

    if (form.capacity) {
      const cap = Number(form.capacity);
      if (!Number.isInteger(cap) || cap < 1 || cap > 10000) { setError('Capacity must be an integer between 1 and 10000'); return; }
    }

    if (form.imageUrl.trim() && !URL_REGEX.test(form.imageUrl.trim())) {
      setError('Image URL must be a valid URL starting with http:// or https://');
      setImageUrlError('Invalid URL format');
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      location: form.location.trim(),
      eventDate: new Date(form.eventDate).toISOString(),
      registrationDeadline: form.registrationDeadline ? new Date(form.registrationDeadline).toISOString() : undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      imageUrl: form.imageUrl.trim(),
      eligibility: form.eligibility.trim(),
      benefits: form.benefits.trim(),
      documentsRequired: form.documentsRequired,
      isPaidEvent: form.isPaidEvent,
      registrationFee: form.isPaidEvent && form.registrationFee ? Number(form.registrationFee) : 0,
      department: form.department.trim(),
      schemeId: form.schemeId || null,
      sourceType: form.sourceType,
      eventFormat: form.eventFormat,
      targetAudience: form.targetAudience,
      ward: form.ward.trim(),
      district: form.district.trim(),
      state: form.state.trim(),
      contactInfo: form.contactInfo.trim()
    };
    // Remove undefined
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    try {
      let response;
      if (isEditing) {
        response = await eventService.updateEvent(editingId, payload);
      } else {
        response = await eventService.createEvent(payload);
      }
      if (onSubmit) await onSubmit(payload, response);
      onClose();
    } catch (err) {
      setError(err.message || 'Request failed');
    }
  };

  const handleAddDoc = () => {
    const val = docDraft.trim();
    if (!val) return;
    if (form.documentsRequired.includes(val)) { setDocDraft(''); return; }
    if (form.documentsRequired.length >= 30) { setError('Maximum 30 documents allowed'); return; }
    setForm(prev => ({ ...prev, documentsRequired: [...prev.documentsRequired, val] }));
    setDocDraft('');
  };

  const handleRemoveDoc = (doc) => {
    setForm(prev => ({ ...prev, documentsRequired: prev.documentsRequired.filter(d => d !== doc) }));
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-container modal-large" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{isEditing ? 'Edit Event' : 'Create Event'}</h3>
            <p className="modal-subtitle" style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
              {isEditing ? 'Update event details. Approved events will require re-approval.' : 'Event will be submitted for admin approval.'}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} disabled={loading} aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-section">
            <div className="form-section-title"><span className="form-section-icon">①</span> Basic Information</div>
            <div className="form-grid">
              <div className="form-group form-grid-2">
                <label className="form-label">Title <span className="required-mark">*</span></label>
                <input ref={titleRef} type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="form-input" placeholder="e.g., Health Awareness Camp" disabled={loading} maxLength={200} />
              </div>
              <div className="form-group">
                <label className="form-label">Category <span className="required-mark">*</span></label>
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="form-input" placeholder="e.g., Healthcare, Education" disabled={loading} />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="form-input" placeholder="Venue or online link" disabled={loading} maxLength={200} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title"><span className="form-section-icon">②</span> Schedule & Capacity</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Event Date <span className="required-mark">*</span></label>
                <input type="datetime-local" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} className="form-input" disabled={loading} />
              </div>
              <div className="form-group">
                <label className="form-label">Registration Deadline</label>
                <input type="datetime-local" value={form.registrationDeadline} onChange={e => setForm({ ...form, registrationDeadline: e.target.value })} className="form-input" disabled={loading} />
                <span className="form-help-text">Must be before event date</span>
              </div>
              <div className="form-group">
                <label className="form-label">Capacity</label>
                <input type="number" min={1} max={10000} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="form-input" placeholder="e.g., 100" disabled={loading} />
                <span className="form-help-text">Leave empty for unlimited. 1–10000.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Image URL</label>
                <input type="url" value={form.imageUrl} onChange={e => { setForm({ ...form, imageUrl: e.target.value }); setImageUrlError(e.target.value && e.target.value.trim() && !URL_REGEX.test(e.target.value.trim()) ? 'Invalid URL' : null); }} className={`form-input ${imageUrlError ? 'form-input-error' : ''}`} placeholder="https://example.com/image.jpg" disabled={loading} />
                {imageUrlError && <span className="form-field-error">{imageUrlError}</span>}
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title"><span className="form-section-icon">③</span> Details</div>
            <div className="form-group">
              <label className="form-label">Description <span className="required-mark">*</span></label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="form-textarea" rows={3} placeholder="Event description..." disabled={loading} maxLength={4000} />
              <span className="form-help-text">{form.description.length} / 4000</span>
            </div>
            <div className="form-group">
              <label className="form-label">Eligibility</label>
              <textarea value={form.eligibility} onChange={e => setForm({ ...form, eligibility: e.target.value })} className="form-textarea" rows={2} placeholder="Who can attend?" disabled={loading} maxLength={2000} />
            </div>
            <div className="form-group">
              <label className="form-label">Benefits</label>
              <textarea value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} className="form-textarea" rows={2} placeholder="Benefits for attendees" disabled={loading} maxLength={4000} />
            </div>
          </div>

          <div className="form-section" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            <div className="form-section-title"><span className="form-section-icon">④</span> Government Event Details</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Department</label>
                <input type="text" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="form-input" placeholder="e.g. Department of Agriculture" disabled={loading} maxLength={100} />
              </div>
              <div className="form-group">
                <label className="form-label">Related Government Scheme</label>
                <select value={form.schemeId} onChange={e => setForm({ ...form, schemeId: e.target.value })} className="form-input" disabled={loading || schemesLoading}>
                  <option value="">None</option>
                  {schemes.map(s => (
                    <option key={s._id} value={s._id}>{s.title}</option>
                  ))}
                </select>
                {schemesLoading && <span className="form-help-text">Loading schemes...</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Government Source</label>
                <select value={form.sourceType} onChange={e => setForm({ ...form, sourceType: e.target.value })} className="form-input" disabled={loading}>
                  <option value="Local">Local</option>
                  <option value="State">State</option>
                  <option value="Central">Central</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Event Format</label>
                <select value={form.eventFormat} onChange={e => setForm({ ...form, eventFormat: e.target.value })} className="form-input" disabled={loading}>
                  <option value="offline">Offline</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Target Audience</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {AUDIENCE_OPTIONS.map(opt => {
                  const selected = form.targetAudience.includes(opt);
                  return (
                    <button key={opt} type="button" disabled={loading}
                      onClick={() => {
                        setForm(prev => ({
                          ...prev,
                          targetAudience: selected
                            ? prev.targetAudience.filter(a => a !== opt)
                            : [...prev.targetAudience, opt]
                        }));
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: '16px', border: '1px solid',
                        borderColor: selected ? '#2563eb' : '#d1d5db',
                        background: selected ? '#eff6ff' : '#fff',
                        color: selected ? '#1d4ed8' : '#374151',
                        fontSize: '0.8rem', cursor: 'pointer'
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="form-grid" style={{ marginTop: '12px' }}>
              <div className="form-group">
                <label className="form-label">Ward</label>
                <input type="text" value={form.ward} onChange={e => setForm({ ...form, ward: e.target.value })} className="form-input" placeholder="Enter ward" disabled={loading} maxLength={100} />
              </div>
              <div className="form-group">
                <label className="form-label">District</label>
                <input type="text" value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} className="form-input" placeholder="Enter district" disabled={loading} maxLength={100} />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input type="text" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="form-input" placeholder="Enter state" disabled={loading} maxLength={100} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Contact Information</label>
              <textarea value={form.contactInfo} onChange={e => setForm({ ...form, contactInfo: e.target.value })} className="form-textarea" rows={2} placeholder="Government department contact details" disabled={loading} maxLength={500} />
            </div>
          </div>

          <div className="form-section" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
            <div className="form-section-title"><span className="form-section-icon">⑤</span> Required Documents</div>
            <div className="form-group">
              <label className="form-label">Documents Required</label>
              <div className="doc-input-row">
                <input type="text" value={docDraft} onChange={e => setDocDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDoc(); }}} className="form-input" placeholder="Type document and press Enter" disabled={loading} maxLength={200} />
                <button type="button" className="btn-secondary" onClick={handleAddDoc} disabled={loading || !docDraft.trim()}>Add</button>
              </div>
              {form.documentsRequired.length > 0 ? (
                <div className="docs-chip-list" style={{ marginTop: '8px' }}>
                  {form.documentsRequired.map(d => (
                    <span key={d} className="doc-chip-removable">
                      {d} <button type="button" className="doc-chip-remove" onClick={() => handleRemoveDoc(d)} aria-label={`Remove ${d}`}>×</button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="docs-empty" style={{ marginTop: '8px' }}>No documents added.</div>
              )}
            </div>
          </div>

          {/* Payment Settings */}
          <div className="form-section">
            <div className="form-section-title"><span className="form-section-icon">⑥</span> Payment Settings</div>
            <div className="form-group">
              <label className="form-label">Event Type</label>
              <div className="status-segmented" role="radiogroup" aria-label="Event payment type">
                <button type="button" role="radio" aria-checked={!form.isPaidEvent} className={`status-option ${!form.isPaidEvent ? 'active status-active' : ''}`} onClick={() => setForm({ ...form, isPaidEvent: false, registrationFee: '' })} disabled={loading}>
                  <span className="status-option-label">Free Event</span>
                  <span className="status-option-desc">No registration fee</span>
                </button>
                <button type="button" role="radio" aria-checked={form.isPaidEvent} className={`status-option ${form.isPaidEvent ? 'active status-draft' : ''}`} onClick={() => setForm({ ...form, isPaidEvent: true })} disabled={loading}>
                  <span className="status-option-label">Paid Event</span>
                  <span className="status-option-desc">Requires registration fee</span>
                </button>
              </div>
            </div>
            {form.isPaidEvent && (
              <div className="form-group">
                <label className="form-label">Registration Fee (₹) <span className="required-mark">*</span></label>
                <input type="number" min={1} value={form.registrationFee} onChange={e => setForm({ ...form, registrationFee: e.target.value })} className={`form-input ${form.isPaidEvent && (!form.registrationFee || Number(form.registrationFee) <= 0) ? 'form-input-error' : ''}`} placeholder="e.g., 500" disabled={loading} max={100000} />
                {form.isPaidEvent && form.registrationFee !== '' && Number(form.registrationFee) <= 0 && (
                  <span className="form-field-error">Registration fee must be greater than 0 for paid events</span>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading || !!imageUrlError}>
              {loading ? <><span className="loading-spinner"></span>{isEditing ? 'Updating...' : 'Creating...'}</> : (isEditing ? 'Update Event' : 'Create Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventForm;
