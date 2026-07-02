import React from 'react'

export const SkeletonPost: React.FC = () => {
  return (
    <div className="skeleton-loader">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="skeleton-item skeleton-avatar" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton-item skeleton-title" />
          <div className="skeleton-item skeleton-subtitle" />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        <div className="skeleton-item skeleton-text-row" />
        <div className="skeleton-item skeleton-text-row" />
        <div className="skeleton-item skeleton-text-row short" />
      </div>
      <div className="skeleton-item skeleton-media" style={{ marginTop: 8 }} />
    </div>
  )
}
