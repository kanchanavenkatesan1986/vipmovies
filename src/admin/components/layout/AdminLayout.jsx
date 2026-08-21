import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from '../common/ToastContainer';
import { authService } from '../../services/authService';

export default function AdminLayout({ children, currentRoute, navigateTo, pageTitle, breadcrumb, onRefresh }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Add admin-mode class to body
    document.body.classList.add('admin-mode');
    return () => {
      document.body.classList.remove('admin-mode');
    };
  }, []);

  const handleLogout = () => {
    authService.logout();
    navigateTo('login');
  };

  return (
    <div className="admin-layout">
      {/* Sidebar Drawer */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentRoute={currentRoute}
        navigateTo={navigateTo}
        onLogout={handleLogout}
      />

      {/* Main Content Outer Wrap */}
      <div className="admin-main-wrap">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          pageTitle={pageTitle}
          breadcrumb={breadcrumb}
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
