import React, { useState } from 'react';

/**
 * PlayerAdBreakOverlay
 * Professional In-Player Sponsor Break Overlay — Yellow Theme
 */
export default function PlayerAdBreakOverlay({
  isOpen = false,
  countdownSeconds = 0,
  showWarningPill = false,
  adsConfig = {},
  movieId = '',
  currentTime = 0,
  currentQuality = 'auto',
  isHorizontal = false,
  onWatchAd,
  onDismissWarning,
  onKeepPaused
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  const uiCopy = adsConfig?.uiCopy || {};
  const warningText = (uiCopy.warningText || 'Ad break in {sec}s').replace('{sec}', countdownSeconds);
  const modalTitle = uiCopy.modalTitle || 'Short Break';
  const modalDesc = (uiCopy.modalDescription || 'Watch a quick ad to unlock {min} min of free streaming.')
    .replace('{min}', adsConfig?.rewardDurationMinutes || 25);
  const buttonText = uiCopy.buttonText || 'Watch & Continue';

  const handleTriggerAd = () => {
    setIsProcessing(true);
    if (onWatchAd) onWatchAd();
  };

  return (
    <>
      {/* ── WARNING PILL ── */}
      {showWarningPill && !isOpen && (
        <div className={`vip-player-warning-pill animate-slide-up ${isHorizontal ? 'is-horizontal' : ''}`}>
          <div className="vip-pill-icon-wrap">
            <span className="vip-pill-timer">{countdownSeconds}</span>
          </div>
          <span className="vip-pill-text">{warningText}</span>
          <div className="vip-pill-actions">
            <button
              type="button"
              className="vip-pill-btn-action"
              onClick={handleTriggerAd}
              title="Take break now"
            >
              Watch Now
            </button>
            {onDismissWarning && (
              <button
                type="button"
                className="vip-pill-btn-close"
                onClick={onDismissWarning}
                title="Dismiss"
                aria-label="Dismiss warning"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── BREAK MODAL ── */}
      {isOpen && (
        <div
          className={`vip-player-ad-backdrop animate-fade-in ${isHorizontal ? 'is-horizontal' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`vip-player-ad-card animate-scale-up ${isHorizontal ? 'is-horizontal' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── TOP ROW: Badge + Close ── */}
            <div className="vip-ad-card-top-row">
              <div className="vip-ad-glass-tag">
                <i className="fa-solid fa-star"></i>
                <span>VIP Streaming</span>
              </div>
              {onKeepPaused && (
                <button
                  type="button"
                  className="vip-ad-close-corner-btn"
                  onClick={onKeepPaused}
                  title="Close"
                  aria-label="Close"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* ── BODY ── */}
            <div className="vip-ad-card-body">

              {/* Left / Top column */}
              <div className="vip-ad-card-info-col">

                {/* Icon + Title + Desc */}
                <div className="vip-ad-header-flex">
                  <div className="vip-ad-icon-halo">
                    <i className="fa-solid fa-clapperboard"></i>
                  </div>
                  <div className="vip-ad-header-text">
                    <h3 className="vip-ad-modal-title">{modalTitle}</h3>
                    <p className="vip-ad-modal-desc">{modalDesc}</p>
                  </div>
                </div>

                {/* Feature chips */}
                <div className="vip-ad-feature-box">
                  <div className="vip-ad-feature-item">
                    <i className="fa-solid fa-circle-check vip-ad-feat-icon"></i>
                    <span>Resumes at the same scene</span>
                  </div>
                  <div className="vip-ad-feature-item">
                    <i className="fa-solid fa-bolt vip-ad-feat-icon"></i>
                    <span>+{adsConfig?.rewardDurationMinutes || 25} min ad-free streaming</span>
                  </div>
                  <div className="vip-ad-feature-item">
                    <i className="fa-solid fa-film vip-ad-feat-icon"></i>
                    <span>Free 1080p HD quality</span>
                  </div>
                </div>
              </div>

              {/* Right / Bottom column */}
              <div className="vip-ad-card-actions-col">
                <div className="vip-ad-modal-actions">

                  {/* Primary CTA */}
                  <button
                    type="button"
                    className="vip-ad-btn-primary"
                    onClick={handleTriggerAd}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        Loading...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-play"></i>
                        {buttonText}
                      </>
                    )}
                  </button>

                  {/* Secondary */}
                  <div className="vip-ad-modal-subactions">
                    {onKeepPaused && (
                      <button
                        type="button"
                        className="vip-ad-btn-secondary"
                        onClick={onKeepPaused}
                        disabled={isProcessing}
                      >
                        Pause for now
                      </button>
                    )}
                  </div>
                </div>

                {/* Footer note */}
                <div className="vip-ad-modal-footer">
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>Free streaming · Supported by sponsors</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
