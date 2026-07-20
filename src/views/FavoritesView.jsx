import React from 'react';
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

export default function FavoritesView() {
  const { favorites, removeFromFavorites, clearAllFavorites } = useApp();

  const hasFavorites = favorites && favorites.length > 0;

  return (
    <>
      {/* Hero Banner */}
      <div className="page-hero">
        <h1><i className="fa-solid fa-heart"></i> My Favorites</h1>
        <p>Your saved movies, always available offline</p>
      </div>

      {/* Actions Row */}
      <div className="fav-actions">
        {hasFavorites && (
          <button className="btn-clear" onClick={clearAllFavorites}>
            <i className="fa-solid fa-trash-can"></i> Clear All
          </button>
        )}
      </div>

      {/* Result Count */}
      {hasFavorites && (
        <div id="resultCount" className="result-count" style={{ display: 'inline-block' }}>
          {favorites.length} Saved
        </div>
      )}

      {/* Movies Grid */}
      {hasFavorites ? (
        <div id="favGrid" className="movies-grid">
          {favorites.map(fav => {
            const movie = fav;
            const isComingSoon = (movie.status || '').toLowerCase() === 'coming soon';
            const movieType = (movie.type || '').toLowerCase();
            const movieYear = movie.year || '';
            return (
              <div key={fav.movieId} className="fav-card-wrapper">
                <a
                  href={`/watch?reward=${fav.movieId}`}
                  onClick={(e) => { e.preventDefault(); history.pushState(null, '', `/watch?reward=${fav.movieId}`); window.dispatchEvent(new PopStateEvent('popstate')); }}
                  className="list-card-link"
                  style={isComingSoon ? { opacity: '0.45', filter: 'grayscale(60%)' } : {}}
                >
                  <div className="list-card">
                    <div className="list-card-img-wrapper">
                      <img
                        className="list-card-img"
                        src={getImageUrl(movie)}
                        alt={movie.title || 'Movie'}
                        loading="lazy"
                      />
                      <span className="list-card-badge">{movie.year || '-'}</span>
                      {isComingSoon && <span className="coming-soon-badge">Coming Soon</span>}
                    </div>
                    <div className="list-card-details">
                      <h3 className="list-card-title">{movie.title || 'Unknown'}</h3>
                      <p className="list-card-info">
                        {movieType ? movieType.charAt(0).toUpperCase() + movieType.slice(1) : '-'}
                      </p>
                    </div>
                  </div>
                </a>
                <button
                  className="fav-remove-btn"
                  title="Remove from Favorites"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeFromFavorites && removeFromFavorites(fav.movieId);
                  }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div id="emptyState" className="empty-state" style={{ display: 'flex' }}>
          <i className="fa-regular fa-heart"></i>
          <h2>No Favorites Yet</h2>
          <p>Start adding movies to your favorites by tapping the ❤️ button on any movie page.</p>
          <a href="/home" onClick={(e) => { e.preventDefault(); history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }}><i className="fa-solid fa-house"></i> Browse Movies</a>
        </div>
      )}
    </>
  );
}
