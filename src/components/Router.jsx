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

function parseLocation() {
  // pathname e.g. "/watch", "/home", "/"
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
