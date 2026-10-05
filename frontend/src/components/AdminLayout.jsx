import '../styles/admin.css';

const AdminLayout = ({ sidebar, topbar, children, collapsed = false }) => {
  return (
    <div className={`admin-shell page-admin${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="admin-sidebar">
        {sidebar}
      </aside>
      <div className="admin-main">
        <div className="admin-topbar">
          {topbar}
        </div>
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;

