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

export default function Router() {
  const [route, setRoute] = useState({ path: 'home', params: {} });

  useEffect(() => {
    const handleHashChange = () => {
      let hash = window.location.hash || '#/home';
      if (!hash.startsWith('#/')) {
        hash = '#/home';
      }

      // Remove '#/'
      const pathWithParams = hash.substring(2);
      
      // Separate path and query string
      const qIndex = pathWithParams.indexOf('?');
      let path = qIndex !== -1 ? pathWithParams.substring(0, qIndex) : pathWithParams;
      const search = qIndex !== -1 ? pathWithParams.substring(qIndex) : '';

      // Normalize path
      if (!path || path === '') {
        path = 'home';
      }

      // Parse parameters
      const params = {};
      if (search) {
        const urlParams = new URLSearchParams(search);
        for (const [key, val] of urlParams.entries()) {
          params[key] = val;
        }
      }

      setRoute({ path, params });
      
      // Scroll window to top on route change
      window.scrollTo(0, 0);
    };

    // Listen to hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    // Run once on load
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Render correct view based on path
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
