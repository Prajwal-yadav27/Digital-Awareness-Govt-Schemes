import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SchemeCard from '../components/SchemeCard';
import { SkeletonSchemesGrid } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useAuth } from '../context/AuthContext';
import * as schemeService from '../services/schemeService';

const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || '');
  const [sourceTypeFilter, setSourceTypeFilter] = useState(() => searchParams.get('sourceType') || '');
  const [stateFilter, setStateFilter] = useState(() => searchParams.get('state') || '');
  const [eligibilityFilter, setEligibilityFilter] = useState(() => (searchParams.get('eligibility') || '').split(',').filter(Boolean));
  const [sortBy, setSortBy] = useState(() => searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState(() => searchParams.get('sortOrder') || 'desc');
  const [page, setPage] = useState(() => Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1));
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [categories, setCategories] = useState([]);
  const [metadata, setMetadata] = useState({
    sourceTypes: [],
    eligibilityTags: [],
    states: []
  });
  const [showEligibilityDropdown, setShowEligibilityDropdown] = useState(false);

  const searchDebounceRef = useRef(null);
  const skipNextPageFetchRef = useRef(false);
  const pageRef = useRef(1);
  const skipFirstFiltersEffectRef = useRef(true);
  const skipFirstSearchEffectRef = useRef(true);
  const suppressNextSearchEffectRef = useRef(false);
  const listingRef = useRef(null);

  const { isAdmin } = useAuth();

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await schemeService.getSchemeMetadata();
      const metadataData = res.data || { sourceTypes: [], eligibilityTags: [], states: [], categories: [] };
      setMetadata(metadataData);
      setCategories(metadataData.categories || []);
    } catch {
      // Silent fail
    }
  }, []);

  const buildParams = useCallback((targetPage) => {
    const params = { page: targetPage, limit: 9, sortBy, sortOrder };
    if (search.trim()) params.search = search.trim();
    if (categoryFilter) params.category = categoryFilter;
    if (sourceTypeFilter) params.sourceType = sourceTypeFilter;
    if (stateFilter) params.state = stateFilter;
    if (eligibilityFilter.length > 0) params.eligibility = eligibilityFilter;
    return params;
  }, [search, categoryFilter, sourceTypeFilter, stateFilter, eligibilityFilter, sortBy, sortOrder]);

  const fetchSchemes = useCallback(async (targetPage) => {
    setLoading(true);
    setError(null);
    try {
      const response = await schemeService.getSchemes(buildParams(targetPage));
      setSchemes(response.data || []);
      setPagination(response.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load schemes');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (search.trim()) nextParams.set('search', search.trim());
    if (categoryFilter) nextParams.set('category', categoryFilter);
    if (sourceTypeFilter) nextParams.set('sourceType', sourceTypeFilter);
    if (stateFilter) nextParams.set('state', stateFilter);
    if (eligibilityFilter.length) nextParams.set('eligibility', eligibilityFilter.join(','));
    if (sortBy !== 'createdAt') nextParams.set('sortBy', sortBy);
    if (sortOrder !== 'desc') nextParams.set('sortOrder', sortOrder);
    if (page > 1) nextParams.set('page', String(page));

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [search, categoryFilter, sourceTypeFilter, stateFilter, eligibilityFilter, sortBy, sortOrder, page, searchParams, setSearchParams]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    if (skipNextPageFetchRef.current) {
      skipNextPageFetchRef.current = false;
      return;
    }
    fetchSchemes(page);
  }, [page, fetchSchemes]);

  useEffect(() => {
    if (skipFirstFiltersEffectRef.current) {
      skipFirstFiltersEffectRef.current = false;
      return;
    }
    const currentPage = pageRef.current;
    skipNextPageFetchRef.current = currentPage !== 1;
    if (currentPage !== 1) setPage(1);
    fetchSchemes(1);
  }, [categoryFilter, sourceTypeFilter, stateFilter, eligibilityFilter, sortBy, sortOrder, fetchSchemes]);

  useEffect(() => {
    if (skipFirstSearchEffectRef.current) {
      skipFirstSearchEffectRef.current = false;
      return;
    }
    if (suppressNextSearchEffectRef.current) {
      suppressNextSearchEffectRef.current = false;
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const currentPage = pageRef.current;
      skipNextPageFetchRef.current = currentPage !== 1;
      if (currentPage !== 1) setPage(1);
      fetchSchemes(1);
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search, fetchSchemes]);

  const resetFilters = () => {
    suppressNextSearchEffectRef.current = true;
    setSearch('');
    setCategoryFilter('');
    setSourceTypeFilter('');
    setStateFilter('');
    setEligibilityFilter([]);
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
    setShowEligibilityDropdown(false);
  };

  const toggleEligibilityTag = (tag) => {
    setEligibilityFilter(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
    setPage(1);
  };

  const handleBrowse = () => {
    listingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const hasActiveFilters = search || categoryFilter || sourceTypeFilter || stateFilter || eligibilityFilter.length > 0 || sortBy !== 'createdAt' || sortOrder !== 'desc';

  return (
    <div className="page-wrapper page-home">
      {/* --- PAGE HEADER --- */}
      <section className="pro-list-head" aria-labelledby="hero-title">
        <span className="pro-list-eyebrow">Central &amp; State government services</span>
        <h1 id="hero-title" className="pro-list-title">
          Government Schemes
        </h1>
        <p className="pro-list-sub">
          Discover government schemes and welfare programs. Search by name, department, or
          category — then refine by source, state, eligibility, and sort order.
        </p>

        <form
          className="pro-list-search"
          role="search"
          aria-label="Search government schemes"
          onSubmit={(e) => { e.preventDefault(); handleBrowse(); }}
        >
          <input
            type="search"
            placeholder="Search schemes by name, department, category..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            aria-label="Search schemes by name, department, category"
          />
          <button type="submit" className="btn-primary">Search</button>
        </form>
        <div className="pro-list-actions">
          <button type="button" className="btn-secondary" onClick={handleBrowse}>
            Browse schemes below
          </button>
          <Link to="/events" className="btn-secondary">
            View Public Events
          </Link>
        </div>
      </section>

      <div className="page-container">
        {/* --- FILTERS --- */}
        <section id="schemes" className="schemes-section" aria-labelledby="schemes-heading" ref={listingRef}>
          <div className="schemes-toolbar schemes-toolbar--premium pro-filter-panel">
            <div className="filter-panel-header">
              <h2 id="schemes-heading" className="filter-panel-title">Filter Schemes</h2>
              {hasActiveFilters && <button type="button" className="filter-panel-clear" onClick={resetFilters}>Clear all</button>}
            </div>

            <div className="filter-grid">
              <div className="filter-field">
                <label className="filter-label" htmlFor="category-filter">Category</label>
                <select id="category-filter" className="form-select" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
                  <option value="">All Categories</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="filter-field">
                <label className="filter-label" htmlFor="source-filter">Central / State</label>
                <select
                  id="source-filter"
                  className="form-select"
                  value={sourceTypeFilter}
                  onChange={(e) => { setSourceTypeFilter(e.target.value); if (e.target.value !== 'State Govt') setStateFilter(''); setPage(1); }}
                >
                  <option value="">All Sources</option>
                  {(metadata.sourceTypes || ['Central Govt', 'State Govt']).map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div className="filter-field">
                <label className="filter-label" htmlFor="state-filter">State</label>
                <select
                  id="state-filter"
                  className="form-select"
                  value={stateFilter}
                  onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
                  disabled={sourceTypeFilter && sourceTypeFilter !== 'State Govt'}
                >
                  <option value="">All States</option>
                  {(metadata.states || []).map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>

              <div className="filter-field">
                <label className="filter-label" htmlFor="sort-filter">Sort</label>
                <select
                  id="sort-filter"
                  className="form-select"
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [by, order] = e.target.value.split('-');
                    setSortBy(by);
                    setSortOrder(order);
                    setPage(1);
                  }}
                >
                  <option value="createdAt-desc">Newest first</option>
                  <option value="createdAt-asc">Oldest first</option>
                  <option value="title-asc">Title A–Z</option>
                  <option value="title-desc">Title Z–A</option>
                  <option value="category-asc">Category A–Z</option>
                </select>
              </div>
            </div>

            <div className="filter-eligibility">
              <label className="filter-label" htmlFor="eligibility-filter">Eligibility</label>
              <div className="multi-select-wrapper">
                <button
                  id="eligibility-filter"
                  type="button"
                  className="form-select multi-select-trigger"
                  onClick={() => setShowEligibilityDropdown(!showEligibilityDropdown)}
                  onBlur={() => setTimeout(() => setShowEligibilityDropdown(false), 150)}
                >
                  {eligibilityFilter.length === 0 ? 'All Eligibility' : `${eligibilityFilter.length} tag${eligibilityFilter.length > 1 ? 's' : ''} selected`}
                  <span className="dropdown-arrow">▾</span>
                </button>
                {showEligibilityDropdown && (
                  <div className="multi-select-dropdown" onMouseDown={(e) => e.preventDefault()}>
                    {(metadata.eligibilityTags || []).map(tag => (
                      <label key={tag} className="multi-select-option">
                        <input type="checkbox" checked={eligibilityFilter.includes(tag)} onChange={() => toggleEligibilityTag(tag)} />
                        <span>{tag}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="toolbar-results pro-results-bar">
              <div className="results-count" aria-live="polite">
                {loading ? 'Loading schemes...' : (
                  <>
                    Showing <strong>{schemes.length}</strong> of <strong>{pagination.total}</strong> schemes
                    {categoryFilter && <> in <strong>{categoryFilter}</strong></>}
                    {hasActiveFilters && <> · <button type="button" className="pro-results-clear" onClick={resetFilters}>Clear filters</button></>}
                  </>
                )}
              </div>
              {eligibilityFilter.length > 0 && (
                <div className="active-chips">
                  {eligibilityFilter.map(tag => (
                    <button key={tag} type="button" className="chip" onClick={() => toggleEligibilityTag(tag)} aria-label={`Remove ${tag} filter`}>
                      {tag} ×
                    </button>
                  ))}
                  <button type="button" className="chip chip-clear" onClick={() => setEligibilityFilter([])}>Clear Tags</button>
                </div>
              )}
            </div>
          </div>

          {loading && <SkeletonSchemesGrid count={6} />}

          {error && !loading && (
            <ErrorState message={error} onRetry={() => fetchSchemes(page)} />
          )}

          {!loading && !error && schemes.length === 0 && (
            <EmptyState
              icon="🔍"
              title="No schemes found"
              description={hasActiveFilters ? 'Try changing your search or filters to find relevant schemes.' : 'No schemes have been added yet. Check back soon!'}
              action={hasActiveFilters ? (
                <button type="button" className="btn-primary" onClick={resetFilters}>Clear Filters</button>
              ) : (
                <Link to="/about" className="btn-secondary">About Portal</Link>
              )}
            />
          )}

          {!loading && !error && schemes.length > 0 && (
            <>
              <div className="schemes-grid">
                {schemes.map(scheme => (
                  <SchemeCard key={scheme._id} scheme={scheme} isAdmin={isAdmin()} showBookmark={true} />
                ))}
              </div>

              {pagination.pages > 1 && (
                <div className="pagination pro-pagination" role="navigation" aria-label="Pagination">
                  <button className="btn-secondary pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Go to previous page">← Previous</button>
                  <span className="pagination-info pro-pagination-info" aria-live="polite">
                    Page <strong>{page}</strong> of <strong>{pagination.pages}</strong>
                    <span className="pagination-total">· {pagination.total} total</span>
                  </span>
                  <button className="btn-secondary pagination-btn" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} aria-label="Go to next page">Next →</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Home;
