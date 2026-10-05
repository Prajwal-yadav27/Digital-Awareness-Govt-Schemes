import { useState, useEffect, useCallback, useDeferredValue } from 'react';
import { Link } from 'react-router-dom';
import { coverPlaceholder } from '../utils/placeholder';
import '../styles/admin.css';
import '../styles/admin-premium.css';
import AdminLayout from '../components/AdminLayout';
import AdminSidebar from '../components/AdminSidebar';
import AdminTopbar from '../components/AdminTopbar';
import SchemeModal from '../components/SchemeModal';
import ConfirmModal from '../components/ConfirmModal';
import BulkSchemeImport from '../components/BulkSchemeImport';
import { SkeletonSchemesGrid, SkeletonStats } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useToast } from '../context/ToastContext';
import * as schemeService from '../services/schemeService';
import * as adminService from '../services/adminService';
import * as eventService from '../services/eventService';
import { authFetch } from '../services/api';
import Users from './Users';

const AdminDashboard = () => {
  const [active, setActive] = useState('overview');
  const [schemes, setSchemes] = useState([]);
  const [schemesTotal, setSchemesTotal] = useState(0);
  const [schemesPagination, setSchemesPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [schemePage, setSchemePage] = useState(1);
  const [schemeSearch, setSchemeSearch] = useState('');
  const [schemeCategoryFilter, setSchemeCategoryFilter] = useState('');
  const [schemeSourceFilter, setSchemeSourceFilter] = useState('');
  const [schemeStateFilter, setSchemeStateFilter] = useState('');
  const [eligibilityFilter, setEligibilityFilter] = useState([]);
  const [showEligibilityDropdown, setShowEligibilityDropdown] = useState(false);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageLimit, setPageLimit] = useState(10);
  const [schemeMetadata, setSchemeMetadata] = useState({ categories: [], sourceTypes: [], states: [], eligibilityTags: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);
  const [overview, setOverview] = useState({
    totalSchemes: 0,
    totalUsers: 0,
    centralSchemes: 0,
    stateSchemes: 0,
    totalBookmarks: 0,
    activeSchemes: 0,
    draftSchemes: 0,
    inactiveSchemes: 0,
    totalApplications: 0,
    schemesByCategory: [],
    mostApplied: [],
    mostBookmarked: [],
    recentSchemes: [],
    recentUpdated: [],
    creationTrend: []
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingScheme, setDeletingScheme] = useState(null);
  const [isViewSchemeOpen, setIsViewSchemeOpen] = useState(false);
  const [viewingScheme, setViewingScheme] = useState(null);
  const [isViewSchemeLoading, setIsViewSchemeLoading] = useState(false);
  const [viewSchemeError, setViewSchemeError] = useState(null);

  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showFailed, setShowFailed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Admin Event Management
  const [adminEvents, setAdminEvents] = useState([]);
  const [adminEventsLoading, setAdminEventsLoading] = useState(false);
  const [adminEventsError, setAdminEventsError] = useState(null);
  const [adminEventsPagination, setAdminEventsPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [pendingEventsCount, setPendingEventsCount] = useState(0);
  const [adminEventsPage, setAdminEventsPage] = useState(1);
  const [adminEventSearch, setAdminEventSearch] = useState('');
  const [adminEventCategory, setAdminEventCategory] = useState('');
  const [adminEventStatus, setAdminEventStatus] = useState('');
  const [adminEventSortBy, setAdminEventSortBy] = useState('eventDate');
  const [adminEventSortOrder, setAdminEventSortOrder] = useState('asc');
  const [adminEventView, setAdminEventView] = useState('schemes');
  const [adminEventActionId, setAdminEventActionId] = useState(null);
  const [adminEventDeleteTarget, setAdminEventDeleteTarget] = useState(null);
  const [isAdminEventDeleteOpen, setIsAdminEventDeleteOpen] = useState(false);
  // Event overview stats + filter metadata
  const [eventStats, setEventStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, draft: 0 });
  const [eventStatsLoading, setEventStatsLoading] = useState(true);
  const [eventMeta, setEventMeta] = useState({ categories: [], sourceTypes: [], departments: [], states: [] });
  const [adminEventSource, setAdminEventSource] = useState('');
  const [adminEventDepartment, setAdminEventDepartment] = useState('');
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [isApproveConfirmOpen, setIsApproveConfirmOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);

  const { addToast } = useToast();
  const deferredSchemeSearch = useDeferredValue(schemeSearch);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await adminService.getAdminOverview();
      const raw = res.data || {};
      const next = {
        totalSchemes: Number(raw.totalSchemes || 0) || 0,
        totalUsers: Number(raw.totalUsers || 0) || 0,
        centralSchemes: Number(raw.centralSchemes || 0) || 0,
        stateSchemes: Number(raw.stateSchemes || 0) || 0,
        totalBookmarks: Number(raw.totalBookmarks || 0) || 0,
        activeSchemes: Number(raw.activeSchemes || 0) || 0,
        draftSchemes: Number(raw.draftSchemes || 0) || 0,
        inactiveSchemes: Number(raw.inactiveSchemes || 0) || 0,
        totalApplications: Number(raw.totalApplications || 0) || 0,
        schemesByCategory: Array.isArray(raw.schemesByCategory) ? raw.schemesByCategory : [],
        mostApplied: Array.isArray(raw.mostApplied) ? raw.mostApplied : [],
        mostBookmarked: Array.isArray(raw.mostBookmarked) ? raw.mostBookmarked : [],
        recentSchemes: Array.isArray(raw.recentSchemes) ? raw.recentSchemes : [],
        recentUpdated: Array.isArray(raw.recentUpdated) ? raw.recentUpdated : [],
        creationTrend: Array.isArray(raw.creationTrend) ? raw.creationTrend : []
      };
      setOverview(next);
      setLastUpdated(new Date());
    } catch (err) {
      setOverviewError(err.message || 'Failed to load admin overview');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const handleRefreshOverview = useCallback(async () => {
    if (isRefreshing || overviewLoading) return;
    setIsRefreshing(true);
    try {
      await fetchOverview();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchOverview, isRefreshing, overviewLoading]);

  const getLastUpdatedText = () => {
    if (!lastUpdated) return '';
    const diffMs = Date.now() - lastUpdated.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Last updated just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Last updated ${diffMin} min ago`;
    const diffHrs = Math.floor(diffMin / 60);
    return `Last updated ${diffHrs} hr ago`;
  };

  const fetchAdminEvents = useCallback(async (targetPage) => {
    setAdminEventsLoading(true);
    setAdminEventsError(null);
    try {
      const params = {
        page: targetPage,
        limit: 10,
        search: adminEventSearch.trim(),
        category: adminEventCategory || undefined,
        status: adminEventStatus || undefined,
        sourceType: adminEventSource || undefined,
        department: adminEventDepartment || undefined,
        sortBy: adminEventSortBy,
        sortOrder: adminEventSortOrder
      };
      const response = await eventService.getAdminEvents(params);
      setAdminEvents(response.data || []);
      setAdminEventsPagination(response.pagination || { total: 0, pages: 1, page: targetPage });
    } catch (err) {
      setAdminEventsError(err.message || 'Failed to load events');
    } finally {
      setAdminEventsLoading(false);
    }
  }, [adminEventSearch, adminEventCategory, adminEventStatus, adminEventSource, adminEventDepartment, adminEventSortBy, adminEventSortOrder]);

  const fetchPendingEventsCount = useCallback(async () => {
    try {
      const res = await eventService.getAdminEvents({ status: 'Pending', limit: 1 });
      setPendingEventsCount((res.pagination && res.pagination.total) || 0);
    } catch (_) {
      setPendingEventsCount(0);
    }
  }, []);

  const fetchEventStats = useCallback(async () => {
    setEventStatsLoading(true);
    try {
      const res = await eventService.getAdminEventStats();
      const data = (res && res.data) || {};
      const next = {
        total: Number(data.total || 0) || 0,
        pending: Number(data.pending || 0) || 0,
        approved: Number(data.approved || 0) || 0,
        rejected: Number(data.rejected || 0) || 0,
        draft: Number(data.draft || 0) || 0
      };
      setEventStats(next);
      setPendingEventsCount(next.pending);
    } catch (_) {
      // Non-fatal: stats are supplementary
    } finally {
      setEventStatsLoading(false);
    }
  }, []);

  const fetchEventMeta = useCallback(async () => {
    try {
      const res = await eventService.getAdminEventMeta();
      setEventMeta((res && res.data) || { categories: [], sourceTypes: [], departments: [], states: [] });
    } catch (_) {
      // Non-fatal
    }
  }, []);

  const handleAdminEventStatus = async (eventId, newStatus) => {
    if (adminEventActionId) return;
    setAdminEventActionId(eventId);
    try {
      await eventService.updateEventStatus(eventId, newStatus);
      addToast(`Event ${newStatus.toLowerCase()} successfully`, 'success');
      fetchAdminEvents(adminEventsPage);
      fetchPendingEventsCount();
      fetchEventStats();
      fetchOverview();
    } catch (err) {
      addToast(err.message || `Failed to ${newStatus.toLowerCase()} event`, 'error');
    } finally {
      setAdminEventActionId(null);
    }
  };

  const handleRejectClick = (event) => {
    setRejectTarget(event);
    setIsRejectConfirmOpen(true);
  };

  const handleApproveClick = (event) => {
    setApproveTarget(event);
    setIsApproveConfirmOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!approveTarget) return;
    await handleAdminEventStatus(approveTarget._id, 'Approved');
    setIsApproveConfirmOpen(false);
    setApproveTarget(null);
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    await handleAdminEventStatus(rejectTarget._id, 'Rejected');
    setIsRejectConfirmOpen(false);
    setRejectTarget(null);
  };

  const handleAdminEventDelete = (event) => {
    setAdminEventDeleteTarget(event);
    setIsAdminEventDeleteOpen(true);
  };

  const handleConfirmAdminEventDelete = async () => {
    if (!adminEventDeleteTarget) return;
    setAdminEventActionId(adminEventDeleteTarget._id);
    try {
      await eventService.deleteEvent(adminEventDeleteTarget._id);
      addToast('Event deleted successfully', 'success');
      setIsAdminEventDeleteOpen(false);
      setAdminEventDeleteTarget(null);
      fetchAdminEvents(adminEventsPage);
      fetchOverview();
    } catch (err) {
      addToast(err.message || 'Failed to delete event', 'error');
    } finally {
      setAdminEventActionId(null);
    }
  };

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: schemePage,
        limit: pageLimit,
        search: deferredSchemeSearch.trim(),
        category: schemeCategoryFilter,
        sourceType: schemeSourceFilter || undefined,
        state: schemeStateFilter,
        eligibility: eligibilityFilter.length ? eligibilityFilter : undefined,
        sortBy,
        sortOrder
      };
      const response = await schemeService.getSchemes(params);
      setSchemes(response.data || []);
      setSchemesTotal(response.pagination?.total || 0);
      setSchemesPagination(response.pagination || { page: 1, pages: 1, total: 0 });
      if ((response.data || []).length === 0 && response.pagination?.total > 0 && schemePage > response.pagination.pages) {
        setSchemePage(response.pagination.pages);
      }
    } catch (err) {
      setError(err.message);
      addToast(err.message || 'Error loading schemes', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, deferredSchemeSearch, schemeCategoryFilter, schemePage, schemeSourceFilter, schemeStateFilter, eligibilityFilter, sortBy, sortOrder, pageLimit]);

  const fetchSchemeMetadata = useCallback(async () => {
    try {
      const response = await schemeService.getSchemeMetadata();
      setSchemeMetadata(response.data || { categories: [], sourceTypes: [], states: [], eligibilityTags: [] });
    } catch (err) {
      addToast(err.message || 'Unable to load scheme filters', 'warning');
    }
  }, [addToast]);

  useEffect(() => {
    fetchOverview();
    fetchSchemeMetadata();
    fetchEventStats();
    fetchEventMeta();
  }, [fetchOverview, fetchSchemeMetadata, fetchEventStats, fetchEventMeta]);

  useEffect(() => {
    fetchSchemes();
  }, [fetchSchemes]);

  useEffect(() => {
    if (adminEventView === 'events') {
      fetchAdminEvents(adminEventsPage);
      fetchPendingEventsCount();
    }
  }, [adminEventView, adminEventsPage, fetchAdminEvents, fetchPendingEventsCount]);

  const resetTableFilters = () => {
    setSchemeSearch('');
    setSchemeCategoryFilter('');
    setSchemeSourceFilter('');
    setSchemeStateFilter('');
    setEligibilityFilter([]);
    setSortBy('updatedAt');
    setSortOrder('desc');
    setPageLimit(10);
    setSchemePage(1);
  };

  const toggleEligibilityTag = (tag) => {
    setEligibilityFilter(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    setSchemePage(1);
  };

  const hasTableFilters = schemeSearch || schemeCategoryFilter || schemeSourceFilter || schemeStateFilter || eligibilityFilter.length > 0;

  const handleAddScheme = async (_payload, modalResponse) => {
    setIsAdding(true);
    try {
      const message = modalResponse?.message || 'Scheme added successfully!';
      addToast(message, 'success');
      setIsAddModalOpen(false);
      await Promise.all([fetchSchemes(), fetchOverview()]);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditScheme = async (scheme) => {
    try {
      const response = await schemeService.getSchemeById(scheme._id);
      setEditingScheme(response.data);
      setIsEditModalOpen(true);
    } catch (err) {
      addToast(err.message || 'Failed to load scheme details for editing', 'error');
    }
  };

  const handleUpdateScheme = async (_payload, modalResponse) => {
    setIsUpdating(true);
    try {
      const message = modalResponse?.message || 'Scheme updated successfully!';
      addToast(message, 'success');
      setEditingScheme(null);
      setIsEditModalOpen(false);
      await Promise.all([fetchSchemes(), fetchOverview()]);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteClick = (scheme) => {
    setDeletingScheme(scheme);
    setIsDeleteConfirmOpen(true);
  };

  const handleViewScheme = async (scheme) => {
    setIsViewSchemeOpen(true);
    setIsViewSchemeLoading(true);
    setViewSchemeError(null);
    setViewingScheme(scheme);
    try {
      const response = await schemeService.getSchemeById(scheme._id);
      if (response.data) setViewingScheme(response.data);
    } catch (err) {
      setViewSchemeError(err.message || 'Failed to load scheme details');
    } finally {
      setIsViewSchemeLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await schemeService.deleteScheme(deletingScheme._id);
      addToast(response.message || 'Scheme deleted successfully!', 'success');
      setDeletingScheme(null);
      setIsDeleteConfirmOpen(false);
      await Promise.all([fetchSchemes(), fetchOverview()]);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkImport = async (parsedSchemes) => {
    if (isBulkImporting) return;
    if (!Array.isArray(parsedSchemes) || parsedSchemes.length === 0) {
      addToast('No schemes to import', 'warning');
      return;
    }
    setIsBulkImporting(true);
    addToast('Importing schemes...', 'info');
    try {
      const response = await authFetch('/schemes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedSchemes),
      });

      const inserted = response?.data?.inserted ?? 0;
      const skippedDuplicates = response?.data?.skippedDuplicates ?? 0;
      const failed = response?.data?.failed ?? 0;

      addToast(`Import completed: ${inserted} inserted, ${skippedDuplicates} duplicate, ${failed} failed`, 'success');

      setImportResult(response?.data || null);
      setShowDuplicates(false);
      setShowFailed(false);
      setIsResultOpen(true);
      setIsBulkImportOpen(false);
      await Promise.all([fetchSchemes(), fetchOverview()]);
    } catch (err) {
      const message = err?.message || 'Failed to import schemes. Please try again.';
      addToast(message, 'error');
      console.error('Bulk import error:', err);
      // Keep modal open so parsed data is not lost
    } finally {
      setIsBulkImporting(false);
    }
  };

  const renderDocs = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) {
      return <span className="admin-muted">—</span>;
    }
    return (
      <div className="admin-chips">
        {arr.slice(0, 2).map((d, i) => (
          <span key={`${d}-${i}`} className="doc-chip">{d}</span>
        ))}
        {arr.length > 2 && <span className="doc-chip">+{arr.length - 2}</span>}
      </div>
    );
  };

  const renderTags = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) {
      return <span className="admin-muted">—</span>;
    }
    return (
      <div className="admin-chips">
        {arr.slice(0, 2).map((t, i) => (
          <span key={`${t}-${i}`} className="eligibility-tag" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>{t}</span>
        ))}
        {arr.length > 2 && <span className="eligibility-tag eligibility-tag-more" style={{ fontSize: '0.7rem' }}>+{arr.length - 2}</span>}
      </div>
    );
  };

  const statusBadge = (status) => {
    const s = status || 'Active';
    const tone = s === 'Active' || s === 'Approved'
      ? 'approved'
      : s === 'Pending'
        ? 'pending'
        : s === 'Rejected' || s === 'Inactive'
          ? 'rejected'
          : 'draft';
    const icon = tone === 'approved' ? '✓' : tone === 'pending' ? '⏳' : tone === 'rejected' ? '⛔' : '📝';
    return (
      <span className={`pro-status pro-status--${tone}`}>
        <span className="pro-status-icon" aria-hidden="true">{icon}</span>
        <span>{s}</span>
      </span>
    );
  };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <>
      <AdminLayout
        collapsed={sidebarCollapsed}
        sidebar={<AdminSidebar
          active={active}
          onChange={setActive}
          pendingEvents={pendingEventsCount}
          eventsActive={active === 'schemes' && adminEventView === 'events'}
          onSchemesClick={() => { setActive('schemes'); setAdminEventView('schemes'); }}
          onEventsClick={() => { setActive('schemes'); setAdminEventView('events'); setAdminEventsPage(1); fetchAdminEvents(1); fetchPendingEventsCount(); }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        />}
        topbar={
          <AdminTopbar
            title={active === 'overview' ? 'Admin Dashboard' : active === 'users' ? 'User Management' : adminEventView === 'events' ? 'Event Management' : 'Scheme Management'}
            subtitle={active === 'overview' ? 'Monitor schemes, users, applications and engagement.' : active === 'users' ? 'Manage registered accounts' : adminEventView === 'events' ? 'Manage government/public events, approvals and moderation.' : 'Add, edit, and maintain schemes'}
          actions={
            active === 'overview' ? (
              <div className="admin-toolbar-actions">
                {lastUpdated && <span className="admin-last-updated" aria-live="polite">{getLastUpdatedText()}</span>}
                <button className="btn-secondary" onClick={handleRefreshOverview} disabled={isRefreshing || overviewLoading} aria-label="Refresh dashboard">
                  {isRefreshing ? 'Refreshing...' : '↻ Refresh'}
                </button>
              </div>
            ) : active === 'schemes' ? (
              <div className="admin-toolbar-actions">
                <button className="btn-secondary" onClick={fetchSchemes} disabled={loading}>↻ Refresh</button>
                <button className="btn-secondary" onClick={() => setIsBulkImportOpen(true)}>Import Schemes</button>
                <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>+ Add Scheme</button>
              </div>
            ) : (
              <button className="btn-secondary" onClick={() => Promise.all([fetchOverview(), fetchSchemes()])}>↻ Refresh</button>
            )
          }
        />
      }
    >
      {active === 'overview' && (
        <>
          {overviewLoading ? (
            <SkeletonStats />
          ) : overviewError ? (
            <ErrorState message={overviewError} onRetry={fetchOverview} />
          ) : (
            <>
              <div className="admin-dashboard-header">
                <div>
                  <div className="admin-dashboard-title">Admin Dashboard</div>
                  <div className="admin-dashboard-subtitle">Manage government schemes, public events, citizens and platform activity.</div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span className="admin-status-badge"><span className="admin-status-dot"></span> System Operational</span>
                </div>
              </div>

              {/* Top 6 Stat Cards */}
              <div className="admin-overview-grid">
                <div className="admin-stat-card" onClick={() => setActive('schemes')} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Total schemes">
                  <div className="admin-stat-icon" aria-hidden="true">📋</div>
                  <div>
                    <div className="admin-stat-value">{overview.totalSchemes}</div>
                    <div className="admin-stat-label">Total Schemes</div>
                    <div className="admin-stat-sub">{overview.centralSchemes + overview.stateSchemes} total source</div>
                  </div>
                </div>
                <div className="admin-stat-card" onClick={() => setActive('users')} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Total users">
                  <div className="admin-stat-icon" aria-hidden="true">👥</div>
                  <div>
                    <div className="admin-stat-value">{overview.totalUsers}</div>
                    <div className="admin-stat-label">Total Users</div>
                    <div className="admin-stat-sub">Registered accounts</div>
                  </div>
                </div>
                <div className="admin-stat-card" onClick={() => setActive('schemes')} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Total applications">
                  <div className="admin-stat-icon" aria-hidden="true">📨</div>
                  <div>
                    <div className="admin-stat-value">{overview.totalApplications}</div>
                    <div className="admin-stat-label">Total Applications</div>
                    <div className="admin-stat-sub">Sum of apply counts</div>
                  </div>
                </div>
                <div className="admin-stat-card" onClick={() => setActive('users')} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Total bookmarks">
                  <div className="admin-stat-icon" aria-hidden="true">🔖</div>
                  <div>
                    <div className="admin-stat-value">{overview.totalBookmarks}</div>
                    <div className="admin-stat-label">Total Bookmarks</div>
                    <div className="admin-stat-sub">Saved by users</div>
                  </div>
                </div>
                <div className="admin-stat-card" onClick={() => setActive('schemes')} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Active schemes">
                  <div className="admin-stat-icon" aria-hidden="true">✓</div>
                  <div>
                    <div className="admin-stat-value">{overview.activeSchemes}</div>
                    <div className="admin-stat-label">Active Schemes</div>
                    <div className="admin-stat-sub">{overview.draftSchemes} draft · {overview.inactiveSchemes} inactive</div>
                  </div>
                </div>
                <div className="admin-stat-card" onClick={() => setActive('schemes')} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Draft schemes">
                  <div className="admin-stat-icon" aria-hidden="true">📝</div>
                  <div>
                    <div className="admin-stat-value">{overview.draftSchemes}</div>
                    <div className="admin-stat-label">Draft Schemes</div>
                    <div className="admin-stat-sub">{overview.inactiveSchemes} inactive</div>
                  </div>
                </div>
              </div>

              {/* Event Management Overview */}
              <section className="analytics-card analytics-card-full" aria-labelledby="analytics-events-title">
                <div className="analytics-card-header">
                  <h3 id="analytics-events-title" className="analytics-card-title">Event Management</h3>
                  <p className="analytics-card-subtitle">Government / Public events overview</p>
                </div>
                {eventStatsLoading ? (
                  <div className="analytics-empty">Loading event statistics…</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginTop: '6px' }}>
                    <div className="admin-stat-card" onClick={() => { setActive('schemes'); setAdminEventView('events'); setAdminEventStatus(''); setAdminEventsPage(1); }} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Total events">
                      <div className="admin-stat-icon" aria-hidden="true">🎫</div>
                      <div>
                        <div className="admin-stat-value">{eventStats.total}</div>
                        <div className="admin-stat-label">Total Events</div>
                        <div className="admin-stat-sub">All statuses</div>
                      </div>
                    </div>
                    <div className="admin-stat-card" onClick={() => { setActive('schemes'); setAdminEventView('events'); setAdminEventStatus('Pending'); setAdminEventsPage(1); }} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Pending events">
                      <div className="admin-stat-icon" aria-hidden="true">⏳</div>
                      <div>
                        <div className="admin-stat-value">{eventStats.pending}</div>
                        <div className="admin-stat-label">Pending Events</div>
                        <div className="admin-stat-sub">Awaiting review</div>
                      </div>
                    </div>
                    <div className="admin-stat-card" onClick={() => { setActive('schemes'); setAdminEventView('events'); setAdminEventStatus('Approved'); setAdminEventsPage(1); }} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Approved events">
                      <div className="admin-stat-icon" aria-hidden="true">✓</div>
                      <div>
                        <div className="admin-stat-value">{eventStats.approved}</div>
                        <div className="admin-stat-label">Approved Events</div>
                        <div className="admin-stat-sub">Publicly listed</div>
                      </div>
                    </div>
                    <div className="admin-stat-card" onClick={() => { setActive('schemes'); setAdminEventView('events'); setAdminEventStatus('Rejected'); setAdminEventsPage(1); }} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Rejected events">
                      <div className="admin-stat-icon" aria-hidden="true">⛔</div>
                      <div>
                        <div className="admin-stat-value">{eventStats.rejected}</div>
                        <div className="admin-stat-label">Rejected Events</div>
                        <div className="admin-stat-sub">Hidden from public</div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Analytics Grid: Source + Status */}
              <div className="admin-analytics-grid">
                {/* Scheme Source */}
                <section className="analytics-card" aria-labelledby="analytics-source-title">
                  <div className="analytics-card-header">
                    <h3 id="analytics-source-title" className="analytics-card-title">Scheme Source</h3>
                    <p className="analytics-card-subtitle">Central vs State distribution</p>
                  </div>
                  {(() => {
                    const total = (overview.centralSchemes || 0) + (overview.stateSchemes || 0);
                    if (total === 0) {
                      return <div className="analytics-empty">No scheme source data available.</div>;
                    }
                    const centralPct = Math.round(((overview.centralSchemes || 0) / total) * 100);
                    const statePct = 100 - centralPct;
                    return (
                      <div className="analytics-source">
                        <div className="analytics-source-row">
                          <span className="analytics-source-label"><span className="analytics-dot" style={{ background: '#2563eb' }} aria-hidden="true"></span> Central Government</span>
                          <span className="analytics-source-value">{overview.centralSchemes} · {centralPct}%</span>
                        </div>
                        <div className="analytics-source-row">
                          <span className="analytics-source-label"><span className="analytics-dot" style={{ background: '#0d9488' }} aria-hidden="true"></span> State Government</span>
                          <span className="analytics-source-value">{overview.stateSchemes} · {statePct}%</span>
                        </div>
                        <div className="analytics-bar-track" role="progressbar" aria-valuenow={centralPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Central ${centralPct}% State ${statePct}%`}>
                          <div className="analytics-bar-fill" style={{ width: `${centralPct}%`, background: '#2563eb' }}></div>
                          <div className="analytics-bar-fill" style={{ width: `${statePct}%`, background: '#0d9488' }}></div>
                        </div>
                        <div className="analytics-count">Total {total} schemes</div>
                      </div>
                    );
                  })()}
                </section>

                {/* Scheme Status */}
                <section className="analytics-card" aria-labelledby="analytics-status-title">
                  <div className="analytics-card-header">
                    <h3 id="analytics-status-title" className="analytics-card-title">Scheme Status</h3>
                    <p className="analytics-card-subtitle">Active, draft and inactive breakdown</p>
                  </div>
                  {(() => {
                    const totalStatus = (overview.activeSchemes || 0) + (overview.draftSchemes || 0) + (overview.inactiveSchemes || 0);
                    if (totalStatus === 0) {
                      return <div className="analytics-empty">No scheme status data available.</div>;
                    }
                    const statuses = [
                      { label: 'Active', value: overview.activeSchemes, color: '#15803d', bg: '#dcfce7' },
                      { label: 'Draft', value: overview.draftSchemes, color: '#92400e', bg: '#fef3c7' },
                      { label: 'Inactive', value: overview.inactiveSchemes, color: '#b91c1c', bg: '#fecaca' }
                    ];
                    const maxStatus = Math.max(...statuses.map(s => s.value), 1);
                    return (
                      <div className="analytics-status">
                        {statuses.map((s) => (
                          <div key={s.label} className="analytics-status-row">
                            <span className="analytics-status-label">
                              <span className="analytics-dot" style={{ background: s.color }} aria-hidden="true"></span> {s.label}
                            </span>
                            <span className="analytics-status-value">{s.value}</span>
                          </div>
                        ))}
                        <div className="analytics-bars" style={{ marginTop: '12px' }}>
                          {statuses.map((s) => (
                            <div key={s.label} className="analytics-bar-row">
                              <span className="analytics-bar-label">{s.label}</span>
                              <div className="analytics-bar-track">
                                <div className="analytics-bar-fill" style={{ width: `${(s.value / maxStatus) * 100}%`, background: s.color }}></div>
                              </div>
                              <span className="analytics-count">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </section>
              </div>

              {/* Schemes by Category - Full Width */}
              <section className="analytics-card analytics-card-full" aria-labelledby="analytics-category-title">
                <div className="analytics-card-header">
                  <h3 id="analytics-category-title" className="analytics-card-title">Schemes by Category</h3>
                  <p className="analytics-card-subtitle">Distribution across categories — proportional to highest count</p>
                </div>
                {Array.isArray(overview.schemesByCategory) && overview.schemesByCategory.length > 0 ? (
                  <div className="analytics-bars">
                    {(() => {
                      const maxCategoryCount = Math.max(...overview.schemesByCategory.map(item => item.count), 1);
                      return overview.schemesByCategory.map((item) => (
                        <div key={item.category} className="analytics-bar-row">
                          <span className="analytics-bar-label" title={item.category}>{item.category}</span>
                          <div className="analytics-bar-track">
                            <div className="analytics-bar-fill" style={{ width: `${(item.count / maxCategoryCount) * 100}%`, background: '#2563eb' }}></div>
                          </div>
                          <span className="analytics-count">{item.count}</span>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="analytics-empty">No category data available.</div>
                )}
              </section>

              {/* Most Applied + Most Bookmarked */}
              <div className="admin-analytics-grid">
                <section className="analytics-card" aria-labelledby="analytics-applied-title">
                  <div className="analytics-card-header">
                    <h3 id="analytics-applied-title" className="analytics-card-title">Most Applied Schemes</h3>
                    <p className="analytics-card-subtitle">Top 5 by apply count</p>
                  </div>
                  {Array.isArray(overview.mostApplied) && overview.mostApplied.length > 0 ? (
                    <ol className="analytics-ranked-list">
                      {overview.mostApplied.map((s, idx) => (
                        <li key={s._id} className="analytics-ranked-item">
                          <span className="analytics-rank" aria-hidden="true">{String(idx + 1).padStart(2, '0')}</span>
                          <div className="analytics-ranked-main">
                            <div className="analytics-ranked-title" title={s.title}>{s.title}</div>
                            <div className="analytics-ranked-meta">
                              <span className="category-badge" style={{ fontSize: '0.7rem' }}>{s.category}</span>
                              <span className="analytics-ranked-count">{s.applyCount ?? 0} applications</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="analytics-empty">No application data available.</div>
                  )}
                </section>

                <section className="analytics-card" aria-labelledby="analytics-bookmarked-title">
                  <div className="analytics-card-header">
                    <h3 id="analytics-bookmarked-title" className="analytics-card-title">Most Bookmarked Schemes</h3>
                    <p className="analytics-card-subtitle">Top 5 by saves</p>
                  </div>
                  {Array.isArray(overview.mostBookmarked) && overview.mostBookmarked.length > 0 ? (
                    <ol className="analytics-ranked-list">
                      {overview.mostBookmarked.map((s, idx) => (
                        <li key={s._id} className="analytics-ranked-item">
                          <span className="analytics-rank" aria-hidden="true">{String(idx + 1).padStart(2, '0')}</span>
                          <div className="analytics-ranked-main">
                            <div className="analytics-ranked-title" title={s.title}>{s.title}</div>
                            <div className="analytics-ranked-meta">
                              <span className="category-badge" style={{ fontSize: '0.7rem' }}>{s.category}</span>
                              <span className="analytics-ranked-count">{s.bookmarkCount ?? 0} bookmarks</span>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="analytics-empty">No bookmarks yet.</div>
                  )}
                </section>
              </div>

              {/* Recent Schemes + Recently Updated */}
              <div className="admin-analytics-grid">
                <section className="analytics-card" aria-labelledby="analytics-recent-title">
                  <div className="analytics-card-header">
                    <h3 id="analytics-recent-title" className="analytics-card-title">Recent Schemes</h3>
                    <p className="analytics-card-subtitle">Latest 5 added</p>
                  </div>
                  {Array.isArray(overview.recentSchemes) && overview.recentSchemes.length > 0 ? (
                    <div className="analytics-table-wrapper">
                      <div className="admin-table-scroll">
                        <div className="admin-table">
                          <div className="admin-table-head" style={{ gridTemplateColumns: '1.6fr 0.9fr 0.7fr 0.7fr 0.7fr 0.9fr' }}>
                            <div>Scheme</div>
                            <div>Category</div>
                            <div>Source</div>
                            <div>State</div>
                            <div>Status</div>
                            <div>Added</div>
                          </div>
                          <div className="admin-table-body">
                            {overview.recentSchemes.slice(0, 5).map((s) => (
                              <div key={s._id} className="admin-table-row" style={{ gridTemplateColumns: '1.6fr 0.9fr 0.7fr 0.7fr 0.7fr 0.9fr' }}>
                                <div className="admin-table-cell" style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.title}>
                                  <Link to={`/schemes/${s._id}`} className="link-inline">{s.title}</Link>
                                </div>
                                <div className="admin-table-cell"><span className="category-badge">{s.category}</span></div>
                                <div className="admin-table-cell">{s.sourceType === 'CENTRAL' ? <span className="source-badge source-central">Central</span> : <span className="source-badge source-state">State</span>}</div>
                                <div className="admin-table-cell" style={{ fontSize: '0.82rem' }}>{s.sourceType === 'STATE' ? (s.state || '—') : '—'}</div>
                                <div className="admin-table-cell">{statusBadge(s.status)}</div>
                                <div className="admin-table-cell" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="analytics-empty">No schemes yet.</div>
                  )}
                </section>

                <section className="analytics-card" aria-labelledby="analytics-updated-title">
                  <div className="analytics-card-header">
                    <h3 id="analytics-updated-title" className="analytics-card-title">Recently Updated</h3>
                    <p className="analytics-card-subtitle">Latest 5 updated</p>
                  </div>
                  {Array.isArray(overview.recentUpdated) && overview.recentUpdated.length > 0 ? (
                    <div className="analytics-table-wrapper">
                      <div className="admin-table-scroll">
                        <div className="admin-table">
                          <div className="admin-table-head" style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr 0.7fr 0.9fr', padding: '10px 14px' }}>
                            <div>Scheme</div>
                            <div>Category</div>
                            <div>Status</div>
                            <div>Updated</div>
                          </div>
                          <div className="admin-table-body">
                            {overview.recentUpdated.slice(0, 5).map((s) => (
                              <div key={s._id} className="admin-table-row" style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr 0.7fr 0.9fr', padding: '10px 14px' }}>
                                <div className="admin-table-cell" style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.title}>
                                  <Link to={`/schemes/${s._id}`} className="link-inline">{s.title}</Link>
                                </div>
                                <div className="admin-table-cell"><span className="category-badge">{s.category}</span></div>
                                <div className="admin-table-cell">{statusBadge(s.status)}</div>
                                <div className="admin-table-cell" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="analytics-empty">No recently updated schemes.</div>
                  )}
                </section>
              </div>

              {/* Creation Trend */}
              <section className="analytics-card analytics-card-full" aria-labelledby="analytics-trend-title">
                <div className="analytics-card-header">
                  <h3 id="analytics-trend-title" className="analytics-card-title">Scheme Creation Trend</h3>
                  <p className="analytics-card-subtitle">Monthly creation — scheme creation, not application trend</p>
                </div>
                {Array.isArray(overview.creationTrend) && overview.creationTrend.length > 0 ? (
                  <div className="analytics-trend">
                    <div className="analytics-trend-bars">
                      {(() => {
                        const maxTrend = Math.max(...overview.creationTrend.map((t) => t.count), 1);
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        return overview.creationTrend.map((item) => (
                          <div key={`${item.year}-${item.month}`} className="analytics-trend-item">
                            <div className="analytics-trend-count">{item.count}</div>
                            <div className="analytics-trend-bar-track">
                              <div className="analytics-trend-bar" style={{ height: `${(item.count / maxTrend) * 100}%` }} aria-label={`${monthNames[item.month - 1]} ${item.year}: ${item.count}`}></div>
                            </div>
                            <div className="analytics-trend-label">{monthNames[item.month - 1]} {item.year}</div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="analytics-empty">No creation history available.</div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {active === 'schemes' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button className={`btn-secondary ${adminEventView === 'schemes' ? 'btn-primary' : ''}`} onClick={() => setAdminEventView('schemes')} style={adminEventView === 'schemes' ? {} : { background: '#ffffff', borderColor: '#e2e8f0' }}>Schemes</button>
                  <button className={`btn-secondary ${adminEventView === 'events' ? 'btn-primary' : ''}`} onClick={() => { setAdminEventView('events'); fetchAdminEvents(1); fetchPendingEventsCount(); setAdminEventsPage(1); }} style={adminEventView === 'events' ? {} : { background: '#ffffff', borderColor: '#e2e8f0' }}>Events{pendingEventsCount > 0 ? ` (${pendingEventsCount})` : ''}</button>
          </div>

          {adminEventView === 'schemes' ? (
            <>
              <div className="admin-filters-bar">
                <div className="admin-filter-row">
                  <input className="form-input admin-filter-search" type="search" placeholder="Search schemes..." value={schemeSearch} onChange={(e) => { setSchemeSearch(e.target.value); setSchemePage(1); }} aria-label="Search schemes" />
                  <select className="form-select" value={schemeCategoryFilter} onChange={(e) => { setSchemeCategoryFilter(e.target.value); setSchemePage(1); }} aria-label="Filter by category">
                    <option value="">All Categories</option>
                    {(schemeMetadata.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="form-select" value={schemeSourceFilter} onChange={(e) => { setSchemeSourceFilter(e.target.value); setSchemeStateFilter(''); setSchemePage(1); }} aria-label="Filter by source">
                    <option value="">All Sources</option>
                    {(schemeMetadata.sourceTypes || []).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <select className="form-select" value={schemeStateFilter} onChange={(e) => { setSchemeStateFilter(e.target.value); setSchemePage(1); }} disabled={schemeSourceFilter && schemeSourceFilter !== 'State Govt'} aria-label="Filter by state">
                    <option value="">All States</option>
                    {(schemeMetadata.states || []).map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div className="admin-filter-row">
                  <div className="multi-select-wrapper" style={{ minWidth: '180px', flex: 1 }}>
                    <button type="button" className="form-select multi-select-trigger" onClick={() => setShowEligibilityDropdown(v => !v)}>
                      {eligibilityFilter.length === 0 ? 'All Eligibility' : `${eligibilityFilter.length} tag${eligibilityFilter.length > 1 ? 's' : ''}`} <span className="dropdown-arrow">▾</span>
                    </button>
                    {showEligibilityDropdown && (
                      <div className="multi-select-dropdown" onMouseDown={e => e.preventDefault()}>
                        {(schemeMetadata.eligibilityTags || []).map(tag => (
                          <label key={tag} className="multi-select-option">
                            <input type="checkbox" checked={eligibilityFilter.includes(tag)} onChange={() => toggleEligibilityTag(tag)} />
                            <span>{tag}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort by">
                    <option value="updatedAt">Sort: Updated</option>
                    <option value="createdAt">Sort: Created</option>
                    <option value="title">Sort: Title</option>
                    <option value="category">Sort: Category</option>
                    <option value="applyCount">Sort: Popular</option>
                  </select>
                  <select className="form-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} aria-label="Sort order" style={{ maxWidth: '120px' }}>
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                  <select className="form-select" value={String(pageLimit)} onChange={(e) => { setPageLimit(Number(e.target.value)); setSchemePage(1); }} aria-label="Page size" style={{ maxWidth: '110px' }}>
                    <option value="10">10 / page</option>
                    <option value="20">20 / page</option>
                    <option value="50">50 / page</option>
                  </select>
                  {hasTableFilters && <button type="button" className="btn-secondary" onClick={resetTableFilters}>Clear All</button>}
                </div>
                {eligibilityFilter.length > 0 && (
                  <div className="active-filters-row" style={{ marginTop: '8px' }}>
                    <span className="active-filters-label">Active tags:</span>
                    {eligibilityFilter.map(tag => <span key={tag} className="active-filter-chip" onClick={() => toggleEligibilityTag(tag)}>{tag} ×</span>)}
                  </div>
                )}
              </div>

              {loading && <SkeletonSchemesGrid count={6} />}
              {error && !loading && <ErrorState message={error} onRetry={fetchSchemes} />}
              {!loading && !error && schemes.length === 0 && (
                <EmptyState icon="📋" title={hasTableFilters ? 'No matching schemes' : 'No schemes yet'} description={hasTableFilters ? 'Try adjusting filters.' : "Click 'Add Scheme' to create your first scheme."} action={<button className="btn-primary" onClick={hasTableFilters ? resetTableFilters : () => setIsAddModalOpen(true)}>{hasTableFilters ? 'Clear Filters' : '+ Add First Scheme'}</button>} />
              )}
              {!loading && !error && schemes.length > 0 && (
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <div className="admin-panel-title">All Schemes <span className="section-count">({schemesTotal})</span></div>
                    <span className="admin-muted">Page {schemesPagination.page} of {schemesPagination.pages || 1}</span>
                  </div>
                  <div className="admin-table-scroll">
                    <div className="admin-table admin-schemes-table">
                      <div className="admin-table-head admin-schemes-head">
                        <div>Scheme</div>
                        <div>Category</div>
                        <div>Source</div>
                        <div>State</div>
                        <div>Eligibility</div>
                        <div>Docs</div>
                        <div>Status</div>
                        <div>Date</div>
                        <div className="admin-table-actions-col">Actions</div>
                      </div>
                      <div className="admin-table-body">
                        {schemes.map((s) => (
                          <div key={s._id} className="admin-table-row admin-schemes-row tilt-hover">
                            <div className="admin-table-cell admin-scheme-cell">
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                                <div className="scheme-thumb">
                                  <img src={s.imageUrl || coverPlaceholder({ title: s.title, category: s.category, state: s.state, sourceType: s.sourceType, type: 'scheme' })} alt={s.title} className="scheme-thumb-img" />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div className="admin-scheme-title" title={s.title}><Link to={`/schemes/${s._id}`} className="link-inline">{s.title}</Link></div>
                                  <div className="admin-muted" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.category}</div>
                                </div>
                              </div>
                            </div>
                            <div className="admin-table-cell"><span className="category-badge">{s.category}</span></div>
                            <div className="admin-table-cell">
                              {s.sourceType === 'CENTRAL' ? <span className="source-badge source-central">Central</span> : <span className="source-badge source-state">State</span>}
                            </div>
                            <div className="admin-table-cell">{s.sourceType === 'STATE' ? (s.state || <span className="admin-muted">—</span>) : <span className="admin-muted">—</span>}</div>
                            <div className="admin-table-cell">{renderTags(s.eligibilityTags)}</div>
                            <div className="admin-table-cell" style={{ textAlign: 'center' }}>
                              <span className="docs-count-badge">{Array.isArray(s.documentsRequired) ? s.documentsRequired.length : 0}</span>
                            </div>
                            <div className="admin-table-cell">{statusBadge(s.status)}</div>
                            <div className="admin-table-cell" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{s.formattedCreatedAt || (s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '—')}</div>
                            <div className="admin-table-cell admin-table-actions">
                              <button className="btn-icon" onClick={() => handleViewScheme(s)} title="View scheme details" aria-label={`View details of ${s.title}`} style={{ color: '#1d4ed8', borderColor: '#bfdbfe' }}>👁</button>
                              <button className="btn-icon btn-edit" onClick={() => handleEditScheme(s)} title="Edit scheme">✏</button>
                              <button className="btn-icon btn-delete" onClick={() => handleDeleteClick(s)} title="Delete scheme">🗑</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {schemesPagination.pages > 1 && (
                    <div className="pagination admin-pagination" role="navigation" aria-label="Admin schemes pagination">
                      <button className="btn-secondary pagination-btn" onClick={() => setSchemePage(p => Math.max(1, p - 1))} disabled={schemePage === 1}>← Previous</button>
                      <span className="pagination-info">Page <strong>{schemesPagination.page}</strong> of <strong>{schemesPagination.pages}</strong> · {schemesTotal} total</span>
                      <button className="btn-secondary pagination-btn" onClick={() => setSchemePage(p => Math.min(schemesPagination.pages, p + 1))} disabled={schemePage === schemesPagination.pages}>Next →</button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="admin-filters-bar">
                <div className="admin-filter-row">
                  <input className="form-input admin-filter-search" type="search" placeholder="Search events..." value={adminEventSearch} onChange={(e) => { setAdminEventSearch(e.target.value); setAdminEventsPage(1); }} aria-label="Search events" />
                  <select className="form-select" value={adminEventCategory} onChange={(e) => { setAdminEventCategory(e.target.value); setAdminEventsPage(1); }} aria-label="Filter by category">
                    <option value="">All Categories</option>
                    {(eventMeta.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="form-select" value={adminEventStatus} onChange={(e) => { setAdminEventStatus(e.target.value); setAdminEventsPage(1); }} aria-label="Filter by status">
                    <option value="">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Draft">Draft</option>
                  </select>
                  <select className="form-select" value={adminEventSource} onChange={(e) => { setAdminEventSource(e.target.value); setAdminEventsPage(1); }} aria-label="Filter by source type">
                    <option value="">All Sources</option>
                    {(eventMeta.sourceTypes || []).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select className="form-select" value={adminEventDepartment} onChange={(e) => { setAdminEventDepartment(e.target.value); setAdminEventsPage(1); }} aria-label="Filter by department">
                    <option value="">All Departments</option>
                    {(eventMeta.departments || []).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select className="form-select" value={adminEventSortBy} onChange={(e) => setAdminEventSortBy(e.target.value)} aria-label="Sort by">
                    <option value="eventDate">Sort: Event Date</option>
                    <option value="createdAt">Sort: Created</option>
                    <option value="title">Sort: Title</option>
                    <option value="registrationCount">Sort: Popular</option>
                  </select>
                  <select className="form-select" value={adminEventSortOrder} onChange={(e) => setAdminEventSortOrder(e.target.value)} style={{ maxWidth: '110px' }} aria-label="Sort order">
                    <option value="asc">Asc</option>
                    <option value="desc">Desc</option>
                  </select>
                  {(adminEventSearch || adminEventCategory || adminEventStatus || adminEventSource || adminEventDepartment) && <button type="button" className="btn-secondary" onClick={() => { setAdminEventSearch(''); setAdminEventCategory(''); setAdminEventStatus(''); setAdminEventSource(''); setAdminEventDepartment(''); setAdminEventSortBy('eventDate'); setAdminEventSortOrder('asc'); setAdminEventsPage(1); }}>Clear</button>}
                  </div>
                </div>

                {pendingEventsCount > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <button type="button" className="btn-secondary" onClick={() => { setAdminEventStatus('Pending'); setAdminEventsPage(1); }} style={{ borderColor: '#fde68a', background: '#fffbeb', color: '#92400e', fontWeight: 700 }}>
                      ⏳ Pending Events: {pendingEventsCount} {adminEventStatus === 'Pending' ? '(showing)' : '— click to review'}
                    </button>
                  </div>
                )}

                {adminEventsLoading && <SkeletonSchemesGrid count={4} />}
              {adminEventsError && !adminEventsLoading && <ErrorState message={adminEventsError} onRetry={() => fetchAdminEvents(adminEventsPage)} />}
              {!adminEventsLoading && !adminEventsError && adminEvents.length === 0 && (
                <EmptyState icon="🎉" title="No events found" description="No events match your filters. Events are shown after they are created. Note: public view shows Approved only, but admin sees this filtered list." />
              )}
              {!adminEventsLoading && !adminEventsError && adminEvents.length > 0 && (
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <div className="admin-panel-title">All Events <span className="section-count">({adminEventsPagination.total})</span></div>
                    <span className="admin-muted">Page {adminEventsPagination.page} of {adminEventsPagination.pages || 1}</span>
                  </div>
                  <div className="admin-table-scroll">
                    <div className="admin-table" style={{ minWidth: '1480px' }}>
                         <div className="admin-table-head" style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1fr 0.8fr 0.9fr 0.7fr 0.7fr 0.7fr 0.8fr 0.9fr 0.5fr 0.7fr 240px', padding: '10px 14px' }}>
                         <div>Title</div>
                         <div>Event ID</div>
                         <div>Organizer</div>
                         <div>Department</div>
                         <div>Scheme</div>
                         <div>Source</div>
                         <div>Category</div>
                         <div>Event Date</div>
                         <div>Location</div>
                         <div>Capacity</div>
                         <div>Status</div>
                         <div>Created</div>
                          <div className="admin-events-actions-col" style={{ textAlign: 'right' }}>Actions</div>
                       </div>
                      <div className="admin-table-body">
                        {adminEvents.map((ev) => (
                            <div key={ev._id} className="admin-table-row" style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 1fr 0.8fr 0.9fr 0.7fr 0.7fr 0.7fr 0.8fr 0.9fr 0.5fr 0.7fr 240px', padding: '10px 14px', alignItems: 'center' }}>
                             <div className="admin-table-cell" style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.title}>
                               <Link to={`/events/${ev._id}`} className="link-inline">{ev.title}</Link>
                             </div>
                             <div className="admin-table-cell" style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace' }} title={ev._id}>#{String(ev._id).slice(-6)}</div>
                             <div className="admin-table-cell" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.organizer?.name || ev.organizer?.email || String(ev.organizer)}>{ev.organizer?.name || ev.organizer?.organizationName || (ev.organizer ? String(ev.organizer).slice(-6) : '—')}</div>
                             <div className="admin-table-cell" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.department}>{ev.department || '—'}</div>
                             <div className="admin-table-cell" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.schemeId?.title || ''}>{ev.schemeId?.title || '—'}</div>
                             <div className="admin-table-cell"><span className={`source-badge ${ev.sourceType === 'Central' ? 'source-central' : ev.sourceType === 'State' ? 'source-state' : 'source-local'}`}>{ev.sourceType || '—'}</span></div>
                             <div className="admin-table-cell"><span className="category-badge">{ev.category}</span></div>
                             <div className="admin-table-cell" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                             <div className="admin-table-cell" style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.location}>{ev.location || '—'}</div>
                             <div className="admin-table-cell" style={{ textAlign: 'center' }}>{ev.capacity || '∞'}</div>
                             <div className="admin-table-cell">{statusBadge(ev.status)}</div>
                             <div className="admin-table-cell" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('en-IN') : '—'}</div>
                              <div className="admin-table-cell admin-events-actions">
                                <Link to={`/events/${ev._id}`} className="btn-action btn-action-view">View Details</Link>
                                {ev.status === 'Pending' && (
                                  <button className="btn-action btn-action-approve" onClick={() => handleApproveClick(ev)} disabled={adminEventActionId === ev._id}>Approve</button>
                                )}
                                {ev.status === 'Pending' && (
                                  <button className="btn-action btn-action-reject" onClick={() => handleRejectClick(ev)} disabled={adminEventActionId === ev._id}>Reject</button>
                                )}
                                <button className="btn-action btn-action-delete" onClick={() => handleAdminEventDelete(ev)} disabled={adminEventActionId === ev._id}>Delete</button>
                              </div>
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {adminEventsPagination.pages > 1 && (
                    <div className="pagination admin-pagination">
                      <button className="btn-secondary pagination-btn" onClick={() => setAdminEventsPage(p => Math.max(1, p - 1))} disabled={adminEventsPage === 1}>← Previous</button>
                      <span className="pagination-info">Page <strong>{adminEventsPage}</strong> of <strong>{adminEventsPagination.pages}</strong></span>
                      <button className="btn-secondary pagination-btn" onClick={() => setAdminEventsPage(p => Math.min(adminEventsPagination.pages, p + 1))} disabled={adminEventsPage === adminEventsPagination.pages}>Next →</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
      {active === 'users' && <Users />}

      <SchemeModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSubmit={handleAddScheme} mode="add" loading={isAdding} />
      <SchemeModal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingScheme(null); }} onSubmit={handleUpdateScheme} mode="edit" initialData={editingScheme} loading={isUpdating} />
      {isViewSchemeOpen && (
        <div className="modal-overlay" onClick={() => { setIsViewSchemeOpen(false); setViewingScheme(null); setViewSchemeError(null); }} style={{ zIndex: 1000 }}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '760px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                {viewingScheme?.imageUrl && (
                  <img src={viewingScheme.imageUrl} alt={viewingScheme.title} className="scheme-thumb-img" style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <h3 className="modal-title" title={viewingScheme?.title}>{viewingScheme?.title || 'Scheme details'}</h3>
                  <p className="modal-subtitle" style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                    {viewingScheme?.category || '—'}{viewingScheme?.sourceType ? ` · ${viewingScheme.sourceType === 'CENTRAL' ? 'Central' : 'State'}` : ''}{viewingScheme?.sourceType === 'STATE' && viewingScheme?.state ? ` · ${viewingScheme.state}` : ''}
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={() => { setIsViewSchemeOpen(false); setViewingScheme(null); setViewSchemeError(null); }} aria-label="Close">×</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {isViewSchemeLoading && <div className="analytics-empty">Loading scheme details…</div>}
              {viewSchemeError && !isViewSchemeLoading && <ErrorState message={viewSchemeError} onRetry={() => viewingScheme && handleViewScheme(viewingScheme)} />}
              {!isViewSchemeLoading && !viewSchemeError && viewingScheme && (
                <>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {statusBadge(viewingScheme.status)}
                    {viewingScheme.endDate && !isNaN(new Date(viewingScheme.endDate).getTime()) && new Date(viewingScheme.endDate).getTime() < Date.now()
                      ? <span className="status-badge status-inactive">Expired</span>
                      : null}
                    <span className="category-badge">{viewingScheme.category}</span>
                    {viewingScheme.sourceType === 'CENTRAL'
                      ? <span className="source-badge source-central">Central</span>
                      : <span className="source-badge source-state">State{viewingScheme.state ? ` · ${viewingScheme.state}` : ''}</span>}
                    <span className="admin-muted" style={{ fontSize: '0.78rem' }}>Apply count: <strong style={{ color: '#0f172a' }}>{viewingScheme.applyCount ?? 0}</strong></span>
                  </div>
                  <div>
                    <div className="form-section-title" style={{ marginBottom: '6px' }}>Description</div>
                    <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{viewingScheme.description || '—'}</p>
                  </div>
                  <div>
                    <div className="form-section-title" style={{ marginBottom: '6px' }}>Eligibility</div>
                    <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{viewingScheme.eligibility || '—'}</p>
                    {Array.isArray(viewingScheme.eligibilityTags) && viewingScheme.eligibilityTags.length > 0 && (
                      <div className="admin-chips" style={{ marginTop: '8px' }}>
                        {viewingScheme.eligibilityTags.map((t) => <span key={t} className="eligibility-tag">{t}</span>)}
                      </div>
                    )}
                    {viewingScheme.eligibilityRules && Object.keys(viewingScheme.eligibilityRules).length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', marginTop: '10px', fontSize: '0.82rem' }}>
                        {viewingScheme.eligibilityRules.minAge != null && <div><span className="admin-muted">Min age: </span><strong>{viewingScheme.eligibilityRules.minAge}</strong></div>}
                        {viewingScheme.eligibilityRules.maxAge != null && <div><span className="admin-muted">Max age: </span><strong>{viewingScheme.eligibilityRules.maxAge}</strong></div>}
                        {viewingScheme.eligibilityRules.maxAnnualIncome != null && <div><span className="admin-muted">Max income: </span><strong>{viewingScheme.eligibilityRules.maxAnnualIncome}</strong></div>}
                        {Array.isArray(viewingScheme.eligibilityRules.genders) && viewingScheme.eligibilityRules.genders.length > 0 && <div><span className="admin-muted">Genders: </span><strong>{viewingScheme.eligibilityRules.genders.join(', ')}</strong></div>}
                        {Array.isArray(viewingScheme.eligibilityRules.states) && viewingScheme.eligibilityRules.states.length > 0 && <div><span className="admin-muted">States: </span><strong>{viewingScheme.eligibilityRules.states.join(', ')}</strong></div>}
                        {Array.isArray(viewingScheme.eligibilityRules.socialCategories) && viewingScheme.eligibilityRules.socialCategories.length > 0 && <div><span className="admin-muted">Categories: </span><strong>{viewingScheme.eligibilityRules.socialCategories.join(', ')}</strong></div>}
                        {Array.isArray(viewingScheme.eligibilityRules.occupations) && viewingScheme.eligibilityRules.occupations.length > 0 && <div><span className="admin-muted">Occupations: </span><strong>{viewingScheme.eligibilityRules.occupations.join(', ')}</strong></div>}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="form-section-title" style={{ marginBottom: '6px' }}>Benefits</div>
                    <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{viewingScheme.benefits || '—'}</p>
                  </div>
                  <div>
                    <div className="form-section-title" style={{ marginBottom: '6px' }}>Documents required ({Array.isArray(viewingScheme.documentsRequired) ? viewingScheme.documentsRequired.length : 0})</div>
                    {Array.isArray(viewingScheme.documentsRequired) && viewingScheme.documentsRequired.length > 0 ? (
                      <div className="admin-chips">{viewingScheme.documentsRequired.map((d, i) => <span key={`${d}-${i}`} className="doc-chip">{d}</span>)}</div>
                    ) : <span className="admin-muted">—</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '0.86rem' }}>
                    <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Official URL</div>{viewingScheme.officialURL ? <a href={viewingScheme.officialURL} target="_blank" rel="noopener noreferrer" className="link-inline" style={{ wordBreak: 'break-all' }}>{viewingScheme.officialURL}</a> : <span className="admin-muted">—</span>}</div>
                    <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Image URL</div>{viewingScheme.imageUrl ? <a href={viewingScheme.imageUrl} target="_blank" rel="noopener noreferrer" className="link-inline" style={{ wordBreak: 'break-all' }}>View image</a> : <span className="admin-muted">—</span>}</div>
                    <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Application End Date</div><div style={{ color: '#0f172a' }}>{viewingScheme.endDate && !isNaN(new Date(viewingScheme.endDate).getTime()) ? new Date(viewingScheme.endDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No end date'}</div></div>
                    <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created</div><div style={{ color: '#0f172a' }}>{viewingScheme.formattedCreatedAt || (viewingScheme.createdAt ? new Date(viewingScheme.createdAt).toLocaleDateString('en-IN') : '—')}</div></div>
                    <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last updated</div><div style={{ color: '#0f172a' }}>{viewingScheme.formattedUpdatedAt || (viewingScheme.updatedAt ? new Date(viewingScheme.updatedAt).toLocaleDateString('en-IN') : '—')}</div></div>
                    <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created by</div><div style={{ color: '#0f172a' }}>{viewingScheme.createdBy?.name ? `${viewingScheme.createdBy.name} (${viewingScheme.createdBy.email || viewingScheme.createdBy.role || ''})` : '—'}</div></div>
                    <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheme ID</div><div style={{ color: '#475569', fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>{viewingScheme._id}</div></div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <Link to={viewingScheme ? `/schemes/${viewingScheme._id}` : '/schemes'} className="btn-secondary" style={{ textDecoration: 'none' }}>Open Public Page</Link>
              <button type="button" className="btn-primary" onClick={() => { setIsViewSchemeOpen(false); setViewingScheme(null); setViewSchemeError(null); }}>Done</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal isOpen={isDeleteConfirmOpen} onClose={() => { setIsDeleteConfirmOpen(false); setDeletingScheme(null); }} onConfirm={handleConfirmDelete} title="Delete Scheme" message={`Are you sure you want to delete "${deletingScheme?.title}"? This action cannot be undone.`} confirmText="Delete Scheme" loading={isDeleting} danger={true} />
      <ConfirmModal isOpen={isAdminEventDeleteOpen} onClose={() => { setIsAdminEventDeleteOpen(false); setAdminEventDeleteTarget(null); }} onConfirm={handleConfirmAdminEventDelete} title="Delete Event" message={`Are you sure you want to delete "${adminEventDeleteTarget?.title}"? This action cannot be undone.`} confirmText="Delete Event" loading={!!adminEventActionId} danger={true} />
      <ConfirmModal isOpen={isRejectConfirmOpen} onClose={() => { setIsRejectConfirmOpen(false); setRejectTarget(null); }} onConfirm={handleConfirmReject} title="Reject Event" message={`Are you sure you want to reject "${rejectTarget?.title}"? The event will be hidden from public listings.`} confirmText="Reject Event" loading={!!adminEventActionId} danger={true} />
      <ConfirmModal isOpen={isApproveConfirmOpen} onClose={() => { setIsApproveConfirmOpen(false); setApproveTarget(null); }} onConfirm={handleConfirmApprove} title="Approve Event" message={`Are you sure you want to approve "${approveTarget?.title}"? It will become publicly visible.`} confirmText="Approve Event" loading={!!adminEventActionId} />
      <BulkSchemeImport
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImport={handleBulkImport}
      />

      {isResultOpen && importResult && (
        <div className="modal-overlay" onClick={() => { setIsResultOpen(false); setImportResult(null); }} style={{ zIndex: 1000 }}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '760px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Import Result</h3>
                <p className="modal-subtitle" style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>Bulk government scheme import completed</p>
              </div>
              <button className="modal-close" onClick={() => { setIsResultOpen(false); setImportResult(null); }} aria-label="Close">×</button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Total received</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{importResult.totalReceived ?? 0}</div>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#15803d', marginBottom: '6px' }}>Successfully inserted</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', lineHeight: 1 }}>{importResult.inserted ?? 0}</div>
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#92400e', marginBottom: '6px' }}>Duplicates skipped</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#92400e', lineHeight: 1 }}>{importResult.skippedDuplicates ?? 0}</div>
                </div>
                <div style={{ background: importResult.failed > 0 ? '#fef2f2' : '#f8fafc', border: `1px solid ${importResult.failed > 0 ? '#fecaca' : '#e2e8f0'}`, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: importResult.failed > 0 ? '#b91c1c' : '#64748b', marginBottom: '6px' }}>Failed</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: importResult.failed > 0 ? '#b91c1c' : '#0f172a', lineHeight: 1 }}>{importResult.failed ?? 0}</div>
                </div>
              </div>

              {/* Duplicates section */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setShowDuplicates((v) => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#ffffff', border: 'none', borderBottom: showDuplicates ? '1px solid #f1f5f9' : 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}
                >
                  <span>Duplicates {importResult.duplicates?.length ? `(${importResult.duplicates.length})` : ''}</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', transform: showDuplicates ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s ease' }}>▾</span>
                </button>
                {showDuplicates && (
                  <div style={{ padding: '12px', maxHeight: '220px', overflowY: 'auto' }}>
                    {Array.isArray(importResult.duplicates) && importResult.duplicates.length > 0 ? (
                      <div className="admin-table" style={{ minWidth: 'auto' }}>
                        <div className="admin-table-head" style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 1.2fr', padding: '8px 12px' }}>
                          <div>Scheme Title</div>
                          <div>Category</div>
                          <div>Reason</div>
                        </div>
                        <div className="admin-table-body">
                          {importResult.duplicates.map((d, idx) => (
                            <div key={`${d.title}-${idx}`} className="admin-table-row" style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 1.2fr', padding: '10px 12px' }}>
                              <div className="admin-table-cell" style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.title}>{d.title || '—'}</div>
                              <div className="admin-table-cell"><span className="category-badge">{d.category || '—'}</span></div>
                              <div className="admin-table-cell" style={{ fontSize: '0.82rem', color: '#92400e' }}>{d.reason || 'Duplicate'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '0.88rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>No duplicates found</div>
                    )}
                  </div>
                )}
                {!showDuplicates && (
                  <div style={{ padding: '10px 16px', fontSize: '0.82rem', color: '#64748b', background: '#fbfdff', borderTop: '1px solid #f1f5f9' }}>
                    {Array.isArray(importResult.duplicates) && importResult.duplicates.length > 0 ? `${importResult.duplicates.length} duplicate(s) — expand to view` : 'No duplicates found'}
                  </div>
                )}
              </div>

              {/* Failed section */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setShowFailed((v) => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#ffffff', border: 'none', borderBottom: showFailed ? '1px solid #f1f5f9' : 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}
                >
                  <span>Failed Imports {importResult.errors?.length ? `(${importResult.errors.length})` : ''}</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', transform: showFailed ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s ease' }}>▾</span>
                </button>
                {showFailed && (
                  <div style={{ padding: '12px', maxHeight: '220px', overflowY: 'auto' }}>
                    {Array.isArray(importResult.errors) && importResult.errors.length > 0 ? (
                      <div className="admin-table" style={{ minWidth: '600px' }}>
                        <div className="admin-table-head" style={{ display: 'grid', gridTemplateColumns: '0.4fr 1.2fr 0.8fr 1.6fr', padding: '8px 12px' }}>
                          <div>Index</div>
                          <div>Title</div>
                          <div>Category</div>
                          <div>Error</div>
                        </div>
                        <div className="admin-table-body">
                          {importResult.errors.map((e, idx) => (
                            <div key={`${e.title}-${idx}`} className="admin-table-row" style={{ display: 'grid', gridTemplateColumns: '0.4fr 1.2fr 0.8fr 1.6fr', padding: '10px 12px' }}>
                              <div className="admin-table-cell" style={{ color: '#64748b', fontWeight: 600 }}>{e.index ?? idx}</div>
                              <div className="admin-table-cell" style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.title}>{e.title || '—'}</div>
                              <div className="admin-table-cell"><span className="category-badge">{e.category || '—'}</span></div>
                              <div className="admin-table-cell" style={{ fontSize: '0.82rem', color: '#b91c1c', whiteSpace: 'normal', wordBreak: 'break-word' }}>{e.message || JSON.stringify(e.errors || {})}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '0.88rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>No failed imports</div>
                    )}
                  </div>
                )}
                {!showFailed && (
                  <div style={{ padding: '10px 16px', fontSize: '0.82rem', color: '#64748b', background: '#fbfdff', borderTop: '1px solid #f1f5f9' }}>
                    {Array.isArray(importResult.errors) && importResult.errors.length > 0 ? `${importResult.errors.length} failed — expand to view` : 'No failed imports'}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'flex-end', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn-primary" onClick={() => { setIsResultOpen(false); setImportResult(null); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
    </>
  );
};

export default AdminDashboard;
