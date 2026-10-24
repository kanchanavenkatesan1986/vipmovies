import React, { useState, useMemo, useEffect } from 'react';
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

const QUICK_TAGS = [
  { label: 'Action', type: 'category', value: 'Action', icon: 'fa-fire' },
  { label: 'Thriller', type: 'category', value: 'Thriller', icon: 'fa-skull' },
  { label: 'Comedy', type: 'category', value: 'Comedy', icon: 'fa-face-laugh-beam' },
  { label: 'Romance', type: 'category', value: 'Romance', icon: 'fa-heart' },
  { label: 'Sci-Fi', type: 'category', value: 'Sci-Fi', icon: 'fa-rocket' },
  { label: 'Horror', type: 'category', value: 'Horror', icon: 'fa-ghost' },
  { label: 'Drama', type: 'category', value: 'Drama', icon: 'fa-masks-theater' },
  { label: 'Tamil Hits', type: 'lang', value: 'tamil', icon: 'fa-film' },
  { label: 'Hollywood', type: 'lang', value: 'hollywood', icon: 'fa-clapperboard' },
  { label: '2026 Movies', type: 'year', value: '2026', icon: 'fa-calendar-days' },
  { label: '2025 Movies', type: 'year', value: '2025', icon: 'fa-calendar-check' },
  { label: 'Series', type: 'contentType', value: 'series', icon: 'fa-tv' },
];

