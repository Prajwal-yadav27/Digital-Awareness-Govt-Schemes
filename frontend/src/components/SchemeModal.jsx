import { useState, useEffect, useRef } from 'react';
import * as schemeService from '../services/schemeService';
import { authFetch } from '../services/api';

const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/i;

const toDateInputValue = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const SchemeModal = ({ isOpen, onClose, onSubmit, mode = 'add', initialData = null, loading = false }) => {
  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    sourceType: 'Central Govt',
    state: '',
    officialUrl: '',
    imageUrl: '',
    status: 'Active',
    endDate: '',
    eligibility: '',
    benefits: '',
    documentsRequired: [],
    eligibilityTags: []
  });
  const [editingId, setEditingId] = useState(null);
  const [docDraft, setDocDraft] = useState('');
  const [metadata, setMetadata] = useState({
    sourceTypes: [],
    eligibilityTags: [],
    states: [],
    categories: []
  });
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [error, setError] = useState(null);
  const [urlError, setUrlError] = useState(null);
  const [imageUrlError, setImageUrlError] = useState(null);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const titleInputRef = useRef(null);

  const initialId = initialData && typeof initialData === 'object' ? initialData._id : null;

  useEffect(() => {
    if (!isOpen) return;

    setMetadataLoading(true);
    schemeService.getSchemeMetadata()
      .then(res => {
        setMetadata(res.data || { sourceTypes: [], eligibilityTags: [], states: [], categories: [] });
      })
      .catch(() => {
        setMetadata({ sourceTypes: [], eligibilityTags: [], states: [], categories: [] });
      })
      .finally(() => {
        setMetadataLoading(false);
        setTimeout(() => { titleInputRef.current?.focus?.(); }, 50);
      });

    if (mode === 'edit' && initialData) {
      setForm({
        title: initialData.title || '',
        category: initialData.category || '',
        description: initialData.description || '',
        sourceType: initialData.sourceType || 'Central Govt',
        state: initialData.sourceType === 'State Govt' ? (initialData.state || '') : '',
        officialUrl: initialData.officialURL || initialData.officialUrl || '',
        imageUrl: initialData.imageUrl || '',
        status: initialData.status || 'Active',
        endDate: toDateInputValue(initialData.endDate),
        eligibility: initialData.eligibility || '',
        benefits: initialData.benefits || '',
        documentsRequired: Array.isArray(initialData.documentsRequired) ? [...initialData.documentsRequired] : [],
        eligibilityTags: Array.isArray(initialData.eligibilityTags) ? [...initialData.eligibilityTags] : []
      });
      setEditingId(initialData._id || null);
    } else {
      setForm({
        title: '',
        category: '',
        description: '',
        sourceType: 'Central Govt',
        state: '',
        officialUrl: '',
        imageUrl: '',
        status: 'Active',
        endDate: '',
        eligibility: '',
        benefits: '',
        documentsRequired: [],
        eligibilityTags: []
      });
      setEditingId(null);
    }
    setError(null);
    setUrlError(null);
    setImageUrlError(null);
    setImagePreviewError(false);
    setDocDraft('');
  }, [isOpen, initialId, mode]);

  useEffect(() => {
    setImagePreviewError(false);
  }, [form.imageUrl]);

  if (!isOpen) return null;

  const isEditing = mode === 'edit' && !!editingId;
  const isStateGovt = form.sourceType === 'State Govt';
  const trimmedOfficial = (form.officialUrl || '').trim();
  const isOfficialValid = trimmedOfficial && URL_REGEX.test(trimmedOfficial);
  const trimmedImage = (form.imageUrl || '').trim();
  const isImageValid = trimmedImage && URL_REGEX.test(trimmedImage) && !imagePreviewError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.title?.trim() || !form.category?.trim() || !form.description?.trim() || !form.eligibility?.trim() || !form.benefits?.trim()) {
      setError('All required fields (Title, Category, Description, Eligibility, Benefits) are required');
      return;
    }
    if (form.title.trim().length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    if (form.description.trim().length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }
    if (form.eligibility.trim().length < 5) {
      setError('Eligibility must be at least 5 characters');
      return;
    }
    if (form.benefits.trim().length < 5) {
      setError('Benefits must be at least 5 characters');
      return;
    }
    if (form.sourceType === 'State Govt' && !form.state) {
      setError('Please select a State for State Government schemes');
      return;
    }

    let cleanUrl = (form.officialUrl || '').trim();
    if (cleanUrl && !URL_REGEX.test(cleanUrl)) {
      setError('Official URL must be a valid URL starting with http:// or https://');
      setUrlError('Invalid URL format');
      return;
    }
    let cleanImageUrl = (form.imageUrl || '').trim();
    if (cleanImageUrl && !URL_REGEX.test(cleanImageUrl)) {
      setError('Image URL must be a valid URL starting with http:// or https://');
      setImageUrlError('Invalid URL format');
      return;
    }

    const cleanDocs = Array.isArray(form.documentsRequired) ? [...new Set(form.documentsRequired.map(s => s.trim()).filter(Boolean))].slice(0, 30) : [];
    const cleanTags = Array.isArray(form.eligibilityTags) ? [...new Set(form.eligibilityTags)].filter(Boolean) : [];

    let cleanEndDate = '';
    if (form.endDate) {
      const parsed = new Date(form.endDate);
      if (isNaN(parsed.getTime())) {
        setError('End date must be a valid date');
        return;
      }
      cleanEndDate = form.endDate;
    }

    const payload = {
      title: form.title.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      sourceType: form.sourceType || 'Central Govt',
      state: form.sourceType === 'State Govt' ? (form.state || '') : '',
      officialURL: cleanUrl,
      imageUrl: cleanImageUrl,
      status: form.status || 'Active',
      endDate: cleanEndDate,
      eligibility: form.eligibility.trim(),
      benefits: form.benefits.trim(),
      eligibilityTags: cleanTags,
      documentsRequired: cleanDocs
    };

    try {
      const url = isEditing ? `/schemes/${editingId}` : '/schemes';
      const response = await authFetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      if (typeof onSubmit === 'function') {
        try { await onSubmit(payload, response); } catch (_) {}
      }
      setForm({
        title: '', category: '', description: '', sourceType: 'Central Govt', state: '',
        officialUrl: '', imageUrl: '', status: 'Active', endDate: '', eligibility: '', benefits: '',
        documentsRequired: [], eligibilityTags: []
      });
      setDocDraft('');
      setEditingId(null);
      setUrlError(null);
      setImageUrlError(null);
      setImagePreviewError(false);
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Request failed');
    }
  };

  const toggleEligibilityTag = (tag) => {
    setForm(prev => ({
      ...prev,
      eligibilityTags: Array.isArray(prev.eligibilityTags) && prev.eligibilityTags.includes(tag)
        ? prev.eligibilityTags.filter(t => t !== tag)
        : [...(Array.isArray(prev.eligibilityTags) ? prev.eligibilityTags : []), tag]
    }));
  };

  const handleAddDoc = () => {
    const val = docDraft.trim();
    if (!val) return;
    if (form.documentsRequired.includes(val)) {
      setDocDraft('');
      return;
    }
    if (form.documentsRequired.length >= 30) {
      setError('Maximum 30 documents allowed');
      return;
    }
    setForm(prev => ({ ...prev, documentsRequired: [...prev.documentsRequired, val] }));
    setDocDraft('');
  };

  const handleRemoveDoc = (doc) => {
    setForm(prev => ({ ...prev, documentsRequired: prev.documentsRequired.filter(d => d !== doc) }));
  };

  const handleDocKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddDoc();
    }
  };

  const charColor = (len, max) => {
    if (len === 0) return '#94a3b8';
    if (len > max) return '#dc2626';
    if (len > max * 0.9) return '#d97706';
    return '#64748b';
  };

  // Live preview derived
  const previewTitle = form.title.trim() || 'Scheme title will appear here';
  const previewCategory = form.category.trim() || 'Category';
  const previewDesc = form.description.trim() || 'Description preview will appear here. Start typing in the form to see live updates.';
  const isPreviewState = form.sourceType === 'State Govt';

  return (
    <div className="modal-overlay scheme-modal-overlay" onClick={onClose}>
      <div className="modal-container modal-large scheme-modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">{mode === 'edit' ? 'Edit Scheme' : 'Add New Scheme'}</h3>
            <p className="modal-subtitle">All fields marked with <span className="required-mark">*</span> are required</p>
          </div>
          <button className="modal-close" onClick={onClose} disabled={loading} aria-label="Close">×</button>
        </div>

        <div className="scheme-modal-layout">
          {/* --- Form --- */}
          <form onSubmit={handleSubmit} className="scheme-modal-form">
            {error && <div className="form-error">{error}</div>}

            {/* Basic Information */}
            <div className="form-section">
              <div className="form-section-title"><span className="form-section-icon">①</span> Basic Information</div>
              <div className="form-grid">
                <div className="form-group form-grid-2">
                  <label className="form-label">Scheme Title <span className="required-mark">*</span></label>
                  <input ref={titleInputRef} type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="form-input" placeholder="e.g., Pradhan Mantri Awas Yojana" disabled={loading || metadataLoading} autoComplete="off" maxLength={200} />
                  <span className="char-counter" style={{ color: charColor(form.title.length, 200) }}>{form.title.length} / 200</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Category <span className="required-mark">*</span></label>
                  <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="form-input" list="category-suggestions" placeholder="e.g., Housing, Education" disabled={loading || metadataLoading} autoComplete="off" />
                  <datalist id="category-suggestions">
                    {(metadata.categories || []).map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Source Type <span className="required-mark">*</span></label>
                  <select value={form.sourceType || 'Central Govt'} onChange={(e) => setForm({ ...form, sourceType: e.target.value, state: e.target.value === 'State Govt' ? form.state : '' })} className="form-select" disabled={loading || metadataLoading}>
                    {(metadata.sourceTypes && metadata.sourceTypes.length > 0 ? metadata.sourceTypes : ['Central Govt', 'State Govt']).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">State {isStateGovt && <span className="required-mark">*</span>}</label>
                  <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="form-select" disabled={loading || metadataLoading || !isStateGovt}>
                    <option value="">{isStateGovt ? 'Select State...' : 'Only for State Govt'}</option>
                    {(metadata.states || []).map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Links & Media */}
            <div className="form-section">
              <div className="form-section-title"><span className="form-section-icon">②</span> Links & Media</div>
              <div className="form-group">
                <label className="form-label">Official Website URL</label>
                <input type="url" value={form.officialUrl} onChange={(e) => { const v = e.target.value; setForm({ ...form, officialUrl: v }); setUrlError(v && v.trim() && !URL_REGEX.test(v.trim()) ? 'URL must start with http:// or https://' : null); }} className={`form-input ${urlError ? 'form-input-error' : ''}`} placeholder="https://www.example.gov.in/scheme" disabled={loading || metadataLoading} />
                {urlError && <span className="form-field-error">{urlError}</span>}
                {!urlError && trimmedOfficial && isOfficialValid && (
                  <a href={trimmedOfficial} target="_blank" rel="noreferrer" className="url-preview-link">↗ Open Website — {trimmedOfficial}</a>
                )}
                {!urlError && !isOfficialValid && <span className="form-help-text">Must start with http:// or https://</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Scheme Image URL</label>
                <input type="url" value={form.imageUrl} onChange={(e) => { const v = e.target.value; setForm({ ...form, imageUrl: v }); setImageUrlError(v && v.trim() && !URL_REGEX.test(v.trim()) ? 'URL must start with http:// or https://' : null); setImagePreviewError(false); }} className={`form-input ${imageUrlError ? 'form-input-error' : ''}`} placeholder="https://example.com/image.jpg" disabled={loading || metadataLoading} />
                {imageUrlError && <span className="form-field-error">{imageUrlError}</span>}
                <span className="form-help-text">Shows in admin table and user card. Leave empty for placeholder.</span>
                {/* Live Image Preview */}
                <div className="image-preview-box">
                  {trimmedImage && isImageValid && !imagePreviewError ? (
                    <img src={trimmedImage} alt="Preview" className="image-preview-img" onError={() => setImagePreviewError(true)} />
                  ) : (
                    <div className="image-preview-fallback">
                      <span style={{ fontSize: '1.4rem' }}>🖼️</span>
                      <span>{!trimmedImage ? 'No image — placeholder will be used' : imagePreviewError ? 'Failed to load image — check URL' : 'Enter a valid image URL to preview'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scheme Details */}
            <div className="form-section">
              <div className="form-section-title"><span className="form-section-icon">③</span> Scheme Details</div>
              <div className="form-group">
                <label className="form-label">Description <span className="required-mark">*</span></label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="form-textarea" placeholder="Brief description of the scheme..." rows="3" disabled={loading || metadataLoading} maxLength={4000} />
                <span className="char-counter" style={{ color: charColor(form.description.length, 4000) }}>{form.description.length} / 4000 · min 10</span>
              </div>
              <div className="form-group">
                <label className="form-label">Key Benefits <span className="required-mark">*</span></label>
                <textarea value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} className="form-textarea" placeholder="What are the key benefits offered?" rows="3" disabled={loading || metadataLoading} maxLength={4000} />
                <span className="char-counter" style={{ color: charColor(form.benefits.length, 4000) }}>{form.benefits.length} / 4000 · min 5</span>
              </div>
            </div>

            {/* Classification */}
            <div className="form-section">
              <div className="form-section-title"><span className="form-section-icon">④</span> Classification</div>
              <div className="form-group">
                <label className="form-label">Eligibility Tags</label>
                <div className="multi-select-tags-container">
                  {(metadata.eligibilityTags || []).map(tag => {
                    const selected = Array.isArray(form.eligibilityTags) && form.eligibilityTags.includes(tag);
                    return (
                      <button key={tag} type="button" onClick={() => toggleEligibilityTag(tag)} disabled={loading || metadataLoading} className={`tag-checkbox ${selected ? 'tag-selected' : ''}`} aria-pressed={selected}>
                        {selected ? '✓ ' : ''}{tag}
                      </button>
                    );
                  })}
                </div>
                <span className="form-help-text">{Array.isArray(form.eligibilityTags) && form.eligibilityTags.length > 0 ? `${form.eligibilityTags.length} tag${form.eligibilityTags.length > 1 ? 's' : ''} selected — highlighted in blue` : 'Select all that apply. Selected tags are highlighted.'}</span>
              </div>
            </div>

            {/* Eligibility */}
            <div className="form-section">
              <div className="form-section-title"><span className="form-section-icon">⑤</span> Eligibility</div>
              <div className="form-group">
                <label className="form-label">Eligibility Criteria <span className="required-mark">*</span></label>
                <textarea value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} className="form-textarea" placeholder="Who can apply? List the eligibility criteria..." rows="3" disabled={loading || metadataLoading} maxLength={2000} />
                <span className="char-counter" style={{ color: charColor(form.eligibility.length, 2000) }}>{form.eligibility.length} / 2000 · min 5</span>
              </div>
            </div>

            {/* Required Documents */}
            <div className="form-section">
              <div className="form-section-title"><span className="form-section-icon">⑥</span> Required Documents</div>
              <div className="form-group">
                <label className="form-label">Documents Required</label>
                <div className="doc-input-row">
                  <input type="text" value={docDraft} onChange={(e) => setDocDraft(e.target.value)} onKeyDown={handleDocKeyDown} className="form-input" placeholder="Type document name and press Enter or Add" disabled={loading || metadataLoading} maxLength={200} />
                  <button type="button" className="btn-secondary" onClick={handleAddDoc} disabled={loading || metadataLoading || !docDraft.trim() || form.documentsRequired.length >= 30}>Add</button>
                </div>
                <span className="form-help-text">Press Enter to add. Max 30 documents. Click × to remove.</span>
                {Array.isArray(form.documentsRequired) && form.documentsRequired.length > 0 ? (
                  <div className="docs-chip-list">
                    {form.documentsRequired.map((d) => (
                      <span key={d} className="doc-chip-removable">
                        {d}
                        <button type="button" className="doc-chip-remove" onClick={() => handleRemoveDoc(d)} aria-label={`Remove ${d}`}>×</button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="docs-empty">No documents added yet. Added documents appear as chips here.</div>
                )}
                <span className="char-counter">{form.documentsRequired.length} / 30 documents</span>
              </div>
            </div>

            {/* Status */}
            <div className="form-section" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
              <div className="form-section-title"><span className="form-section-icon">⑦</span> Status & Validity</div>
              <div className="form-group">
                <label className="form-label" htmlFor="scheme-end-date">Application End Date (optional)</label>
                <input
                  id="scheme-end-date"
                  type="date"
                  className="form-input"
                  value={form.endDate || ''}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  disabled={loading || metadataLoading}
                  aria-describedby="scheme-end-date-help"
                />
                <span className="form-help-text" id="scheme-end-date-help">After this date the scheme shows as expired and stops accepting applications. Leave empty for no end date.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Scheme Status</label>
                <div className="status-segmented" role="radiogroup" aria-label="Scheme status">
                  {[
                    { value: 'Active', label: 'Active', desc: 'Visible to users' },
                    { value: 'Draft', label: 'Draft', desc: 'Hidden, in progress' },
                    { value: 'Inactive', label: 'Inactive', desc: 'Hidden, archived' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={form.status === opt.value}
                      className={`status-option ${form.status === opt.value ? `active status-${opt.value.toLowerCase()}` : ''}`}
                      onClick={() => setForm({ ...form, status: opt.value })}
                      disabled={loading || metadataLoading}
                    >
                      <span className="status-option-label">{opt.label}</span>
                      <span className="status-option-desc">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading || !!urlError || !!imageUrlError}>
                {loading ? <><span className="loading-spinner"></span>{mode === 'edit' ? 'Updating...' : 'Adding...'}</> : (mode === 'edit' ? 'Update Scheme' : 'Add Scheme')}
              </button>
            </div>
          </form>

          {/* Live Preview */}
          <div className="scheme-preview-panel" aria-label="Live preview">
            <div className="preview-header">
              <div className="preview-label">Live Preview</div>
              <div className="preview-sub">How users will see this scheme</div>
            </div>

            <div className="preview-card">
              <div className="preview-image-wrap">
                {trimmedImage && isImageValid && !imagePreviewError ? (
                  <img src={trimmedImage} alt="Preview" className="preview-image" onError={() => setImagePreviewError(true)} />
                ) : (
                  <div className="preview-image-fallback">
                    <span style={{ fontSize: '1.6rem' }}>{trimmedImage && imagePreviewError ? '⚠️' : '🖼️'}</span>
                    <span>{!trimmedImage ? 'No image' : imagePreviewError ? 'Image failed' : 'Preview'}</span>
                  </div>
                )}
                <span className={`preview-status status-badge ${form.status === 'Active' ? 'status-active' : form.status === 'Inactive' ? 'status-inactive' : 'status-draft'}`}>{form.status}</span>
              </div>
              <div className="preview-body">
                <div className="preview-title" title={previewTitle}>{previewTitle}</div>
                <div className="preview-meta">
                  <span className="category-badge">{previewCategory}</span>
                  <span className={`source-badge ${isPreviewState ? 'source-state' : 'source-central'}`}>{isPreviewState ? `State${form.state ? ` · ${form.state}` : ''}` : 'Central'}</span>
                </div>
                <p className="preview-desc">{previewDesc.slice(0, 140)}{previewDesc.length > 140 ? '...' : ''}</p>
                {Array.isArray(form.eligibilityTags) && form.eligibilityTags.length > 0 && (
                  <div className="preview-tags">
                    {form.eligibilityTags.slice(0, 3).map(t => <span key={t} className="eligibility-tag" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>{t}</span>)}
                    {form.eligibilityTags.length > 3 && <span className="eligibility-tag eligibility-tag-more">+{form.eligibilityTags.length - 3}</span>}
                  </div>
                )}
                <div className="preview-docs">
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{form.documentsRequired.length} document{form.documentsRequired.length !== 1 ? 's' : ''}</span>
                  {form.documentsRequired.length > 0 && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>· {form.documentsRequired.slice(0, 2).join(', ')}{form.documentsRequired.length > 2 ? ' +' + (form.documentsRequired.length - 2) : ''}</span>}
                </div>
              </div>
              <div className="preview-footer">
                <span className="preview-btn-primary">View Details</span>
                <span className="preview-btn-secondary">Bookmark</span>
              </div>
            </div>

            <div className="preview-details">
              <div className="preview-details-title">Quick checks</div>
              <ul className="preview-checklist">
                <li className={form.title.trim().length >= 3 ? 'ok' : 'warn'}>Title {form.title.trim().length >= 3 ? '✓' : '·'} {form.title.length}/200</li>
                <li className={form.description.trim().length >= 10 ? 'ok' : 'warn'}>Description {form.description.length}/4000</li>
                <li className={form.eligibility.trim().length >= 5 ? 'ok' : 'warn'}>Eligibility {form.eligibility.length}/2000</li>
                <li className={form.benefits.trim().length >= 5 ? 'ok' : 'warn'}>Benefits {form.benefits.length}/4000</li>
                <li className={isOfficialValid || !trimmedOfficial ? 'ok' : 'warn'}>Official URL {isOfficialValid ? '✓ valid' : trimmedOfficial ? '✗ invalid' : '— empty'}</li>
                <li className={isImageValid || !trimmedImage ? 'ok' : 'warn'}>Image URL {isImageValid ? '✓ valid' : trimmedImage ? '✗ invalid' : '— placeholder'}</li>
                <li className={isStateGovt ? (form.state ? 'ok' : 'warn') : 'ok'}>State {isStateGovt ? (form.state ? `✓ ${form.state}` : '✗ required') : '— Central'}</li>
              </ul>
            </div>

            {isOfficialValid && (
              <a href={trimmedOfficial} target="_blank" rel="noreferrer" className="preview-link">↗ Preview Official Website</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemeModal;
