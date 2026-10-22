import React from 'react';
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

export default function MovieUnlockModal() {
  const { previewMovie, closeMoviePreview, triggerRewardedAd, isAdLoading } = useApp();

  if (!previewMovie) return null;

  const isComingSoon = previewMovie.status && previewMovie.status.toLowerCase() === 'coming soon';
  const movieType = (previewMovie.type || '').toLowerCase();
  const normalizedType = movieType ? movieType.charAt(0).toUpperCase() + movieType.slice(1) : 'Movie';
  const posterUrl = getMovieImageUrl(previewMovie);

  return (
    <div className="glass-modal-backdrop" onClick={closeMoviePreview}>
      <div className="glass-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Top Header bar with Close Button */}
        <div className="glass-modal-header">
          <div className="glass-modal-title-group">
            <span className="glass-badge-type">
              <i className="fa-solid fa-clapperboard" style={{ marginRight: '5px', fontSize: '9px' }}></i>
              {normalizedType}
            </span>
            <span className="glass-badge-year">
              <i className="fa-solid fa-calendar-days" style={{ marginRight: '4px', fontSize: '9px', opacity: 0.85 }}></i>
              {previewMovie.year || '2026'}
            </span>
          </div>
          <button 
            className="glass-modal-close-btn" 
            onClick={closeMoviePreview}
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Full Portrait Poster Section */}
        <div className="glass-poster-section">
          <div className="glass-portrait-frame">
            <img 
              src={posterUrl} 
              alt={previewMovie.title} 
              className="glass-portrait-img"
            />
            {isComingSoon && <span className="glass-badge-cs">Coming Soon</span>}
          </div>
        </div>

        {/* Modal Info Content (Compact, no scroll) */}
        <div className="glass-modal-content">
          <h2 className="glass-movie-title">{previewMovie.title}</h2>
          
          <div className="glass-meta-pills">
            <span className="glass-pill">
              <i className="fa-solid fa-language"></i> {previewMovie.language || 'Tamil'}
            </span>
            {previewMovie.duration && (
              <span className="glass-pill">
                <i className="fa-regular fa-clock"></i> {previewMovie.duration}
              </span>
            )}
            <span className="glass-pill highlight">
              <i className="fa-solid fa-film"></i> HD 1080p
            </span>
          </div>

          {/* Sponsor Access Glass Box */}
          <div className="glass-policy-box">
            <div className="glass-policy-icon-wrap">
              <i className="fa-solid fa-shield-halved glass-policy-icon"></i>
            </div>
            <div className="glass-policy-text">
              <strong><i className="fa-solid fa-sparkles" style={{ color: '#10b981', marginRight: '5px' }}></i> Sponsor Access</strong>
              <span>Watch a short sponsor message to unlock full movie streaming &amp; downloads.</span>
            </div>
          </div>

          {/* Fully Visible Action Buttons */}
          <div className="glass-modal-actions">
            {isComingSoon ? (
              <button className="btn-glass-action disabled" disabled>
                <i className="fa-solid fa-lock"></i> Coming Soon
              </button>
            ) : (
              <button 
                className="btn-glass-action primary" 
                onClick={() => triggerRewardedAd(previewMovie)}
                disabled={isAdLoading}
              >
                {isAdLoading ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Preparing Ad...</>
                ) : (
                  <><i className="fa-solid fa-play"></i> Watch Ad to Unlock Movie</>
                )}
              </button>
            )}

            <button className="btn-glass-action secondary" onClick={closeMoviePreview}>
              <i className="fa-solid fa-arrow-left"></i> Cancel / Go Back
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
