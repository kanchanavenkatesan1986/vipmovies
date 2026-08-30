import React, { useState, useEffect } from 'react';
import HomeView from '../views/HomeView';
import WatchView from '../views/WatchView';
import SearchView from '../views/SearchView';
import YearsView from '../views/YearsView';
import ListView from '../views/ListView';
import FilterView from '../views/FilterView';
import FavoritesView from '../views/FavoritesView';
import HistoryView from '../views/HistoryView';
import SettingsView from '../views/SettingsView';
import FeedbackView from '../views/FeedbackView';
import AboutView from '../views/AboutView';

// Admin CMS Imports
import LoginPage from '../admin/pages/LoginPage';
import DashboardPage from '../admin/pages/DashboardPage';
import MoviesPage from '../admin/pages/MoviesPage';
import SlidesPage from '../admin/pages/SlidesPage';
import UploadManagerPage from '../admin/pages/UploadManagerPage';
import { authService } from '../admin/services/authService';
import '../admin/styles/admin.css';

function parseLocation() {
  // pathname e.g. "/watch", "/home", "/admin", "/admin/movies"
  let path = window.location.pathname.replace(/^\//, '') || 'home';

  // Parse query params from real search string e.g. ?reward=tamil-2025-00025
  const params = {};
  const urlParams = new URLSearchParams(window.location.search);
  for (const [key, val] of urlParams.entries()) {
    params[key] = val;
  }

  return { path, params };
}

export default function Router() {
  const [route, setRoute] = useState(parseLocation);

  const navigateTo = (newPath) => {
    let cleanPath = newPath.replace(/^\//, '');
    window.history.pushState(null, '', `/${cleanPath}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseLocation());
      window.scrollTo(0, 0);
    };

    window.addEventListener('popstate', handlePopState);

    // Run once on mount to handle direct loads / refreshes
    setRoute(parseLocation());

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const path = route.path.toLowerCase();

  // Admin Route Protection Guard
  if (path.startsWith('admin')) {
    const isLogin = path === 'admin/login' || path === 'admin-login';
    const isAuthed = authService.isAuthenticated();

    if (!isAuthed && !isLogin) {
      return <LoginPage navigateTo={navigateTo} />;
    }

    if (isLogin) {
      if (isAuthed) {
        return <DashboardPage navigateTo={navigateTo} />;
      }
      return <LoginPage navigateTo={navigateTo} />;
    }

    if (path === 'admin' || path === 'admin/dashboard') {
      return <DashboardPage navigateTo={navigateTo} />;
    }

    if (path === 'admin/slides') {
      return <SlidesPage navigateTo={navigateTo} />;
    }

    if (path === 'admin/uploads' || path === 'admin/upload') {
      return <UploadManagerPage navigateTo={navigateTo} />;
    }

    if (path.startsWith('admin/movies')) {
      const parts = path.split('/');
      const type = parts[2] || '';
      const year = parts[3] || '';
      return <MoviesPage navigateTo={navigateTo} initialType={type} initialYear={year} />;
    }

    return <DashboardPage navigateTo={navigateTo} />;
  }

  // Public Web App Views Switch
  switch (route.path) {
    case 'home':
      return <HomeView />;
    case 'watch':
      return <WatchView movieId={route.params.reward || route.params.id} type={route.params.type} year={route.params.year} />;
    case 'search':
      return <SearchView query={route.params.q} />;
    case 'years':
      return <YearsView />;
    case 'list':
      return <ListView type={route.params.type} year={route.params.year} />;
    case 'filter':
      return <FilterView />;
    case 'favorites':
      return <FavoritesView />;
    case 'history':
      return <HistoryView />;
    case 'setting':
      return <SettingsView />;
    case 'feedback':
      return <FeedbackView />;
    case 'about':
      return <AboutView />;
    default:
      return <HomeView />;
  }
}
