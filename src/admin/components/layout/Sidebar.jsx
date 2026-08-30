import React, { useState } from 'react';

export default function Sidebar({ isOpen, onClose, currentRoute, navigateTo, onLogout }) {
  const [tamilOpen, setTamilOpen] = useState(true);
  const [hollywoodOpen, setHollywoodOpen] = useState(true);

  const isActive = (path) =>
    currentRoute === path ||
    currentRoute === `admin/${path}` ||
    currentRoute.startsWith(`admin/${path}/`);

  const go = (path) => {
    navigateTo(path);
    onClose();
  };

  return (
    <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>

      {/* Brand */}
      <div className="admin-sidebar-brand">
        <div className="admin-brand-icon">VIP</div>
        <div className="admin-brand-title">
          <strong>VIP MOVIES</strong>
          <span>ADMIN CMS</span>
        </div>

        {/* Mobile close button inside sidebar */}
        <button
          onClick={onClose}
          style={{
            marginLeft: 'auto',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--admin-border)',
            color: 'var(--admin-text-muted)',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            flexShrink: 0
          }}
          className="admin-toggle-menu"
          aria-label="Close Sidebar"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* Navigation */}
      <div className="admin-sidebar-nav">

        <div className="admin-nav-section">Main</div>

        <div
          className={`admin-nav-item ${isActive('admin/dashboard') || isActive('admin') ? 'active' : ''}`}
          onClick={() => go('admin/dashboard')}
        >
          <i className="fa-solid fa-chart-pie"></i>
          <span>Dashboard</span>
        </div>

        <div className="admin-nav-section">Catalog CMS</div>

        <div
          className={`admin-nav-item ${currentRoute === 'admin/movies' ? 'active' : ''}`}
          onClick={() => go('admin/movies')}
        >
          <i className="fa-solid fa-film"></i>
          <span>All Movies</span>
        </div>

        {/* Tamil Accordion */}
        <div
          className="admin-nav-item"
          onClick={() => setTamilOpen(o => !o)}
          style={{ justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <i className="fa-solid fa-globe" style={{ color: 'var(--admin-gold)' }}></i>
            <span>Tamil Movies</span>
          </div>
          <i className={`fa-solid fa-chevron-${tamilOpen ? 'down' : 'right'}`} style={{ fontSize: '11px' }}></i>
        </div>

        {tamilOpen && (
          <div className="admin-nav-sub">
            {['2026', '2025', '2024'].map(yr => (
              <div
                key={yr}
                className={`admin-nav-sub-item ${currentRoute.includes(`tamil/${yr}`) ? 'active' : ''}`}
                onClick={() => go(`admin/movies/tamil/${yr}`)}
              >
                {yr} Collection
              </div>
            ))}
          </div>
        )}

        {/* Hollywood Accordion */}
        <div
          className="admin-nav-item"
          onClick={() => setHollywoodOpen(o => !o)}
          style={{ justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <i className="fa-solid fa-clapperboard" style={{ color: 'var(--admin-blue)' }}></i>
            <span>Hollywood Movies</span>
          </div>
          <i className={`fa-solid fa-chevron-${hollywoodOpen ? 'down' : 'right'}`} style={{ fontSize: '11px' }}></i>
        </div>

        {hollywoodOpen && (
          <div className="admin-nav-sub">
            {['2026', '2025', '2024'].map(yr => (
              <div
                key={yr}
                className={`admin-nav-sub-item ${currentRoute.includes(`hollywood/${yr}`) ? 'active' : ''}`}
                onClick={() => go(`admin/movies/hollywood/${yr}`)}
              >
                {yr} Collection
              </div>
            ))}
          </div>
        )}

        <div className="admin-nav-section">Storage & Uploads</div>

        <div
          className={`admin-nav-item ${isActive('admin/file-manager') ? 'active' : ''}`}
          onClick={() => go('admin/file-manager')}
        >
          <i className="fa-solid fa-folder-tree" style={{ color: 'var(--admin-gold)' }}></i>
          <span>File Manager</span>
        </div>

        <div
          className={`admin-nav-item ${isActive('admin/uploads') ? 'active' : ''}`}
          onClick={() => go('admin/uploads')}
        >
          <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'var(--admin-blue)' }}></i>
          <span>Upload Manager</span>
        </div>

        <div className="admin-nav-section">Banners</div>

        <div
          className={`admin-nav-item ${isActive('admin/slides') ? 'active' : ''}`}
          onClick={() => go('admin/slides')}
        >
          <i className="fa-solid fa-images"></i>
          <span>Slide Management</span>
        </div>

      </div>

      {/* Footer */}
      <div className="admin-sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--admin-blue), var(--admin-purple))',
            color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0
          }}>A</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>Admin</div>
            <div style={{ fontSize: '11px', color: 'var(--admin-text-dim)' }}>Administrator</div>
          </div>
        </div>
        <button
          className="admin-btn danger"
          style={{ padding: '8px 12px', flexShrink: 0 }}
          onClick={onLogout}
          title="Sign Out"
        >
          <i className="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>

    </aside>
  );
}
