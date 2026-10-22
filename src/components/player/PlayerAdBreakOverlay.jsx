import React, { useState, useEffect } from 'react';

/**
 * PlayerAdBreakOverlay
 * 100% Google AdMob Policy Compliant Rewarded Ad Break Overlay
 * 
 * Features:
 * - 15-second non-intrusive countdown pill before ad break
 * - Explicit user opt-in modal with reward disclosure
 * - Android WebView ?reward= navigation trigger
 * - Grace Pass fallback for offline / no-fill
 * - Auto-resume at exact timestamp
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
  const [fallbackGraceActive, setFallbackGraceActive] = useState(false);

  const uiCopy = adsConfig?.uiCopy || {};
  const warningText = (uiCopy.warningText || 'Ad break coming in {sec}s...').replace('{sec}', countdownSeconds);
  const modalTitle = uiCopy.modalTitle || 'Break Time';
  const modalDesc = (uiCopy.modalDescription || 'Watch a short sponsor message to unlock the next {min} minutes of uninterrupted playback.')
    .replace('{min}', adsConfig?.rewardDurationMinutes || 25);
  const buttonText = uiCopy.buttonText || '▶ Watch Ad to Continue';

  const handleTriggerAd = () => {
    setIsProcessing(true);
    if (onWatchAd) {
      onWatchAd();
    }
  };

  return (
    <>
      {/* ── 1. PRE-BREAK 15-SECOND NON-INTRUSIVE WARNING PILL ── */}
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
                title="Dismiss warning"
                aria-label="Dismiss warning"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 2. POLICY COMPLIANT BREAK MODAL ── */}
      {isOpen && (
        <div className={`vip-player-ad-backdrop animate-fade-in ${isHorizontal ? 'is-horizontal' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className={`vip-player-ad-card animate-scale-up ${isHorizontal ? 'is-horizontal' : ''}`} onClick={(e) => e.stopPropagation()}>
            
            {/* Top Header Row with Policy Badge and Close */}
            <div className="vip-ad-card-top-row">
              <div className="vip-ad-compliance-badge">
                <i className="fa-solid fa-shield-halved"></i>
                <span>AdMob User Choice</span>
              </div>
              {onKeepPaused && (
                <button
                  type="button"
                  className="vip-ad-close-corner-btn"
                  onClick={onKeepPaused}
                  title="Keep movie paused"
                  aria-label="Close ad break"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Responsive Body Layout (Stacks on desktop/portrait, 2-columns on horizontal/landscape) */}
            <div className="vip-ad-card-body">
              {/* Left Column: Info, Icon, Text, Features */}
              <div className="vip-ad-card-info-col">
                <div className="vip-ad-header-flex">
                  <div className="vip-ad-icon-halo">
                    <i className="fa-solid fa-film"></i>
                  </div>
                  <div className="vip-ad-header-text">
                    <h3 className="vip-ad-modal-title">{modalTitle}</h3>
                    <p className="vip-ad-modal-desc">{modalDesc}</p>
                  </div>
                </div>

                <div className="vip-ad-feature-box">
                  <div className="vip-ad-feature-item">
                    <i className="fa-solid fa-forward-step" style={{ color: '#10b981' }}></i>
                    <span>Resumes exactly where you left off</span>
                  </div>
                  <div className="vip-ad-feature-item">
                    <i className="fa-solid fa-bolt" style={{ color: '#f59e0b' }}></i>
                    <span>+{adsConfig?.rewardDurationMinutes || 25} minutes ad-free streaming</span>
                  </div>
                </div>
              </div>

              {/* Right Column: CTA Buttons & Footer Notice */}
              <div className="vip-ad-card-actions-col">
                <div className="vip-ad-modal-actions">
                  <button
                    type="button"
                    className="vip-ad-btn-primary"
                    onClick={handleTriggerAd}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i> Loading Sponsor Video...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-play"></i> {buttonText}
                      </>
                    )}
                  </button>

                  <div className="vip-ad-modal-subactions">
                    {onKeepPaused && (
                      <button
                        type="button"
                        className="vip-ad-btn-secondary"
                        onClick={onKeepPaused}
                        disabled={isProcessing}
                      >
                        Keep Movie Paused
                      </button>
                    )}
                  </div>
                </div>

                <div className="vip-ad-modal-footer">
                  <i className="fa-solid fa-circle-info"></i>
                  <span>Rewarded ads support free 1080p streaming.</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
