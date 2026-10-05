import { useEffect, useState, useCallback, useMemo } from 'react';
import * as adminService from '../services/adminService';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { SkeletonStats } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ConfirmModal from '../components/ConfirmModal';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [roleTarget, setRoleTarget] = useState(null);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [isRoleSaving, setIsRoleSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [viewingUser, setViewingUser] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const { addToast } = useToast();
  const { user: currentUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminService.getUsers();
      setUsers(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
      addToast(err.message || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDeleteClick = (user) => {
    setDeleteTarget(user);
    setIsDeleteOpen(true);
  };

  const handleRoleClick = (user) => {
    setRoleTarget(user);
    setIsRoleOpen(true);
  };

  const handleConfirmRoleChange = async () => {
    if (!roleTarget) return;
    const nextRole = roleTarget.role === 'organizer' ? 'user' : 'organizer';
    setIsRoleSaving(true);
    try {
      const res = await adminService.updateUserRole(roleTarget._id, nextRole);
      addToast(res.message || `User role updated to ${nextRole}`, 'success');
      setIsRoleOpen(false);
      setRoleTarget(null);
      await fetchUsers();
    } catch (err) {
      addToast(err.message || 'Failed to update user role', 'error');
    } finally {
      setIsRoleSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await adminService.deleteUser(deleteTarget._id);
      addToast(res.message || `User "${deleteTarget.name}" deleted`, 'success');
      setIsDeleteOpen(false);
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      addToast(err.message || 'Failed to delete user', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (user) => {
    if (user.formattedCreatedAt) return user.formattedCreatedAt;
    if (user.createdAt) return new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    return '—';
  };

  const providerLabel = (provider) => {
    if (provider === 'google') return 'Google';
    if (provider === 'twitter') return 'Twitter';
    return 'Local';
  };

  // Display-only masking: never expose the full phone number in admin UI.
  const maskPhone = (phone) => {
    if (!phone || typeof phone !== 'string') return '—';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '••••';
    const last4 = digits.slice(-4);
    const country = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : '';
    return `${country}••••• ${last4}`;
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch = !term || u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
      const matchesProvider = !providerFilter || (u.provider || 'local') === providerFilter;
      const matchesRole = !roleFilter || u.role === roleFilter;
      return matchesSearch && matchesProvider && matchesRole;
    });
  }, [users, search, providerFilter, roleFilter]);

  const hasFilters = search.trim() || providerFilter || roleFilter;

  const clearFilters = () => {
    setSearch('');
    setProviderFilter('');
    setRoleFilter('');
  };

  return (
    <div>
      {/* --- Header Card --- */}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <div className="admin-panel-title">
              User Management
              <span className="section-count">{filteredUsers.length} / {users.length}</span>
            </div>
            <div className="admin-muted" style={{ marginTop: '4px' }}>
              Search, filter and moderate registered accounts
            </div>
          </div>
          <button className="btn-secondary" onClick={fetchUsers} disabled={loading} aria-label="Refresh users">
            ↻ Refresh
          </button>
        </div>

        {/* --- Filters --- */}
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #f1f5f9', background: '#fbfdff' }}>
          <div className="admin-filter-row" style={{ margin: 0 }}>
            <input
              className="form-input"
              type="search"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users by name or email"
              style={{ minWidth: '220px', flex: '1.6' }}
            />
            <select
              className="form-select"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              aria-label="Filter by provider"
              style={{ minWidth: '140px', flex: '0.8' }}
            >
              <option value="">All Providers</option>
              <option value="local">Local</option>
              <option value="google">Google</option>
              <option value="twitter">Twitter</option>
            </select>
            <select
              className="form-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label="Filter by role"
              style={{ minWidth: '140px', flex: '0.8' }}
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="organizer">Organizer</option>
              <option value="admin">Admin</option>
            </select>
            {hasFilters && (
              <button type="button" className="btn-secondary" onClick={clearFilters} style={{ whiteSpace: 'nowrap' }}>
                Clear Filters
              </button>
            )}
          </div>
          {hasFilters && (
            <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#64748b' }}>
              Showing <strong style={{ color: '#0f172a' }}>{filteredUsers.length}</strong> of <strong style={{ color: '#0f172a' }}>{users.length}</strong> users
              {(providerFilter || roleFilter) && (
                <span>
                  {' '}· Provider: <strong>{providerFilter ? providerLabel(providerFilter) : 'All'}</strong> · Role: <strong>{roleFilter || 'All'}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* --- Content States --- */}
        {loading && (
          <div style={{ padding: '24px' }}>
            <SkeletonStats />
          </div>
        )}

        {error && !loading && <div style={{ padding: '12px' }}><ErrorState message={error} onRetry={fetchUsers} /></div>}

        {!loading && !error && users.length === 0 && (
          <div style={{ padding: '12px' }}>
            <EmptyState icon="👥" title="No users found" description="There are no registered users yet." />
          </div>
        )}

        {!loading && !error && users.length > 0 && filteredUsers.length === 0 && (
          <div style={{ padding: '12px' }}>
            <EmptyState
              icon="🔍"
              title="No matching users"
              description="Try adjusting your search or filters to find users."
              action={<button className="btn-secondary" onClick={clearFilters}>Clear Filters</button>}
            />
          </div>
        )}

        {/* --- Table --- */}
        {!loading && !error && filteredUsers.length > 0 && (
          <div className="admin-table-scroll">
            <div className="admin-table admin-users-table">
              <div className="admin-table-head admin-users-head">
                <div>User</div>
                <div>Email</div>
                <div>Phone</div>
                <div>Provider</div>
                <div>Role</div>
                <div>Joined</div>
                <div className="admin-table-actions-col">Actions</div>
              </div>
              <div className="admin-table-body">
                {filteredUsers.map((u) => {
                  const isSelf = String(u._id) === String(currentUser?._id);
                  const isAdminUser = u.role === 'admin';
                  const canDelete = !isSelf && !isAdminUser;
                  return (
                    <div key={u._id} className="admin-table-row admin-users-row">
                      <div className="admin-table-cell" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div className="user-avatar-cell" aria-hidden="true">
                          {u.profileImage ? (
                            <img src={u.profileImage} alt={u.name} className="user-avatar-img" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="user-avatar-fallback">{u.name?.charAt(0)?.toUpperCase() || '?'}</div>
                          )}
                        </div>
                        <div style={{ minWidth: 0, lineHeight: 1.3 }}>
                          <div className="admin-scheme-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                            {isSelf && <span className="you-badge">You</span>}
                          </div>
                          <div className="admin-muted" style={{ fontSize: '0.74rem', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{String(u._id).slice(-8)}</div>
                        </div>
                      </div>
                      <div className="admin-table-cell" style={{ wordBreak: 'break-all', fontSize: '0.86rem', color: '#334155' }}>{u.email}</div>
                      <div className="admin-table-cell pro-phone-cell">
                        {maskPhone(u.phone)}
                        {u.phone ? (
                          <span className={`pro-verified-mini ${u.phoneVerified ? 'pro-verified-mini--yes' : 'pro-verified-mini--no'}`}>
                            {u.phoneVerified ? '✓ Verified' : 'Unverified'}
                          </span>
                        ) : null}
                      </div>
                      <div className="admin-table-cell">
                        <span className={`provider-badge provider-${u.provider || 'local'}`}>{providerLabel(u.provider)}</span>
                      </div>
                      <div className="admin-table-cell">
                        <span className={`role-badge-mini ${u.role === 'admin' ? 'role-admin' : 'role-user'}`}>{u.role}</span>
                      </div>
                      <div className="admin-table-cell" style={{ fontSize: '0.84rem', whiteSpace: 'nowrap', color: '#475569' }}>{formatDate(u)}</div>
                      <div className="admin-table-cell admin-table-actions">
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => { setViewingUser(u); setIsViewOpen(true); }}
                          title={`View details of ${u.name}`}
                          aria-label={`View details of ${u.name}`}
                        >
                          👁
                        </button>
                        {!isAdminUser && !isSelf && (
                          <button
                            className="btn-icon"
                            onClick={() => handleRoleClick(u)}
                            title={u.role === 'organizer' ? `Remove organizer access from ${u.name}` : `Make ${u.name} an organizer`}
                            aria-label={u.role === 'organizer' ? `Remove organizer access from ${u.name}` : `Make ${u.name} an organizer`}
                            style={u.role === 'organizer'
                              ? { color: '#92400e', borderColor: '#fde68a', background: '#fffbeb' }
                              : { color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}
                          >
                            {u.role === 'organizer' ? '⬇' : '⬆'}
                          </button>
                        )}
                        {canDelete ? (
                          <button
                            className="btn-icon btn-delete"
                            onClick={() => handleDeleteClick(u)}
                            title={`Delete ${u.name}`}
                            aria-label={`Delete ${u.name}`}
                          >
                            🗑
                          </button>
                        ) : (
                          <button
                            className="btn-icon"
                            disabled
                            title={isSelf ? 'Cannot delete your own account' : 'Admin accounts are protected'}
                            aria-label={isSelf ? 'Delete disabled for your own account' : 'Delete disabled for admin accounts'}
                            style={{ opacity: 0.42, cursor: 'not-allowed', background: '#f8fafc' }}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {isViewOpen && viewingUser && (
        <div className="modal-overlay" onClick={() => { setIsViewOpen(false); setViewingUser(null); }} style={{ zIndex: 1000 }}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="user-avatar-cell" aria-hidden="true" style={{ width: '48px', height: '48px' }}>
                  {viewingUser.profileImage ? (
                    <img src={viewingUser.profileImage} alt={viewingUser.name} className="user-avatar-img" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="user-avatar-fallback" style={{ fontSize: '1.2rem' }}>{viewingUser.name?.charAt(0)?.toUpperCase() || '?'}</div>
                  )}
                </div>
                <div>
                  <h3 className="modal-title">{viewingUser.name}</h3>
                  <p className="modal-subtitle" style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>{viewingUser.email}</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => { setIsViewOpen(false); setViewingUser(null); }} aria-label="Close">×</button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className={`role-badge-mini ${viewingUser.role === 'admin' ? 'role-admin' : 'role-user'}`}>{viewingUser.role}</span>
                <span className={`provider-badge provider-${viewingUser.provider || 'local'}`}>{providerLabel(viewingUser.provider)}</span>
                {viewingUser.isOrganizerVerified && <span className="role-badge-mini role-user">✓ Verified Organizer</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.88rem' }}>
                <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</div><div style={{ color: '#0f172a', wordBreak: 'break-all' }}>{viewingUser.email}</div></div>
                <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</div><div style={{ color: '#0f172a' }}>{maskPhone(viewingUser.phone)}</div></div>
                <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Department</div><div style={{ color: '#0f172a' }}>{viewingUser.department || '—'}</div></div>
                <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Organization</div><div style={{ color: '#0f172a' }}>{viewingUser.organizationName || '—'}{viewingUser.organizationType ? ` (${viewingUser.organizationType})` : ''}</div></div>
                <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bookmarks</div><div style={{ color: '#0f172a' }}>{Array.isArray(viewingUser.bookmarks) ? viewingUser.bookmarks.length : 0} saved</div></div>
                <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registered</div><div style={{ color: '#0f172a' }}>{formatDate(viewingUser)}</div></div>
                <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last updated</div><div style={{ color: '#0f172a' }}>{viewingUser.updatedAt ? new Date(viewingUser.updatedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</div></div>
                <div><div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User ID</div><div style={{ color: '#475569', fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>{viewingUser._id}</div></div>
              </div>
              <div>
                <div className="admin-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Bio</div>
                <div style={{ color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', fontSize: '0.88rem', whiteSpace: 'pre-wrap' }}>{viewingUser.bio || '—'}</div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn-primary" onClick={() => { setIsViewOpen(false); setViewingUser(null); }}>Done</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => { if (!isDeleting) { setIsDeleteOpen(false); setDeleteTarget(null); } }}
        onConfirm={handleConfirmDelete}
        title="Delete User"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}" (${deleteTarget.email})? This will permanently remove their account and bookmarks. This action cannot be undone.` : 'Are you sure?'}
        confirmText="Delete User"
        cancelText="Cancel"
        loading={isDeleting}
        danger={true}
      />

      <ConfirmModal
        isOpen={isRoleOpen}
        onClose={() => { if (!isRoleSaving) { setIsRoleOpen(false); setRoleTarget(null); } }}
        onConfirm={handleConfirmRoleChange}
        title={roleTarget?.role === 'organizer' ? 'Remove Organizer Access' : 'Promote to Organizer'}
        message={roleTarget ? (roleTarget.role === 'organizer'
          ? `Remove organizer access from "${roleTarget.name}" (${roleTarget.email})? They will lose organizer event-management privileges.`
          : `Promote "${roleTarget.name}" (${roleTarget.email}) to Organizer? They will gain organizer event-management privileges once verified.`) : 'Are you sure?'}
        confirmText={roleTarget?.role === 'organizer' ? 'Remove Organizer' : 'Make Organizer'}
        cancelText="Cancel"
        loading={isRoleSaving}
        danger={roleTarget?.role === 'organizer'}
      />
    </div>
  );
};

export default Users;
