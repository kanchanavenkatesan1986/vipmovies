import React, { useState } from 'react';
import { useApp } from '../AppContext';

function getImageUrl(movie) {
  if (!movie) return '';
  const img = movie.image || '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const type = (movie.type || '').toLowerCase();
  const year = movie.year || '';
  if (img && type && year) return `/src/images/${type}/${year}/${img}`;
  return img;
}

export default function FilterView() {
  const { movies } = useApp();
  const [selectedType, setSelectedType] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [applied, setApplied] = useState(false);
  const [timelineText, setTimelineText] = useState('Recently Added');

  // Stats
  const totalCount = movies.length;
  const tamilCount = movies.filter(m => String(m.type).toLowerCase() === 'tamil').length;
  const hollyCount = movies.filter(m => String(m.type).toLowerCase() === 'hollywood').length;

  const allYears = Array.from(new Set(movies.map(m => String(m.year)).filter(Boolean)))
    .sort((a, b) => b - a);

  // All categories from the original filter.html
  const categories = [
    'Action','Adventure','Animation','Comedy','Crime','Documentary',
    'Drama','Family','Fantasy','History','Horror','Kids','Music',
    'Mystery','Reality','Romance','Sci-Fi','Soap','Sport','Thriller','War'
  ];

  // Initial display: show all movies sorted by active first, coming soon last
  const defaultMovies = [...movies].sort((a, b) => {
    const aComing = String(a.status || '').toLowerCase() === 'coming soon' ? 1 : 0;
    const bComing = String(b.status || '').toLowerCase() === 'coming soon' ? 1 : 0;
    if (aComing !== bComing) return aComing - bComing;
    return (b.id || 0) - (a.id || 0);
  });

  const [filteredMovies, setFilteredMovies] = useState(defaultMovies);

  const applyFilter = () => {
    let results = [...movies];

    if (selectedType) {
      results = results.filter(m => String(m.type).toLowerCase() === selectedType);
    }
    if (selectedYear) {
      results = results.filter(m => String(m.year) === selectedYear);
    }
    if (selectedCategory) {
      results = results.filter(m =>
        (m.category || m.genre || '').toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Sort
    results.sort((a, b) => {
      const aComing = String(a.status || '').toLowerCase() === 'coming soon' ? 1 : 0;
      const bComing = String(b.status || '').toLowerCase() === 'coming soon' ? 1 : 0;
      if (aComing !== bComing) return aComing - bComing;
      return (b.id || 0) - (a.id || 0);
    });

    // Build timeline text
    const parts = [];
    if (selectedType) parts.push(selectedType.charAt(0).toUpperCase() + selectedType.slice(1));
    if (selectedYear) parts.push(selectedYear);
    if (selectedCategory) parts.push(selectedCategory);
    setTimelineText(parts.length ? parts.join(' · ') + ' Movies' : 'All Movies');

    setFilteredMovies(results);
    setApplied(true);
  };

  return (
    <>
      {/* New Releases Hero */}
      <div className="releases-hero">
        <h1><i className="fa-solid fa-bolt" style={{ marginRight: '6px' }}></i>Filter Movies</h1>
        <p>Fresh additions to our library – watch before anyone else</p>
      </div>

      {/* Quick Stats */}
      <div className="release-stats">
        <div className="stat-card">
          <span className="stat-number" id="totalCount">{totalCount}</span>
          <span className="stat-label">Total Movies</span>
        </div>
        <div className="stat-card">
          <span className="stat-number" id="tamilCount">{tamilCount}</span>
          <span className="stat-label">Tamil</span>
        </div>
        <div className="stat-card">
          <span className="stat-number" id="hwCount">{hollyCount}</span>
          <span className="stat-label">Hollywood</span>
        </div>
      </div>

      {/* Filter Dropdowns */}
      <div className="filter-panel">
        <div className="filter-row">
          <div className="filter-select-wrap">
            <label htmlFor="selType">Type</label>
            <select
              id="selType"
              className="filter-select"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="tamil">Tamil</option>
              <option value="hollywood">Hollywood</option>
            </select>
          </div>
          <div className="filter-select-wrap">
            <label htmlFor="selYear">Year</label>
            <select
              id="selYear"
              className="filter-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">All Years</option>
              {allYears.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
          <div className="filter-select-wrap">
            <label htmlFor="selCategory">Category</label>
            <select
              id="selCategory"
              className="filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="filter-apply-btn" onClick={applyFilter}>
          <i className="fa-solid fa-magnifying-glass"></i> Apply Filter
        </button>
      </div>

      {/* Timeline Label */}
      <div className="timeline-label">
        <i className="fa-solid fa-clock"></i>
        <span id="timelineText">{timelineText}</span>
        <span id="resultCount" style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: 'var(--accent)',
          fontWeight: 700,
          backgroundColor: 'rgba(245, 197, 24, 0.1)',
          padding: '4px 10px',
          borderRadius: '8px',
          border: '1px solid rgba(245, 197, 24, 0.25)'
        }}>
          {filteredMovies.length} Movies
        </span>
      </div>

      {/* New Releases Grid */}
      {filteredMovies.length > 0 ? (
        <div id="releasesGrid" className="movies-grid">
          {filteredMovies.map(movie => {
            const isComingSoon = movie.status && movie.status.toLowerCase() === 'coming soon';
            const movieType = (movie.type || '').toLowerCase();
            const movieYear = movie.year || '';
            return (
              <a
                key={movie.id}
                href={`/watch?reward=${movie.id}`}
                onClick={(e) => { e.preventDefault(); window.location.href = `/watch?reward=${movie.id}`; }}
                className="list-card-link new-release-card"
                style={isComingSoon ? { opacity: '0.45', filter: 'grayscale(60%)' } : {}}
              >
                <div className="list-card">
                  <div className="list-card-img-wrapper">
                    <img
                      className="list-card-img"
                      src={getImageUrl(movie)}
                      alt={movie.title}
                      loading="lazy"
                    />
                    <span className="list-card-badge">{movie.year || '-'}</span>
                    {isComingSoon && <span className="coming-soon-badge">Coming Soon</span>}
                  </div>
                  <div className="list-card-details">
                    <h3 className="list-card-title">{movie.title}</h3>
                    <p className="list-card-info">{movie.language || '-'} • {movie.release || movie.year || '-'}</p>
                    <div className="list-card-action">
                      <i className="fa-solid fa-circle-play"></i> Watch Ads - Unlock
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div id="emptyState" className="not-box" style={{ display: 'flex' }}>
          <i className="fa-solid fa-bolt" style={{ fontSize: '38px', color: 'var(--success)', marginBottom: '16px' }}></i>
          <h1 className="note">No movies match your filter...</h1>
        </div>
      )}
    </>
  );
}