export default function SearchView({ query = '' }) {
  const { movies, openMoviePreview, getWatchUrl } = useApp();
  const [searchText, setSearchText] = useState(query);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedLang, setSelectedLang] = useState('');
  const [visibleCount, setVisibleCount] = useState(24);

  // Sync prop changes
  useEffect(() => {
    if (query) {
      setSearchText(query);
    }
  }, [query]);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(24);
  }, [searchText, selectedYear, selectedLang]);

  // Memoized unique years list
  const uniqueYears = useMemo(() => {
    return Array.from(new Set(movies.map(m => String(m.year)).filter(Boolean)))
      .sort((a, b) => b - a);
  }, [movies]);

  const isSearching = Boolean(searchText.trim() || selectedYear || selectedLang);

  // High-performance search: Only executes when actively searching
  const filteredMovies = useMemo(() => {
    if (!isSearching) return [];

    let results = movies;
    const term = searchText.toLowerCase().trim();

    if (term) {
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
      results = results.filter(m => String(m.year) === selectedYear);
    }

    if (selectedLang) {
      results = results.filter(m => (m.type || '').toLowerCase() === selectedLang);
    }

    // Sort: active first, coming soon last
    return [...results].sort((a, b) => {
      const aComing = (a.status || '').toLowerCase() === 'coming soon' ? 1 : 0;
      const bComing = (b.status || '').toLowerCase() === 'coming soon' ? 1 : 0;
      if (aComing !== bComing) return aComing - bComing;
      const getNum = (idStr) => {
        const parts = String(idStr).split('-');
        const last = parts[parts.length - 1];
        return parseInt(last, 10) || 0;
      };
      return getNum(a.id) - getNum(b.id);
    });
  }, [movies, searchText, selectedYear, selectedLang, isSearching]);

  // Progressive batch rendering to keep DOM light and smooth at 60 FPS
  const visibleMovies = useMemo(() => {
    return filteredMovies.slice(0, visibleCount);
  }, [filteredMovies, visibleCount]);

  const handleClear = () => {
    setSearchText('');
    setSelectedYear('');
    setSelectedLang('');
    setVisibleCount(24);
  };

  const handleTagClick = (tag) => {
    if (tag.type === 'category') {
      setSearchText(tag.value);
    } else if (tag.type === 'lang') {
      setSelectedLang(tag.value);
    } else if (tag.type === 'year') {
      setSelectedYear(tag.value);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 24);
  };

  return (
    <div className="search-view-container">
      {/* SEARCH BAR WITH EMBEDDED CLEAR BUTTON */}
      <div className="search-input-wrapper">
        <i className="fa-solid fa-magnifying-glass search-input-icon"></i>
        <input
          type="text"
          id="searchInput"
          className="search-input-field"
          placeholder="Search by movie title, actor, director..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          autoFocus
        />
        {searchText && (
          <button 
            type="button" 
            className="search-clear-btn" 
            onClick={() => setSearchText('')}
            title="Clear text"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>

      {/* FILTER CONTROLS */}
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

        {isSearching && (
          <button 
            type="button" 
            className="search-reset-all-btn"
            onClick={handleClear}
          >
            <i className="fa-solid fa-rotate-left"></i> Reset
          </button>
        )}
      </div>

      {/* ZERO-LAG INITIAL STATE: DISCOVERY HUB */}
      {!isSearching && (
        <div className="search-hub">
          <div className="search-hub-hero">
            <div className="search-hub-icon-glow">
              <i className="fa-solid fa-clapperboard"></i>
            </div>
            <h2>Search Movies Library</h2>
            <p>Type in the search bar above or tap a popular category below to discover movies instantly without any lag.</p>
          </div>

          <div className="search-tags-section">
            <h4 className="search-tags-title">
              <i className="fa-solid fa-bolt"></i> Popular Categories & Collections
            </h4>
            <div className="search-tags-grid">
              {QUICK_TAGS.map((tag, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="search-tag-chip"
                  onClick={() => handleTagClick(tag)}
                >
                  <i className={`fa-solid ${tag.icon}`}></i>
                  <span>{tag.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE SEARCH: RESULTS HEADER */}
      {isSearching && (
        <div className="search-results-header">
          <span className="search-results-count">
            Found <strong>{filteredMovies.length}</strong> {filteredMovies.length === 1 ? 'movie' : 'movies'}
            {searchText ? ` matching "${searchText}"` : ''}
          </span>
          <button type="button" className="search-results-clear" onClick={handleClear}>
            Clear
          </button>
        </div>
      )}

      {/* ACTIVE SEARCH: MOVIE GRID */}
      {isSearching && visibleMovies.length > 0 && (
        <>
          <div id="movieList" className="movies-grid">
            {visibleMovies.map(movie => {
              const isComingSoon = movie.status && movie.status.toLowerCase() === 'coming soon';
              return (
                <a
                  key={movie.id}
                  href={getWatchUrl ? getWatchUrl(movie) : `/watch?reward=${movie.id}`}
                  onClick={(e) => { e.preventDefault(); openMoviePreview(movie); }}
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
                      {movie.year && (
                        <span className="movie-card-year-badge">{movie.year}</span>
                      )}
                      <div className="movie-card-overlay">
                        <div className="movie-card-play-btn">
                          <i className="fa-solid fa-play"></i>
                        </div>
                      </div>
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

          {/* PROGRESSIVE LOAD MORE BUTTON */}
          {filteredMovies.length > visibleCount && (
            <div className="search-load-more-wrap">
              <button 
                type="button" 
                className="search-load-more-btn"
                onClick={handleLoadMore}
              >
                <span>Load More Movies</span>
                <span className="search-load-more-badge">
                  +{Math.min(24, filteredMovies.length - visibleCount)} more
                </span>
              </button>
            </div>
          )}
        </>
      )}

      {/* ACTIVE SEARCH: NO MOVIES FOUND */}
      {isSearching && filteredMovies.length === 0 && (
        <div id="notAvailable" className="not-box search-empty-state">
          <div className="search-empty-icon">
            <i className="fa-solid fa-film"></i>
          </div>
          <h2 className="search-empty-title">No Movies Found</h2>
          <p className="search-empty-desc">
            We couldn't find any movie matching your search. Try checking your spelling or search for another actor or director.
          </p>
          <button type="button" className="search-empty-btn" onClick={handleClear}>
            <i className="fa-solid fa-rotate-left"></i> View All Categories
          </button>
        </div>
      )}
    </div>
  );
}
