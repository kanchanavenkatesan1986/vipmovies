import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from '../common/ToastContainer';
import { authService } from '../../services/authService';

export default function AdminLayout({ children, currentRoute, navigateTo, pageTitle, breadcrumb, onRefresh }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Add admin-mode class to body
  useEffect(() => {
    document.body.classList.add('admin-mode');
    return () => {
      document.body.classList.remove('admin-mode');
    };
  }, []);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleLogout = () => {
    authService.logout();
    setSidebarOpen(false);
    navigateTo('admin/login');
  };

  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  return (
    <div className="admin-layout">

      {/* Mobile backdrop overlay — click to close sidebar */}
      <div
        className={`admin-sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        currentRoute={currentRoute || ''}
        navigateTo={navigateTo}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <div className="admin-main-wrap">
        <Header
          onToggleSidebar={toggleSidebar}
          breadcrumb={breadcrumb || pageTitle || 'Dashboard'}
          onRefresh={onRefresh}
          onLogout={handleLogout}
        />

        <main className="admin-content">
          {children}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
