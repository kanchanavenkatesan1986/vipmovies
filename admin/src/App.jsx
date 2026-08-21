import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { ToastContainer } from './components/common/ToastContainer';
import { MovieFormModal } from './components/movies/MovieFormModal';
import { moviesApi } from './api/moviesApi';
import { useToast } from './context/ToastContext';

// Lazy-loaded pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MoviesPage from './pages/MoviesPage';
import ComingSoonPage from './pages/ComingSoonPage';
import BulkImportPage from './pages/BulkImportPage';
import BulkExportPage from './pages/BulkExportPage';
import BrokenLinksPage from './pages/BrokenLinksPage';
import ImageManagerPage from './pages/ImageManagerPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import BackupPage from './pages/BackupPage';
import RecycleBinPage from './pages/RecycleBinPage';

function AuthGuard({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppInner() {
  const { isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const [globalAddOpen, setGlobalAddOpen] = useState(false);

  const handleGlobalAddMovie = async (formData) => {
    try {
      await moviesApi.createMovie(formData);
      addToast(`Movie "${formData.title}" added!`, 'success');
      setGlobalAddOpen(false);
    } catch (e) {
      addToast('Failed to add movie', 'error');
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <ToastContainer />
      </>
    );
  }

  return (
    <>
      <AdminLayout onNewMovie={() => setGlobalAddOpen(true)}>
        <Routes>
          <Route path="/" element={<AuthGuard><DashboardPage /></AuthGuard>} />
          <Route path="/movies" element={<AuthGuard><MoviesPage title="All Movies" /></AuthGuard>} />
          <Route path="/movies/tamil" element={<AuthGuard><MoviesPage filterLanguage="tamil" title="Tamil Movies" /></AuthGuard>} />
          <Route path="/movies/hollywood" element={<AuthGuard><MoviesPage filterType="hollywood" title="Hollywood Movies" /></AuthGuard>} />
          <Route path="/coming-soon" element={<AuthGuard><ComingSoonPage /></AuthGuard>} />
          <Route path="/bulk-import" element={<AuthGuard><BulkImportPage /></AuthGuard>} />
          <Route path="/bulk-export" element={<AuthGuard><BulkExportPage /></AuthGuard>} />
          <Route path="/broken-links" element={<AuthGuard><BrokenLinksPage /></AuthGuard>} />
          <Route path="/images" element={<AuthGuard><ImageManagerPage /></AuthGuard>} />
          <Route path="/analytics" element={<AuthGuard><AnalyticsPage /></AuthGuard>} />
          <Route path="/notifications" element={<AuthGuard><NotificationsPage /></AuthGuard>} />
          <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
          <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
          <Route path="/activity-logs" element={<AuthGuard><ActivityLogsPage /></AuthGuard>} />
          <Route path="/backup" element={<AuthGuard><BackupPage /></AuthGuard>} />
          <Route path="/trash" element={<AuthGuard><RecycleBinPage /></AuthGuard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminLayout>

      {/* Global Quick-Add Movie Modal triggered from Header */}
      <MovieFormModal
        isOpen={globalAddOpen}
        onClose={() => setGlobalAddOpen(false)}
        onSave={handleGlobalAddMovie}
        editMovie={null}
      />

      <ToastContainer />
    </>
  );
}

export default function App() {
  return <AppInner />;
}
