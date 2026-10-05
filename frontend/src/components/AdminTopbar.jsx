const AdminTopbar = ({ title, subtitle, actions }) => {
  return (
    <div className="admin-topbar-inner">
      <div>
        <div className="admin-topbar-title">{title}</div>
        {subtitle && <div className="admin-topbar-subtitle">{subtitle}</div>}
      </div>
      <div className="admin-topbar-actions">
        {actions}
      </div>
    </div>
  );
};

export default AdminTopbar;

