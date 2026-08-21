import React from 'react';

export default function Header({ onToggleSidebar, breadcrumb = 'Dashboard', onRefresh, onLogout }) {
  return (
    <header className="admin-topbar">
      <div className="admin-topbar-left">
        {/* Mobile hamburger — hidden on desktop via CSS */}
        <button
          className="admin-toggle-menu"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Menu"
        >
          <i className="fa-solid fa-bars"></i>
        </button>

        <div className="admin-breadcrumb">
          <i className="fa-solid fa-house" style={{ fontSize: '12px', color: 'var(--admin-text-dim)' }}></i>
          <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px', color: 'var(--admin-text-dim)' }}></i>
          <strong>{breadcrumb}</strong>
        </div>
      </div>

      <div className="admin-topbar-right">
        {onRefresh && (
          <button className="admin-btn" onClick={onRefresh} title="Refresh Cache from API">
            <i className="fa-solid fa-rotate"></i>
            <span className="hide-mobile">Refresh</span>
          </button>
        )}

        <a
          href="https://vip-movies.pages.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="admin-btn"
          title="View Live Website"
          style={{ textDecoration: 'none' }}
        >
          <i className="fa-solid fa-arrow-up-right-from-square"></i>
          <span className="hide-mobile">Live Site</span>
        </a>

        <button className="admin-btn danger" onClick={onLogout} title="Sign Out">
          <i className="fa-solid fa-right-from-bracket"></i>
          <span className="hide-mobile">Logout</span>
        </button>
      </div>
    </header>
  );
}
