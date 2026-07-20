import React, { useEffect } from 'react';
import { useApp } from '../AppContext';

function getMovieImageUrl(movie) {
  if (!movie) return '';
  const img = movie.image || '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const type = (movie.type || '').toLowerCase();
  const year = movie.year || '';
  if (img && type && year) return `/src/images/${type}/${year}/${img}`;
  return img;
}

export default function WatchView({ movieId }) {
  const { movies, favorites, toggleFavorite, recordHistory } = useApp();
  const movie = movies.find(m => String(m.id) === String(movieId));

  useEffect(() => {
    if (movie) recordHistory(movie);
  }, [movie]);

  if (!movieId) {
    return (
      <div className="not-box">
        <i className="fa-solid fa-circle-exclamation"></i>
        <p className="note">No movie selected. Go back to <a href="/home" onClick={(e) => { e.preventDefault(); history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }} style={{ color: 'var(--accent)' }}>Home</a>.</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="not-box">
        <i className="fa-solid fa-circle-exclamation"></i>
        <p className="note">Movie not found. Go back to <a href="/home" onClick={(e) => { e.preventDefault(); history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }} style={{ color: 'var(--accent)' }}>Home</a>.</p>
      </div>
    );
  }

  const isFavorite = favorites.some(fav => String(fav.movieId) === String(movie.id));
  const isComingSoon = movie.status && movie.status.toLowerCase() === 'coming soon';

  const handleFavoriteClick = () => toggleFavorite(movie);

  const handleShareClick = () => {
    const message =
      `VIP Movies - Watch Free Tamil & Hollywood Movies 🎬\n\n` +
      `Watch ${movie.title} (${movie.year}) on VIP Movies!\n\n` +
      `Play Store:\nhttps://play.google.com/store/apps/details?id=com.vipmovies.tvkmovies`;
    if (navigator.share) {
      navigator.share({ text: message }).catch(() => { });
    } else {
      window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank");
    }
  };

  const p460Link = movie.p360 || movie.p460 || '#';
  const p720Link = movie.p720 || '#';
  const p1080Link = movie.p1080 || '#';

  return (
    <>
      {/* Coming Soon Overlay */}
      {isComingSoon && (
        <div className="coming-soon-overlay">
          <div className="coming-soon-box">
            <i className="fa-solid fa-lock" style={{ fontSize: '48px', color: 'var(--accent)', marginBottom: '16px' }}></i>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Coming Soon</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              This movie is not yet available for streaming.
            </p>
            <a href="/home" onClick={(e) => { e.preventDefault(); history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="cs-home-btn">
              <i className="fa-solid fa-house"></i> Back to Home
            </a>
          </div>
        </div>
      )}

      <div style={isComingSoon ? { opacity: 0.5, filter: 'grayscale(40%)', pointerEvents: 'none', userSelect: 'none' } : {}}>

        {/* ── TOP BAR: WhatsApp share (left) + Favorite button (right) ── */}
        <div className="watch-topbar">
          <button className="btn-whatsapp-share" onClick={handleShareClick}>
            <i className="fa-brands fa-whatsapp"></i> Share on WhatsApp
          </button>

          <button
            id="favBtn"
            className={`btn-fav-watch${isFavorite ? ' active' : ''}`}
            onClick={handleFavoriteClick}
          >
            <i className={isFavorite ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} id="favIcon"></i>
            <span id="favLabel">{isFavorite ? 'Saved' : 'Favorite'}</span>
          </button>
        </div>

        {/* ── POSTER: centered and big ── */}
        <div className="watch-poster-wrap">
          <img
            id="image"
            className="watch-poster"
            src={getMovieImageUrl(movie)}
            alt={movie.title}
          />
        </div>

        {/* ── TITLE ── */}
        <h1 className="movie-title" id="title">{movie.title}</h1>

        {/* ── META GRID ── */}
        <div className="meta-grid">
          <div className="meta-item">
            <span className="meta-label">Language:</span>
            <span id="language"> {movie.language || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Release:</span>
            <span id="release"> {movie.release || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Duration:</span>
            <span id="duration"> {movie.duration || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Director:</span>
            <span id="director"> {movie.director || '-'}</span>
          </div>
        </div>

        {/* Starring full-width */}
        <div className="meta-item meta-item-full">
          <span className="meta-label">Starring:</span>
          <span id="starring"> {movie.starring || '-'}</span>
        </div>

        {/* ── ACTION BUTTONS ── */}
        <div className="action-buttons">
          <a className="btn-watch p460" href={p460Link}>
            <i className="fa-solid fa-circle-play"></i> Watch Now
          </a>
          <a className="btn-download p460" href={p460Link} target="_blank" rel="noopener noreferrer">
            <i className="fa-solid fa-circle-down"></i> Direct Download
          </a>
        </div>

        {/* ── STORYLINE ── */}
        <div className="story-container">
          <h3 className="story-title">Storyline / Overview</h3>
          <p className="story-text" id="story">{movie.story || 'No description available.'}</p>
        </div>

        {/* ── QUALITY BOX ── */}
        <div className="quality-box">
          <h3 className="quality-header">Watch &amp; Download (Select Quality)</h3>
          <div className="quality-list">

            {/* 460p / SD */}
            <div className="quality-row">
              <div className="quality-info">
                <i className="fa-solid fa-film"></i>
                <span className="quality-label">Movie Quality - 460p (SD)</span>
              </div>
              <div className="quality-actions">
                <a className="quality-btn-play p460" href={p460Link}><i className="fa-solid fa-play"></i></a>
                <a className="quality-btn-down p460" href={p460Link} target="_blank" rel="noopener noreferrer"><i className="fa-solid fa-download"></i></a>
              </div>
            </div>

            {/* 720p / HD */}
            <div className="quality-row">
              <div className="quality-info">
                <i className="fa-solid fa-video"></i>
                <span className="quality-label">Movie Quality - 720p (HD)</span>
              </div>
              <div className="quality-actions">
                <a className="quality-btn-play p720" href={p720Link}><i className="fa-solid fa-play"></i></a>
                <a className="quality-btn-down p720" href={p720Link} target="_blank" rel="noopener noreferrer"><i className="fa-solid fa-download"></i></a>
              </div>
            </div>

            {/* 1080p / FHD */}
            <div className="quality-row">
              <div className="quality-info">
                <i className="fa-solid fa-tv"></i>
                <span className="quality-label">Movie Quality - 1080p (Full HD)</span>
              </div>
              <div className="quality-actions">
                <a className="quality-btn-play p1080" href={p1080Link}><i className="fa-solid fa-play"></i></a>
                <a className="quality-btn-down p1080" href={p1080Link} target="_blank" rel="noopener noreferrer"><i className="fa-solid fa-download"></i></a>
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
