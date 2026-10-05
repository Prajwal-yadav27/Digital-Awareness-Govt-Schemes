const SkeletonCard = () => (
  <div className="scheme-card skeleton-card" aria-hidden="true">
    <div className="skeleton-header">
      <div className="skeleton skeleton-title"></div>
    </div>
    <div className="skeleton skeleton-badge"></div>
    <div className="skeleton-details">
      <div className="skeleton-detail">
        <div className="skeleton skeleton-label"></div>
        <div className="skeleton skeleton-text skeleton-text-long"></div>
      </div>
      <div className="skeleton-detail">
        <div className="skeleton skeleton-label"></div>
        <div className="skeleton skeleton-text skeleton-text-medium"></div>
      </div>
      <div className="skeleton-detail">
        <div className="skeleton skeleton-label"></div>
        <div className="skeleton skeleton-text"></div>
      </div>
    </div>
  </div>
);

export const SkeletonSchemesGrid = ({ count = 6 }) => (
  <div className="schemes-grid" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const SkeletonStats = () => (
  <div className="stats-grid" aria-hidden="true">
    {[1, 2, 3].map(i => (
      <div key={i} className="stat-card skeleton-stat">
        <div className="skeleton skeleton-icon"></div>
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton-stat-value"></div>
          <div className="skeleton skeleton-stat-label"></div>
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonDetails = () => (
  <div className="scheme-detail-wrapper skeleton-detail-wrapper" aria-hidden="true">
    <div className="skeleton skeleton-detail-big mb-2"></div>
    <div className="skeleton skeleton-badge mb-3"></div>
    <div className="skeleton-details">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton-detail-block">
          <div className="skeleton skeleton-label"></div>
          <div className="skeleton skeleton-text skeleton-text-long"></div>
          <div className="skeleton skeleton-text"></div>
        </div>
      ))}
    </div>
  </div>
);
