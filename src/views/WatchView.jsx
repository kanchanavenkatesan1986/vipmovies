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

/**
 * Automatically finds file size from URL/filename or estimates from duration
 */
function getQualityFileSize(rawUrl, durationStr, quality) {
  if (!rawUrl || rawUrl === '#' || !rawUrl.trim()) return '';

  // 1. Try to find size directly in filename or URL: e.g. __950_MB_, (2.8_GB), _450MB, 1.4GB
  const regex = /(?:__|_|\(|\b)(\d+(?:\.\d+)?)\s*[_]?(GB|MB|KB)(?:__|_|\)|\b)/i;
  const match = rawUrl.match(regex);
  if (match) {
    return `${match[1]} ${match[2].toUpperCase()}`;
  }

  // 2. Fallback to estimation based on duration
  let totalMinutes = 115;
  if (durationStr) {
    const parts = String(durationStr).match(/(\d+)\s*:\s*(\d+)(?:\s*:\s*(\d+))?/);
    if (parts) {
      if (parts[3] !== undefined) {
        totalMinutes = parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
      } else {
        totalMinutes = parseInt(parts[1], 10);
      }
    }
  }

  if (quality === '460p') {
    return `${Math.round(totalMinutes * 3.6)} MB`;
  } else if (quality === '720p') {
    const mb = Math.round(totalMinutes * 8.0);
    return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
  } else if (quality === '1080p') {
    const mb = Math.round(totalMinutes * 17.5);
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return '950 MB';
}

export default function WatchView({ movieId }) {
  const { movies, favorites, toggleFavorite, recordHistory, isMovieUnlocked } = useApp();
  const movie = movies.find(m => String(m.id || m.movieId).trim() === String(movieId || '').trim());

  useEffect(() => {
    if (movie && isMovieUnlocked(movie.id)) {
      recordHistory(movie);
    }
  }, [movie, isMovieUnlocked, recordHistory]);

  if (!movieId) {
    return (
      <div className="not-box">
        <i className="fa-solid fa-circle-exclamation"></i>
        <p className="note">No movie selected. Go back to <a href="/home" onClick={(e) => { e.preventDefault(); window.history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }} style={{ color: 'var(--accent)' }}>Home</a>.</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="not-box">
        <i className="fa-solid fa-circle-exclamation"></i>
        <p className="note">Movie not found. Go back to <a href="/home" onClick={(e) => { e.preventDefault(); window.history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }} style={{ color: 'var(--accent)' }}>Home</a>.</p>
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

  const navigateToPlayer = (quality = 'auto') => {
    const id = movie.id || movie.movieId;
    window.history.pushState(null, '', `/player?reward=${encodeURIComponent(id)}&quality=${encodeURIComponent(quality)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Direct download links
  const p460Link = movie.p360 || movie.p460 || '';
  const p720Link = movie.p720 || '';
  const p1080Link = movie.p1080 || '';

  const has460 = Boolean(p460Link && p460Link !== '#' && p460Link.trim() !== '');
  const has720 = Boolean(p720Link && p720Link !== '#' && p720Link.trim() !== '');
  const has1080 = Boolean(p1080Link && p1080Link !== '#' && p1080Link.trim() !== '');

  const size460 = has460 ? getQualityFileSize(p460Link, movie.duration, '460p') : '';
  const size720 = has720 ? getQualityFileSize(p720Link, movie.duration, '720p') : '';
  const size1080 = has1080 ? getQualityFileSize(p1080Link, movie.duration, '1080p') : '';

  const directDownloadLink = has1080 ? p1080Link : has720 ? p720Link : has460 ? p460Link : '#';

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
            <a href="/home" onClick={(e) => { e.preventDefault(); window.history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="cs-home-btn">
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

        {/* ── ACTION BUTTONS: Watch Now opens separate player page, Direct Download downloads ── */}
        <div className="action-buttons">
          <button
            type="button"
            className="btn-watch p460"
            onClick={() => navigateToPlayer('auto')}
            style={{ cursor: 'pointer', border: 'none' }}
          >
            <i className="fa-solid fa-circle-play"></i> Watch Now
          </button>
          <a className="btn-download p460" href={directDownloadLink} target="_blank" rel="noopener noreferrer">
            <i className="fa-solid fa-circle-down"></i> Direct Download
          </a>
        </div>

        {/* ── STORYLINE ── */}
        <div className="story-container">
          <h3 className="story-title">Storyline / Overview</h3>
          <p className="story-text" id="story">{movie.story || 'No description available.'}</p>
        </div>

        {/* ── QUALITY BOX: Old simple style with Movie Name - Quality - Size ── */}
        <div className="quality-box">
          <h3 className="quality-header">Watch &amp; Download (Select Quality)</h3>
          <div className="quality-list">

            {/* 460p / SD */}
            <div className="quality-row" style={!has460 ? { opacity: 0.6 } : {}}>
              <div className="quality-info">
                <i className="fa-solid fa-film"></i>
                <span className="quality-label">
                  {movie.title} - 460p (SD){size460 ? ` - ${size460}` : (has460 ? '' : ' - Not Available')}
                </span>
              </div>
              <div className="quality-actions">
                {has460 ? (
                  <>
                    <button
                      type="button"
                      className="quality-btn-play p460"
                      title="Play 460p in Player"
                      onClick={() => navigateToPlayer('460p')}
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-play"></i>
                    </button>
                    <a className="quality-btn-down p460" href={p460Link} target="_blank" rel="noopener noreferrer" title="Download 460p">
                      <i className="fa-solid fa-download"></i>
                    </a>
                  </>
                ) : (
                  <span style={{ fontSize: '11px', color: '#9ca3af', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                    Unavailable
                  </span>
                )}
              </div>
            </div>

            {/* 720p / HD */}
            <div className="quality-row" style={!has720 ? { opacity: 0.6 } : {}}>
              <div className="quality-info">
                <i className="fa-solid fa-video"></i>
                <span className="quality-label">
                  {movie.title} - 720p (HD){size720 ? ` - ${size720}` : (has720 ? '' : ' - Not Available')}
                </span>
              </div>
              <div className="quality-actions">
                {has720 ? (
                  <>
                    <button
                      type="button"
                      className="quality-btn-play p720"
                      title="Play 720p in Player"
                      onClick={() => navigateToPlayer('720p')}
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-play"></i>
                    </button>
                    <a className="quality-btn-down p720" href={p720Link} target="_blank" rel="noopener noreferrer" title="Download 720p">
                      <i className="fa-solid fa-download"></i>
                    </a>
                  </>
                ) : (
                  <span style={{ fontSize: '11px', color: '#9ca3af', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                    Unavailable
                  </span>
                )}
              </div>
            </div>

            {/* 1080p / FHD */}
            <div className="quality-row" style={!has1080 ? { opacity: 0.6 } : {}}>
              <div className="quality-info">
                <i className="fa-solid fa-tv"></i>
                <span className="quality-label">
                  {movie.title} - 1080p (Full HD){size1080 ? ` - ${size1080}` : (has1080 ? '' : ' - Not Available')}
                </span>
              </div>
              <div className="quality-actions">
                {has1080 ? (
                  <>
                    <button
                      type="button"
                      className="quality-btn-play p1080"
                      title="Play 1080p in Player"
                      onClick={() => navigateToPlayer('1080p')}
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-play"></i>
                    </button>
                    <a className="quality-btn-down p1080" href={p1080Link} target="_blank" rel="noopener noreferrer" title="Download 1080p">
                      <i className="fa-solid fa-download"></i>
                    </a>
                  </>
                ) : (
                  <span style={{ fontSize: '11px', color: '#9ca3af', padding: '4px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                    Unavailable
                  </span>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
