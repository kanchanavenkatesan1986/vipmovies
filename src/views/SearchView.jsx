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

export default function SearchView({ query = '' }) {
  const { movies } = useApp();
  const [searchText, setSearchText] = useState(query);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedLang, setSelectedLang] = useState('');

  // Get unique years for dropdown
  const uniqueYears = Array.from(new Set(movies.map(m => String(m.year)).filter(Boolean)))
    .sort((a, b) => b - a);

  // Search logic - debounced via state
  const performSearch = () => {
    let results = [...movies];

    if (searchText.trim()) {
      const term = searchText.toLowerCase().trim();
      results = results.filter(m =>
        (m.title && m.title.toLowerCase().includes(term)) ||
        (m.language && m.language.toLowerCase().includes(term)) ||
        (m.director && m.director.toLowerCase().includes(term)) ||
        (m.starring && m.starring.toLowerCase().includes(term)) ||
        (m.year && String(m.year).includes(term)) ||
        (m.category && m.category.toLowerCase().includes(term)) ||
        (m.type && m.type.toLowerCase().includes(term)) ||
        (m.story && m.story.toLowerCase().includes(term))
      );
    }

    if (selectedYear) {
      results = results.filter(m => String(m.year) == selectedYear);
    }

    if (selectedLang) {
      results = results.filter(m => (m.type || '').toLowerCase() === selectedLang);
    }

    // Sort: active first, coming soon last
    results.sort((a, b) => {
      const aComing = (a.status || '').toLowerCase() === 'coming soon' ? 1 : 0;
      const bComing = (b.status || '').toLowerCase() === 'coming soon' ? 1 : 0;
      return aComing - bComing;
    });

    return results;
  };

  const filteredMovies = performSearch();
  const isSearching = !!(searchText.trim() || selectedYear || selectedLang);

  return (
    <>
      {/* SEARCH INPUTS */}
      <input
        type="text"
        id="searchInput"
        placeholder="Search movie by title, director, actor..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        autoFocus
      />

      <div className="search-box">
        <select
          id="yearFilter"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
        >
          <option value="">All Years</option>
          {uniqueYears.map(yr => (
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </select>

        <select
          id="langFilter"
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="tamil">Tamil</option>
          <option value="hollywood">Hollywood</option>
        </select>
      </div>

      {/* MOVIE GRID */}
      {filteredMovies.length > 0 ? (
        <div id="movieList" className="movies-grid">
          {filteredMovies.map(movie => {
            const isComingSoon = movie.status && movie.status.toLowerCase() === 'coming soon';
            const movieType = (movie.type || '').toLowerCase();
            const movieYear = movie.year || '';
            return (
              <a
                key={movie.id}
                href={`/watch?reward=${movie.id}`}
                onClick={(e) => { e.preventDefault(); history.pushState(null, '', `/watch?reward=${movie.id}`); window.dispatchEvent(new PopStateEvent('popstate')); }}
                className="list-card-link"
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
                    <p className="list-card-info">Language: {movie.language || '-'}</p>
                    <p className="list-card-info">Release: {movie.release || '-'}</p>
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
        /* Movie Not Available Message */
        <div id="notAvailable" className="not-box" style={{ display: isSearching ? 'flex' : 'none' }}>
          <i className="fa-solid fa-film"></i>
          <h1 className="note">Movie Not Available...</h1>
        </div>
      )}
    </>
  );
}
