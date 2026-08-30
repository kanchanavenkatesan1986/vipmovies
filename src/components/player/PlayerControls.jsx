import React, { useState } from 'react';
import PlayerSeekBar from './PlayerSeekBar';
import { formatPlayerTime } from './playerUtils';

export default function PlayerControls({
  movie,
  isVisible = true,
  isPlaying = false,
  isBuffering = false,
  currentTime = 0,
  duration = 0,
  bufferedRanges = [],
  volume = 1.0,
  muted = false,
  playbackRate = 1.0,
  currentQuality = 'auto',
  currentSubtitle = 'off',
  isTheatreMode = false,
  isFullscreen = false,
  isPipSupported = false,
  isPipActive = false,
  onTogglePlay,
  onSeek,
  onSeekStart,
  onSeekEnd,
  onSeekRel,
  onVolumeChange,
  onToggleMute,
  onOpenSettings,
  onToggleTheatre,
  onToggleFullscreen,
  onTogglePip,
  onBack,
  disabled = false
}) {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  return (
    <div
      className={`vip-player-controls-overlay ${isVisible ? 'visible' : 'hidden'} ${disabled ? 'disabled' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target.classList.contains('vip-controls-center')) {
          onTogglePlay();
        }
      }}
    >
      {/* ── 1. TOP BAR ── */}
      <div className="vip-controls-top">
        <div className="vip-top-left">
          {onBack && (
            <button
              type="button"
              className="vip-ctrl-btn vip-back-btn"
              onClick={onBack}
              title="Back (Esc)"
              aria-label="Back"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          )}

          <div className="vip-top-title-group">
            <h3 className="vip-top-title">{movie?.title || 'VIP Movie'}</h3>
            <div className="vip-top-meta">
              <span>{movie?.year || '2026'}</span>
              <span>•</span>
              <span>{movie?.language || 'Tamil'}</span>
              {currentQuality !== 'auto' && (
                <span className="vip-top-quality-badge">{currentQuality.toUpperCase()}</span>
              )}
            </div>
          </div>
        </div>

        <div className="vip-top-right">
          {/* Watermark */}
          <div className="vip-player-watermark">
            <span className="gold">VIP</span> MOVIES
          </div>

          {/* ↻ HORIZONTAL / ↶ EXIT BUTTON */}
          <button
            type="button"
            className={`vip-ctrl-btn vip-horizontal-btn ${isHorizontalMode ? 'active' : ''}`}
            onClick={onToggleHorizontal}
            title={isHorizontalMode ? 'Exit Horizontal Mode' : 'Rotate to Full Horizontal Screen'}
            aria-label={isHorizontalMode ? 'Exit Horizontal' : 'Horizontal Player'}
          >
            <i className={`fa-solid ${isHorizontalMode ? 'fa-arrow-rotate-left' : 'fa-rotate'}`}></i>
            <span className="vip-btn-label">
              {isHorizontalMode ? 'EXIT' : 'HORIZONTAL'}
            </span>
          </button>
        </div>
      </div>

      {/* ── 2. CENTER PLAY / BUFFERING STATE ── */}
      <div className="vip-controls-center">
        {isBuffering ? (
          <div className="vip-center-spinner">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span>Buffering...</span>
          </div>
        ) : (
          <button
            type="button"
            className={`vip-center-play-btn ${isPlaying ? 'playing' : 'paused'}`}
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause video (Space)' : 'Play video (Space)'}
          >
            <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
          </button>
        )}
      </div>

      {/* ── 3. BOTTOM CONTROL BAR ── */}
      <div className="vip-controls-bottom">
        {/* Full-width Precision Seek Bar */}
        <PlayerSeekBar
          currentTime={currentTime}
          duration={duration}
          bufferedRanges={bufferedRanges}
          onSeek={onSeek}
          onSeekStart={onSeekStart}
          onSeekEnd={onSeekEnd}
          disabled={disabled}
        />

        <div className="vip-bottom-row">
          {/* Left Controls */}
          <div className="vip-ctrl-group left">
            {/* Play/Pause */}
            <button
              type="button"
              className="vip-ctrl-btn"
              onClick={onTogglePlay}
              title={isPlaying ? 'Pause (Space / K)' : 'Play (Space / K)'}
            >
              <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>

            {/* Quick 10s Rewind */}
            <button
              type="button"
              className="vip-ctrl-btn"
              onClick={() => onSeekRel && onSeekRel(-10)}
              title="Rewind 10 seconds (←)"
            >
              <i className="fa-solid fa-rotate-left"></i>
            </button>

            {/* Quick 10s Forward */}
            <button
              type="button"
              className="vip-ctrl-btn"
              onClick={() => onSeekRel && onSeekRel(10)}
              title="Forward 10 seconds (→)"
            >
              <i className="fa-solid fa-rotate-right"></i>
            </button>

            {/* Volume Control with hover slider */}
            <div
              className="vip-volume-wrap"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                type="button"
                className="vip-ctrl-btn"
                onClick={onToggleMute}
                title={muted || volume === 0 ? 'Unmute (M)' : 'Mute (M)'}
              >
                <i
                  className={`fa-solid ${
                    muted || volume === 0
                      ? 'fa-volume-xmark'
                      : volume < 0.5
                      ? 'fa-volume-low'
                      : 'fa-volume-high'
                  }`}
                ></i>
              </button>

              <div className={`vip-volume-slider-box ${showVolumeSlider ? 'show' : ''}`}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={muted ? 0 : volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="vip-volume-slider"
                  aria-label="Volume Slider"
                />
              </div>
            </div>

            {/* Time Display */}
            <div className="vip-time-display">
              <span className="current">{formatPlayerTime(currentTime)}</span>
              <span className="sep">/</span>
              <span className="duration">{formatPlayerTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="vip-ctrl-group right">
            {/* Subtitles */}
            <button
              type="button"
              className={`vip-ctrl-btn ${currentSubtitle !== 'off' ? 'active' : ''}`}
              onClick={onOpenSettings}
              title="Subtitles & Captions (C)"
            >
              <i className="fa-solid fa-closed-captioning"></i>
              {currentSubtitle !== 'off' && <span className="vip-ctrl-dot"></span>}
            </button>

            {/* Speed Badge */}
            <button
              type="button"
              className="vip-ctrl-btn vip-badge-btn"
              onClick={onOpenSettings}
              title="Playback Speed"
            >
              <span>{playbackRate === 1 ? '1x' : `${playbackRate}x`}</span>
            </button>

            {/* Quality Badge */}
            <button
              type="button"
              className="vip-ctrl-btn vip-badge-btn gold"
              onClick={onOpenSettings}
              title="Video Quality"
            >
              <span>{currentQuality.toUpperCase()}</span>
            </button>

            {/* Picture in Picture */}
            {isPipSupported && (
              <button
                type="button"
                className={`vip-ctrl-btn ${isPipActive ? 'active' : ''}`}
                onClick={onTogglePip}
                title="Picture-in-Picture (P)"
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i>
              </button>
            )}

            {/* Theatre Mode (Desktop only) */}
            <button
              type="button"
              className={`vip-ctrl-btn vip-theatre-btn ${isTheatreMode ? 'active' : ''}`}
              onClick={onToggleTheatre}
              title="Theatre Mode (T)"
            >
              <i className="fa-solid fa-film"></i>
            </button>

            {/* Settings Gear */}
            <button
              type="button"
              className="vip-ctrl-btn"
              onClick={onOpenSettings}
              title="Player Settings"
            >
              <i className="fa-solid fa-gear"></i>
            </button>

            {/* ⛶ FULLSCREEN / ⛶ EXIT FULLSCREEN */}
            <button
              type="button"
              className={`vip-ctrl-btn vip-fullscreen-btn ${isFullscreen ? 'active' : ''}`}
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (F / Esc)' : 'Fullscreen (F)'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
