import React, { useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { fetchExactVideoSize, getDownloadUrl } from '../utils/mediaUtils';

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

  // Automatic routing: if record is actually a series, redirect to watch-series.html
  useEffect(() => {
    if (movie && (movie.contentType === 'series' || (Array.isArray(movie.episodes) && movie.episodes.length > 0))) {
      const id = movie.id || movie.movieId;
      window.history.replaceState(null, '', `/watch-series.html?id=${encodeURIComponent(id)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [movie]);

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
    const playerUrl = `/player?reward=${encodeURIComponent(id)}&quality=${encodeURIComponent(quality)}`;
    const isAndroid = typeof window !== 'undefined' && (
      window.Android !== undefined ||
      window.androidBridge !== undefined ||
      window.location.search.includes('source=app') ||
      (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('wv'))
    );
    if (isAndroid) {
      window.location.href = playerUrl;
    } else {
      window.history.pushState(null, '', playerUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Direct download links
  const p460Link = movie.p360 || movie.p460 || '';
  const p720Link = movie.p720 || '';
  const p1080Link = movie.p1080 || '';

  const has460 = Boolean(p460Link && p460Link !== '#' && p460Link.trim() !== '');
  const has720 = Boolean(p720Link && p720Link !== '#' && p720Link.trim() !== '');
  const has1080 = Boolean(p1080Link && p1080Link !== '#' && p1080Link.trim() !== '');

  const [exactSizes, setExactSizes] = useState({});

  useEffect(() => {
    let isMounted = true;
    [
      { key: '460', link: p460Link },
      { key: '720', link: p720Link },
      { key: '1080', link: p1080Link }
    ].forEach(({ key, link }) => {
      if (link && link.startsWith('http')) {
        fetchExactVideoSize(link).then(sz => {
          if (isMounted && sz) {
            setExactSizes(prev => ({ ...prev, [key]: sz }));
          }
        });
      }
    });
    return () => { isMounted = false; };
  }, [p460Link, p720Link, p1080Link]);

  const size460 = exactSizes['460'] || (has460 ? getQualityFileSize(p460Link, movie.duration, '460p') : '');
  const size720 = exactSizes['720'] || (has720 ? getQualityFileSize(p720Link, movie.duration, '720p') : '');
  const size1080 = exactSizes['1080'] || (has1080 ? getQualityFileSize(p1080Link, movie.duration, '1080p') : '');

  const rawDownloadLink = has1080 ? p1080Link : has720 ? p720Link : has460 ? p460Link : '#';
  const directDownloadLink = getDownloadUrl(rawDownloadLink);

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
            <span className="meta-label"><i className="fa-solid fa-language"></i> Language:</span>
            <span id="language"> {movie.language || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label"><i className="fa-regular fa-calendar-days"></i> Release:</span>
            <span id="release"> {movie.release || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label"><i className="fa-regular fa-clock"></i> Duration:</span>
            <span id="duration"> {movie.duration || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label"><i className="fa-solid fa-clapperboard"></i> Director:</span>
            <span id="director"> {movie.director || '-'}</span>
          </div>
        </div>

        {/* Starring full-width */}
        <div className="meta-item meta-item-full">
          <span className="meta-label"><i className="fa-solid fa-users"></i> Starring:</span>
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
          <h3 className="story-title"><i className="fa-solid fa-book-open"></i> Storyline / Overview</h3>
          <p className="story-text" id="story">{movie.story || 'No description available.'}</p>
        </div>

        {/* ── QUALITY BOX: 3 Distinct Quality Options (460p SD, 720p HD, 1080p FHD) ── */}
        <div className="quality-box">
          <h3 className="quality-header">
            <i className="fa-solid fa-sliders"></i> Watch &amp; Download (Select Quality)
          </h3>
          <div className="quality-list">

            {/* 460p / SD — Emerald Green Theme */}
            <div className={`quality-row quality-row-460${!has460 ? ' disabled' : ''}`}>
              <div className="quality-info">
                <span className="quality-res-badge res-460">
                  <i className="fa-solid fa-film"></i> 460p SD
                </span>
                <div className="quality-text-group">
                  <span className="quality-label">{movie.title}</span>
                  {size460 && <span className="quality-size-badge"><i className="fa-solid fa-hard-drive"></i> {size460}</span>}
                  {!has460 && <span className="quality-size-badge unavailable">Not Available</span>}
                </div>
              </div>
              <div className="quality-actions">
                {has460 ? (
                  <>
                    <button
                      type="button"
                      className="quality-btn-play p460"
                      title="Play 460p in Player"
                      onClick={() => navigateToPlayer('460p')}
                    >
                      <i className="fa-solid fa-play"></i>
                      <span>Play</span>
                    </button>
                    <a
                      className="quality-btn-down p460"
                      href={getDownloadUrl(p460Link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Download 460p"
                    >
                      <i className="fa-solid fa-download"></i>
                      <span>Download</span>
                    </a>
                  </>
                ) : (
                  <span className="quality-unavailable-tag">Unavailable</span>
                )}
              </div>
            </div>

            {/* 720p / HD — Electric Sky Blue Theme */}
            <div className={`quality-row quality-row-720${!has720 ? ' disabled' : ''}`}>
              <div className="quality-info">
                <span className="quality-res-badge res-720">
                  <i className="fa-solid fa-video"></i> 720p HD
                </span>
                <div className="quality-text-group">
                  <span className="quality-label">{movie.title}</span>
                  {size720 && <span className="quality-size-badge"><i className="fa-solid fa-hard-drive"></i> {size720}</span>}
                  {!has720 && <span className="quality-size-badge unavailable">Not Available</span>}
                </div>
              </div>
              <div className="quality-actions">
                {has720 ? (
                  <>
                    <button
                      type="button"
                      className="quality-btn-play p720"
                      title="Play 720p in Player"
                      onClick={() => navigateToPlayer('720p')}
                    >
                      <i className="fa-solid fa-play"></i>
                      <span>Play</span>
                    </button>
                    <a
                      className="quality-btn-down p720"
                      href={getDownloadUrl(p720Link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Download 720p"
                    >
                      <i className="fa-solid fa-download"></i>
                      <span>Download</span>
                    </a>
                  </>
                ) : (
                  <span className="quality-unavailable-tag">Unavailable</span>
                )}
              </div>
            </div>

            {/* 1080p / Full HD — Vibrant Gold Theme */}
            <div className={`quality-row quality-row-1080${!has1080 ? ' disabled' : ''}`}>
              <div className="quality-info">
                <span className="quality-res-badge res-1080">
                  <i className="fa-solid fa-tv"></i> 1080p FHD
                </span>
                <div className="quality-text-group">
                  <span className="quality-label">{movie.title}</span>
                  {size1080 && <span className="quality-size-badge"><i className="fa-solid fa-hard-drive"></i> {size1080}</span>}
                  {!has1080 && <span className="quality-size-badge unavailable">Not Available</span>}
                </div>
              </div>
              <div className="quality-actions">
                {has1080 ? (
                  <>
                    <button
                      type="button"
                      className="quality-btn-play p1080"
                      title="Play 1080p in Player"
                      onClick={() => navigateToPlayer('1080p')}
                    >
                      <i className="fa-solid fa-play"></i>
                      <span>Play</span>
                    </button>
                    <a
                      className="quality-btn-down p1080"
                      href={getDownloadUrl(p1080Link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Download 1080p"
                    >
                      <i className="fa-solid fa-download"></i>
                      <span>Download</span>
                    </a>
                  </>
                ) : (
                  <span className="quality-unavailable-tag">Unavailable</span>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
