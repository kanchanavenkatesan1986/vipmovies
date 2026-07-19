import React, { useState, useEffect } from 'react';
import { useApp } from './AppContext';
import Router from './components/Router';
import './main.css';

export default function App() {
  const { isLoading, error } = useApp();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('home');

  // Track active page path for bottom-nav styling
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/home';
      let path = hash.substring(2);
      const qIndex = path.indexOf('?');
      if (qIndex !== -1) {
        path = path.substring(0, qIndex);
      }
      setCurrentPath(path || 'home');
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isDrawerOpen]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  const navigateTo = (path) => {
    window.location.hash = `#/${path}`;
    closeDrawer();
  };

  if (isLoading) {
    return (
      <div className="main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="skeleton-card" style={{ width: '80%', height: '300px' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="main" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px', textAlign: 'center' }}>
        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '48px', color: 'var(--accent)', marginBottom: '16px' }}></i>
        <h2>Failed to Load App Data</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px 0' }}>{error.message || 'Check your internet connection.'}</p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ background: 'var(--accent)', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="main">
      {/* Navigation Drawer (Overlay) */}
      <div id="myNav" className={`overlay ${isDrawerOpen ? 'active' : ''}`}>
        <img 
          src="/m-image/Close icon.png" 
          className="close" 
          onClick={closeDrawer} 
          alt="Close Menu" 
          style={{ cursor: 'pointer' }}
        />
        <img src="/m-image/VIP Movies.jpg" className="navimg" alt="VIP Movies" />

        <div className="nav-menu">
          <a onClick={() => navigateTo('home')} className={`nav-link ${currentPath === 'home' ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
            <i className="fa-solid fa-house"></i> Home
          </a>
          <a onClick={() => navigateTo('favorites')} className={`nav-link ${currentPath === 'favorites' ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
            <i className="fa-solid fa-heart"></i> Favorites
          </a>
          <a onClick={() => navigateTo('setting')} className={`nav-link ${currentPath === 'setting' ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
            <i className="fa-solid fa-gear"></i> Setting
          </a>
          <a onClick={() => navigateTo('feedback')} className={`nav-link ${currentPath === 'feedback' ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
            <i className="fa-solid fa-comment-dots"></i> Feedback
          </a>
          <a onClick={() => navigateTo('about')} className={`nav-link ${currentPath === 'about' ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
            <i className="fa-solid fa-circle-info"></i> About
          </a>
        </div>
      </div>

      {/* Header */}
      <div className="header">
        <img 
          src="/m-image/Menu icon.png" 
          className="menu" 
          onClick={openDrawer} 
          alt="Menu" 
          style={{ cursor: 'pointer' }}
        />
        <img 
          src="/m-image/Vip Title.png" 
          className="title" 
          alt="VIP Movies Logo" 
          onClick={() => window.location.hash = '#/home'}
          style={{ cursor: 'pointer' }}
        />
        <a href="#/search" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/m-image/Search icon.png" className="search" alt="Search" />
        </a>
      </div>

      {/* Main View Router */}
      <Router />

      {/* Bottom Navigation Bar */}
      <div className="bottom-nav">
        <a href="#/home" className={`bottom-nav-item ${currentPath === 'home' || currentPath === 'list' ? 'active' : ''}`}>
          <i className="fa-solid fa-house"></i>
          <span>Home</span>
        </a>
        <a href="#/search" className={`bottom-nav-item ${currentPath === 'search' ? 'active' : ''}`}>
          <i className="fa-solid fa-magnifying-glass"></i>
          <span>Search</span>
        </a>
        <a href="#/years" className={`bottom-nav-item ${currentPath === 'years' ? 'active' : ''}`}>
          <i className="fa-solid fa-calendar-days"></i>
          <span>Years</span>
        </a>
        <a href="#/filter" className={`bottom-nav-item ${currentPath === 'filter' ? 'active' : ''}`}>
          <i className="fa-solid fa-sliders"></i>
          <span>Filter</span>
        </a>
        <a href="#/history" className={`bottom-nav-item ${currentPath === 'history' ? 'active' : ''}`}>
          <i className="fa-solid fa-clock-rotate-left"></i>
          <span>History</span>
        </a>
      </div>
    </div>
  );
}
