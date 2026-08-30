import React from 'react';

export default function PlayerErrorOverlay({
  error,
  isOffline,
  isEnded,
  movie,
  onRetry,
  onChangeQuality,
  onReplay,
  onBackToDetails
}) {
  if (isOffline) {
    return (
      <div className="vip-player-state-overlay error">
        <div className="vip-state-card">
          <div className="vip-state-icon offline">
            <i className="fa-solid fa-wifi"></i>
          </div>
          <h3 className="vip-state-title">Connection Lost</h3>
          <p className="vip-state-desc">
            Please check your internet connection. Attempting to reconnect automatically...
          </p>
          <div className="vip-state-actions">
            <button type="button" className="admin-btn primary sm" onClick={onRetry}>
              <i className="fa-solid fa-rotate-right"></i> Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="vip-player-state-overlay error">
        <div className="vip-state-card">
          <div className="vip-state-icon error">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 className="vip-state-title">Unable to Play Video</h3>
          <p className="vip-state-desc">
            {error.message || 'Something went wrong while loading this video stream. Please check your connection or choose another quality.'}
          </p>
          <div className="vip-state-actions">
            <button type="button" className="admin-btn primary sm" onClick={onRetry}>
              <i className="fa-solid fa-rotate-right"></i> Retry
            </button>
            {onChangeQuality && (
              <button type="button" className="admin-btn secondary sm" onClick={onChangeQuality}>
                <i className="fa-solid fa-sliders"></i> Change Quality
              </button>
            )}
            {onBackToDetails && (
              <button type="button" className="admin-btn text sm" onClick={onBackToDetails}>
                <i className="fa-solid fa-arrow-left"></i> Go Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isEnded) {
    return (
      <div className="vip-player-state-overlay ended">
        <div className="vip-state-card ended">
          <div className="vip-state-icon ended">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <h3 className="vip-state-title">{movie?.title || 'Movie Completed'}</h3>
          <p className="vip-state-desc">
            Thanks for watching on VIP Movies!
          </p>
          <div className="vip-state-actions">
            <button type="button" className="admin-btn primary sm" onClick={onReplay}>
              <i className="fa-solid fa-rotate-left"></i> Replay
            </button>
            {onBackToDetails && (
              <button type="button" className="admin-btn secondary sm" onClick={onBackToDetails}>
                <i className="fa-solid fa-film"></i> Movie Details
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
