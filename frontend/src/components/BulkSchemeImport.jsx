import { useState, useEffect, useRef, useMemo } from 'react';

const BulkSchemeImport = ({ isOpen, onClose, onImport }) => {
  const [fileName, setFileName] = useState('');
  const [parsedSchemes, setParsedSchemes] = useState(null);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const fileInputRef = useRef(null);

  const resetState = () => {
    setFileName('');
    setParsedSchemes(null);
    setError(null);
    setPage(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const handleClose = () => {
    resetState();
    if (onClose) onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Only .json files are accepted. Please select a valid JSON file.');
      setParsedSchemes(null);
      setFileName(file.name);
      return;
    }

    setFileName(file.name);
    setError(null);
    setParsedSchemes(null);
    setPage(1);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        let json;
        try {
          json = JSON.parse(text);
        } catch (parseErr) {
          throw new Error(`Invalid JSON: ${parseErr.message}`);
        }

        if (!Array.isArray(json)) {
          throw new Error('JSON root must be an array of schemes.');
        }

        if (json.length === 0) {
          throw new Error('JSON array is empty. Add at least one scheme.');
        }

        setParsedSchemes(json);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to parse JSON file.');
        setParsedSchemes(null);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
      setParsedSchemes(null);
    };

    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!parsedSchemes || parsedSchemes.length === 0) return;
    if (onImport) onImport(parsedSchemes);
  };

  const categorySummary = useMemo(() => {
    if (!parsedSchemes) return {};
    const map = {};
    parsedSchemes.forEach((s) => {
      const cat = (s.category || 'Uncategorized').trim() || 'Uncategorized';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [parsedSchemes]);

  const totalPages = parsedSchemes ? Math.ceil(parsedSchemes.length / perPage) : 1;
  const paginatedSchemes = useMemo(() => {
    if (!parsedSchemes) return [];
    const start = (page - 1) * perPage;
    return parsedSchemes.slice(start, start + perPage);
  }, [parsedSchemes, page]);

  if (!isOpen) return null;

  const hasValidData = Array.isArray(parsedSchemes) && parsedSchemes.length > 0 && !error;

  return (
    <div className="modal-overlay" onClick={handleClose} style={{ zIndex: 1000 }}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '860px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h3 className="modal-title">Import Government Schemes</h3>
            <p className="modal-subtitle" style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
              Select a JSON file containing an array of schemes
            </p>
          </div>
          <button className="modal-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {/* File Selector */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="bulk-json-file">
              JSON File <span className="required-mark">*</span>
            </label>
            <div
              style={{
                border: '1.5px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '18px',
                background: '#f8fafc',
                textAlign: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <input
                id="bulk-json-file"
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                style={{
                  display: 'block',
                  width: '100%',
                  fontSize: '0.88rem',
                  color: '#334155'
                }}
              />
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '8px' }}>
                Accepts only <strong>.json</strong> files. File is parsed locally; nothing is uploaded yet.
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="form-error" role="alert" style={{ marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {/* Success Summary */}
          {hasValidData && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  marginBottom: '16px'
                }}
              >
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '14px'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                    File Name
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>{fileName}</div>
                </div>
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #dbeafe',
                    borderRadius: '12px',
                    padding: '14px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2563eb', marginBottom: '6px' }}>
                    Total Schemes
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1d4ed8', lineHeight: 1 }}>{parsedSchemes.length}</div>
                </div>
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #dcfce7',
                    borderRadius: '12px',
                    padding: '14px'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#15803d', marginBottom: '6px' }}>
                    Categories
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d', lineHeight: 1 }}>{Object.keys(categorySummary).length}</div>
                </div>
              </div>

              {/* Category Summary */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Category Summary
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {Object.entries(categorySummary).map(([cat, count]) => (
                    <span
                      key={cat}
                      className="category-badge"
                      style={{ background: '#f1f5f9', borderColor: '#e2e8f0', color: '#334155' }}
                    >
                      {cat} <strong style={{ marginLeft: '6px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '999px', padding: '1px 6px', fontSize: '0.7rem' }}>{count}</strong>
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Preview {parsedSchemes.length > perPage ? `— Page ${page} of ${totalPages}` : ''}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Showing {paginatedSchemes.length} of {parsedSchemes.length} schemes
                  </div>
                </div>

                <div className="admin-table-scroll" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', maxHeight: '360px', overflowY: 'auto' }}>
                  <div className="admin-table" style={{ minWidth: '640px' }}>
                    <div
                      className="admin-table-head"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.6fr 0.9fr 0.8fr 0.8fr 0.7fr',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1
                      }}
                    >
                      <div>Scheme Title</div>
                      <div>Category</div>
                      <div>Source Type</div>
                      <div>State</div>
                      <div>Status</div>
                    </div>
                    <div className="admin-table-body">
                      {paginatedSchemes.map((s, idx) => {
                        const globalIdx = (page - 1) * perPage + idx;
                        return (
                          <div
                            key={`${s.title}-${globalIdx}`}
                            className="admin-table-row"
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1.6fr 0.9fr 0.8fr 0.8fr 0.7fr',
                              background: globalIdx % 2 === 0 ? '#ffffff' : '#f8fafc'
                            }}
                          >
                            <div className="admin-table-cell" style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.title}>
                              {s.title || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Untitled</span>}
                            </div>
                            <div className="admin-table-cell">
                              <span className="category-badge">{s.category || '—'}</span>
                            </div>
                            <div className="admin-table-cell">
                              {String(s.sourceType).toLowerCase().includes('state') ? (
                                <span className="source-badge source-state">State Govt</span>
                              ) : (
                                <span className="source-badge source-central">Central Govt</span>
                              )}
                            </div>
                            <div className="admin-table-cell" style={{ fontSize: '0.84rem' }}>{s.state ? s.state : <span style={{ color: '#94a3b8' }}>—</span>}</div>
                            <div className="admin-table-cell">
                              <span className={`status-badge ${s.status === 'Inactive' ? 'status-inactive' : s.status === 'Draft' ? 'status-draft' : 'status-active'}`}>
                                {s.status || 'Active'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                    >
                      ← Previous
                    </button>
                    <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                      Page <strong style={{ color: '#0f172a' }}>{page}</strong> of <strong style={{ color: '#0f172a' }}>{totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {!hasValidData && !error && (
            <div
              style={{
                border: '1px dashed #e2e8f0',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                color: '#64748b',
                background: '#fbfdff',
                marginTop: '8px'
              }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: '8px' }}>📄</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>No file loaded</div>
              <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>Select a valid JSON file to see preview and import options.</div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ flexShrink: 0, background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <button type="button" className="btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleImport}
            disabled={!hasValidData}
            title={!hasValidData ? 'Load a valid JSON file with at least one scheme first' : `Import ${parsedSchemes?.length || 0} schemes`}
            style={{ opacity: !hasValidData ? 0.5 : 1, cursor: !hasValidData ? 'not-allowed' : 'pointer' }}
          >
            Import Schemes {hasValidData ? `(${parsedSchemes.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkSchemeImport;
