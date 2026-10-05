import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EventCard from '../components/EventCard';
import { SkeletonSchemesGrid } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import * as eventService from '../services/eventService';
import { getSchemeMetadata } from '../services/schemeService';

const Events = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState(() => searchParams.get('sortBy') || 'eventDate');
  const [sortOrder, setSortOrder] = useState(() => searchParams.get('sortOrder') || 'asc');
  const [page, setPage] = useState(() => Math.max(1, parseInt(searchParams.get('page'), 10) || 1));
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [categories, setCategories] = useState([]);
  const [sourceTypeFilter, setSourceTypeFilter] = useState(() => searchParams.get('sourceType') || '');
  const [eventFormatFilter, setEventFormatFilter] = useState(() => searchParams.get('eventFormat') || '');
  const [stateFilter, setStateFilter] = useState(() => searchParams.get('state') || '');
  const [districtFilter, setDistrictFilter] = useState(() => searchParams.get('district') || '');
  const [departmentFilter, setDepartmentFilter] = useState(() => searchParams.get('department') || '');

  const fetchEvents = useCallback(async (targetPage) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: targetPage, limit: 9, search: search.trim(), category: categoryFilter,
        sortBy, sortOrder,
        sourceType: sourceTypeFilter, eventFormat: eventFormatFilter,
        state: stateFilter, district: districtFilter, department: departmentFilter
      };
      const res = await eventService.getEvents(params);
      setEvents(res.data || []);
      setPagination(res.pagination || { total: 0, pages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, sortBy, sortOrder, sourceTypeFilter, eventFormatFilter, stateFilter, districtFilter, departmentFilter]);

  useEffect(() => {
    getSchemeMetadata().then(r => setCategories(r.data?.categories || [])).catch(()=>{});
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set('search', search.trim());
    if (categoryFilter) next.set('category', categoryFilter);
    if (sortBy !== 'eventDate') next.set('sortBy', sortBy);
    if (sortOrder !== 'asc') next.set('sortOrder', sortOrder);
    if (sourceTypeFilter) next.set('sourceType', sourceTypeFilter);
    if (eventFormatFilter) next.set('eventFormat', eventFormatFilter);
    if (stateFilter) next.set('state', stateFilter);
    if (districtFilter) next.set('district', districtFilter);
    if (departmentFilter) next.set('department', departmentFilter);
    if (page > 1) next.set('page', String(page));
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [search, categoryFilter, sortBy, sortOrder, sourceTypeFilter, eventFormatFilter, stateFilter, districtFilter, departmentFilter, page, searchParams, setSearchParams]);

  useEffect(() => {
    const t = setTimeout(() => fetchEvents(page), 300);
    return () => clearTimeout(t);
  }, [page, fetchEvents]);

  useEffect(() => {
    if (page !== 1) setPage(1);
    else fetchEvents(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, sortBy, sortOrder, sourceTypeFilter, eventFormatFilter, stateFilter, districtFilter, departmentFilter]);

  const hasFilters = search || categoryFilter || sortBy !== 'eventDate' || sortOrder !== 'asc'
    || sourceTypeFilter || eventFormatFilter || stateFilter || districtFilter || departmentFilter;

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setSortBy('eventDate');
    setSortOrder('asc');
    setSourceTypeFilter('');
    setEventFormatFilter('');
    setStateFilter('');
    setDistrictFilter('');
    setDepartmentFilter('');
    setPage(1);
  };

  return (
    <div className="page-wrapper page-home">
      <section className="pro-list-head" aria-labelledby="events-hero-title">
        <span className="pro-list-eyebrow">Approved public events</span>
        <h1 id="events-hero-title" className="pro-list-title">
          Government &amp; Public Events
        </h1>
        <p className="pro-list-sub">
          Discover upcoming government awareness programs, public services, workshops and community events.
        </p>
        <form
          className="pro-list-search"
          role="search"
          aria-label="Search government and public events"
          onSubmit={(e) => { e.preventDefault(); document.getElementById('events-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
        >
          <input
            type="search"
            placeholder="Search events by title, department, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search events by title, department, location"
          />
          <button type="submit" className="btn-primary">Search</button>
        </form>
        <div className="pro-list-actions">
          <a href="#events-list" className="btn-secondary" style={{ textDecoration: 'none' }}>Browse Events</a>
          <Link to="/schemes" className="btn-secondary" style={{ textDecoration: 'none' }}>Explore Schemes</Link>
        </div>
      </section>

      <div className="page-container">
        <section id="events-list" className="schemes-section" aria-labelledby="events-heading">
          <div className="schemes-toolbar schemes-toolbar--premium pro-filter-panel">
            <div className="filter-panel-header" style={{ marginBottom: '14px' }}>
              <h2 id="events-heading" className="filter-panel-title">Filter Events</h2>
              {hasFilters && <button type="button" className="filter-panel-clear" onClick={clearFilters}>Clear all</button>}
            </div>
            <div className="toolbar-top">
              <div>
                <label className="filter-label" htmlFor="events-search" style={{ display: 'block', marginBottom: '4px' }}>Search</label>
                <input id="events-search" type="text" className="form-input" placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search events" />
              </div>
              <div>
                <label className="filter-label" htmlFor="events-category" style={{ display: 'block', marginBottom: '4px' }}>Category</label>
                <select id="events-category" className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="filter-label" htmlFor="events-sort" style={{ display: 'block', marginBottom: '4px' }}>Sort</label>
                <select id="events-sort" className="form-select" value={`${sortBy}-${sortOrder}`} onChange={(e) => { const [by, order] = e.target.value.split('-'); setSortBy(by); setSortOrder(order); }}>
                  <option value="eventDate-asc">Date: Earliest first</option>
                  <option value="eventDate-desc">Date: Latest first</option>
                  <option value="createdAt-desc">Newest added</option>
                  <option value="title-asc">Title A–Z</option>
                </select>
              </div>
            </div>

            <div className="gov-filters" aria-label="Government event filters">
              <div className="gov-filters-head">
                <span aria-hidden="true">🏛️</span> Government Event Filters
                {hasFilters && (
                  <button type="button" onClick={clearFilters} className="gov-filters-clear">Clear all filters</button>
                )}
              </div>
              <div className="gov-filters-row">
                <div>
                  <label className="filter-label" htmlFor="events-source-type" style={{ display: 'block', marginBottom: '4px' }}>Source Type</label>
                  <select id="events-source-type" className={sourceTypeFilter ? 'form-select filter-active' : 'form-select'} value={sourceTypeFilter} onChange={(e) => setSourceTypeFilter(e.target.value)}>
                    <option value="">All</option>
                    <option value="Central">Central</option>
                    <option value="State">State</option>
                    <option value="Local">Local</option>
                  </select>
                </div>
                <div>
                  <label className="filter-label" htmlFor="events-format" style={{ display: 'block', marginBottom: '4px' }}>Event Format</label>
                  <select id="events-format" className={eventFormatFilter ? 'form-select filter-active' : 'form-select'} value={eventFormatFilter} onChange={(e) => setEventFormatFilter(e.target.value)}>
                    <option value="">All</option>
                    <option value="offline">Offline</option>
                    <option value="online">Online</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="filter-label" htmlFor="events-state" style={{ display: 'block', marginBottom: '4px' }}>State</label>
                  <input id="events-state" type="text" className={stateFilter ? 'form-input filter-active' : 'form-input'} placeholder="e.g. Karnataka" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} />
                </div>
                <div>
                  <label className="filter-label" htmlFor="events-district" style={{ display: 'block', marginBottom: '4px' }}>District</label>
                  <input id="events-district" type="text" className={districtFilter ? 'form-input filter-active' : 'form-input'} placeholder="e.g. Tumkur" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} />
                </div>
                <div>
                  <label className="filter-label" htmlFor="events-department" style={{ display: 'block', marginBottom: '4px' }}>Department</label>
                  <input id="events-department" type="text" className={departmentFilter ? 'form-input filter-active' : 'form-input'} placeholder="e.g. Agriculture" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="toolbar-results pro-results-bar">
              <div className="results-count" aria-live="polite">
                {loading ? 'Loading events...' : <>Showing <strong>{events.length}</strong> of <strong>{pagination.total}</strong> approved events{hasFilters && <> · <button type="button" className="pro-results-clear" onClick={clearFilters}>Clear filters</button></>}</>}
              </div>
              {pagination.total > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Page {page} of {pagination.pages}</span>}
            </div>
          </div>

          {loading && <SkeletonSchemesGrid count={6} />}
          {error && !loading && <ErrorState message={error} onRetry={() => fetchEvents(page)} />}
           {!loading && !error && events.length === 0 && (
            <EmptyState
              icon={hasFilters ? '🔍' : '🎉'}
              title="No public events found"
              description={hasFilters ? 'Try changing your search or filters.' : 'Approved events will appear here once organizers publish them.'}
              action={hasFilters ? (
                <button type="button" className="btn-primary" onClick={clearFilters}>Clear Filters</button>
              ) : (
                <Link to="/schemes" className="btn-secondary">Explore Schemes</Link>
              )}
            />
          )}
          {!loading && !error && events.length > 0 && (
            <>
              <div className="schemes-grid">
                {events.map(ev => <EventCard key={ev._id} event={ev} />)}
              </div>
              {pagination.pages > 1 && (
                <div className="pagination pro-pagination" role="navigation" aria-label="Pagination">
                  <button type="button" className="btn-secondary pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Go to previous page">← Previous</button>
                  <span className="pagination-info pro-pagination-info" aria-live="polite">Page <strong>{page}</strong> of <strong>{pagination.pages}</strong></span>
                  <button type="button" className="btn-secondary pagination-btn" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} aria-label="Go to next page">Next →</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Events;
