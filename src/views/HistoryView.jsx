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

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 7)  return d + 'd ago';
  return new Date(ts).toLocaleDateString();
}

export default function HistoryView() {
  const { history, clearAllHistory } = useApp();

  const hasHistory = history && history.length > 0;

  return (
    <>
      {/* Hero Banner */}
      <div className="page-hero hist-hero">
        <h1><i className="fa-solid fa-clock-rotate-left"></i> Watch History</h1>
        <p>Your recently watched movies — always available offline</p>
      </div>

      {/* Actions Row */}
      <div className="hist-actions">
        {hasHistory && (
          <button className="btn-clear" onClick={clearAllHistory}>
            <i className="fa-solid fa-trash-can"></i> Clear History
          </button>
        )}
      </div>

      {/* Result Count */}
      {hasHistory && (
        <div id="resultCount" className="result-count hist-count" style={{ display: 'inline-block' }}>
          {history.length} Watched
        </div>
      )}

      {/* Movies Grid */}
      {hasHistory ? (
        <div id="histGrid" className="movies-grid">
          {history.map(hist => {
            const movie = hist;
            const isComingSoon = (movie.status || '').toLowerCase() === 'coming soon';
            const movieType = (movie.type || '').toLowerCase();
            const movieYear = movie.year || '';
            return (
              <a
                key={hist.movieId}
                href={`/watch?reward=${hist.movieId}`}
                onClick={(e) => { e.preventDefault(); window.location.href = `/watch?reward=${hist.movieId}`; }}
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
                    {hist.watchedAt && (
                      <p className="hist-time">
                        <i className="fa-regular fa-clock" style={{ fontSize: '10px' }}></i> {timeAgo(hist.watchedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div id="emptyState" className="empty-state" style={{ display: 'flex' }}>
          <i className="fa-regular fa-clock"></i>
          <h2>No Watch History</h2>
          <p>Movies you watch will appear here automatically. Start exploring!</p>
          <a href="/home" onClick={(e) => { e.preventDefault(); history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }}><i className="fa-solid fa-house"></i> Browse Movies</a>
        </div>
      )}
    </>
  );
}
