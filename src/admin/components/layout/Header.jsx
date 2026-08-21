import React from 'react';

export default function Header({ onToggleSidebar, pageTitle = 'Dashboard', breadcrumb = 'Dashboard', onRefresh, onLogout }) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        <button className="admin-toggle-menu" onClick={onToggleSidebar} aria-label="Toggle Navigation">
          <i className="fa-solid fa-bars"></i>
        </button>
        <div className="admin-breadcrumb">
          <span>Admin</span>
          <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px' }}></i>
          <strong>{breadcrumb}</strong>
        </div>
      </div>

      <div className="admin-topbar-right">
        {onRefresh && (
          <button className="admin-btn" onClick={onRefresh} title="Refresh API Cache">
            <i className="fa-solid fa-rotate"></i>
            <span className="hide-mobile">Refresh</span>
          </button>
        )}

        <div style={{ width: '1px', height: '24px', background: 'var(--admin-border)', margin: '0 4px' }}></div>

        <button className="admin-btn danger" onClick={onLogout} title="Sign Out">
          <i className="fa-solid fa-right-from-bracket"></i>
          <span className="hide-mobile">Logout</span>
        </button>
      </div>
    </header>
  );
}
