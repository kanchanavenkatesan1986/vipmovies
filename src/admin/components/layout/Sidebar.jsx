import React, { useState } from 'react';

export default function Sidebar({ isOpen, onClose, currentRoute, navigateTo, onLogout }) {
  const [tamilOpen, setTamilOpen] = useState(true);
  const [hollywoodOpen, setHollywoodOpen] = useState(true);

  const isNavActive = (path) => currentRoute === path;

  return (
    <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand Header */}
      <div className="admin-sidebar-brand">
        <div className="admin-brand-icon">VIP</div>
        <div className="admin-brand-title">
          <strong>VIP MOVIES</strong>
          <span>ADMIN CMS</span>
        </div>
      </div>

      {/* Nav Menu */}
      <div className="admin-sidebar-nav">
        <div className="admin-nav-section">Main Navigation</div>

        <div
          className={`admin-nav-item ${isNavActive('dashboard') ? 'active' : ''}`}
          onClick={() => { navigateTo('dashboard'); onClose(); }}
        >
          <i className="fa-solid fa-chart-pie"></i>
          <span>Dashboard</span>
        </div>

        <div className="admin-nav-section">Catalog CMS</div>

        <div
          className={`admin-nav-item ${isNavActive('movies') ? 'active' : ''}`}
          onClick={() => { navigateTo('movies'); onClose(); }}
        >
          <i className="fa-solid fa-film"></i>
          <span>All Movies</span>
        </div>

        {/* Tamil Accordion */}
        <div
          className="admin-nav-item"
          onClick={() => setTamilOpen(!tamilOpen)}
          style={{ justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <i className="fa-solid fa-globe"></i>
            <span>Tamil Movies</span>
          </div>
          <i className={`fa-solid ${tamilOpen ? 'fa-chevron-down' : 'fa-chevron-right'}`} style={{ fontSize: '11px' }}></i>
        </div>

        {tamilOpen && (
          <div className="admin-nav-sub">
            <div
              className={`admin-nav-sub-item ${isNavActive('movies-tamil-2026') ? 'active' : ''}`}
              onClick={() => { navigateTo('movies/tamil/2026'); onClose(); }}
            >
              2026 Collection
            </div>
            <div
              className={`admin-nav-sub-item ${isNavActive('movies-tamil-2025') ? 'active' : ''}`}
              onClick={() => { navigateTo('movies/tamil/2025'); onClose(); }}
            >
              2025 Collection
            </div>
            <div
              className={`admin-nav-sub-item ${isNavActive('movies-tamil-2024') ? 'active' : ''}`}
              onClick={() => { navigateTo('movies/tamil/2024'); onClose(); }}
            >
              2024 Collection
            </div>
          </div>
        )}

        {/* Hollywood Accordion */}
        <div
          className="admin-nav-item"
          onClick={() => setHollywoodOpen(!hollywoodOpen)}
          style={{ justifyContent: 'space-between' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <i className="fa-solid fa-clapperboard"></i>
            <span>Hollywood Movies</span>
          </div>
          <i className={`fa-solid ${hollywoodOpen ? 'fa-chevron-down' : 'fa-chevron-right'}`} style={{ fontSize: '11px' }}></i>
        </div>

        {hollywoodOpen && (
          <div className="admin-nav-sub">
            <div
              className={`admin-nav-sub-item ${isNavActive('movies-hollywood-2026') ? 'active' : ''}`}
              onClick={() => { navigateTo('movies/hollywood/2026'); onClose(); }}
            >
              2026 Collection
            </div>
            <div
              className={`admin-nav-sub-item ${isNavActive('movies-hollywood-2025') ? 'active' : ''}`}
              onClick={() => { navigateTo('movies/hollywood/2025'); onClose(); }}
            >
              2025 Collection
            </div>
            <div
              className={`admin-nav-sub-item ${isNavActive('movies-hollywood-2024') ? 'active' : ''}`}
              onClick={() => { navigateTo('movies/hollywood/2024'); onClose(); }}
            >
              2024 Collection
            </div>
          </div>
        )}

        <div className="admin-nav-section">Banner CMS</div>

        <div
          className={`admin-nav-item ${isNavActive('slides') ? 'active' : ''}`}
          onClick={() => { navigateTo('slides'); onClose(); }}
        >
          <i className="fa-solid fa-images"></i>
          <span>Slide Management</span>
        </div>
      </div>

      {/* Footer Profile & Logout */}
      <div className="admin-sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--admin-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px' }}>
            A
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Admin</span>
            <span style={{ fontSize: '10px', color: 'var(--admin-text-dim)' }}>Administrator</span>
          </div>
        </div>
        <button
          className="admin-btn"
          style={{ padding: '6px 10px', color: 'var(--admin-danger)' }}
          onClick={onLogout}
          title="Sign Out"
        >
          <i className="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </aside>
  );
}
