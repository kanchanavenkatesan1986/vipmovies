import React, { useState } from 'react';

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const ASPECT_OPTIONS = [
  { id: 'fit', label: 'Fit (Default)', icon: 'fa-expand' },
  { id: 'fill', label: 'Fill Screen', icon: 'fa-arrows-left-right' },
  { id: '16:9', label: '16:9 Widescreen', icon: 'fa-tv' },
  { id: '4:3', label: '4:3 Classic', icon: 'fa-square' },
  { id: 'zoom', label: 'Zoom (Crop)', icon: 'fa-magnifying-glass-plus' },
  { id: 'original', label: 'Original Size', icon: 'fa-compress' }
];

export default function PlayerSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  availableQualities = [],
  currentQuality = 'auto',
  onSelectQuality,
  playbackRate = 1.0,
  onSelectSpeed,
  aspectRatio = 'fit',
  onSelectAspectRatio,
  subtitles = [],
  currentSubtitle = 'off',
  onSelectSubtitle,
  onOpenStats
}) {
  const [activeTab, setActiveTab] = useState('main'); // 'main' | 'speed' | 'quality' | 'aspect' | 'subtitles'

  if (!isOpen) return null;

  return (
    <div className="vip-settings-overlay" onClick={onClose}>
      <div className="vip-settings-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="vip-settings-header">
          {activeTab !== 'main' ? (
            <button
              type="button"
              className="vip-settings-back-btn"
              onClick={() => setActiveTab('main')}
              aria-label="Back to main settings"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          ) : (
            <i className="fa-solid fa-sliders" style={{ color: 'var(--accent, #f59e0b)' }}></i>
          )}
          <span className="vip-settings-title">
            {activeTab === 'main' && 'Player Settings'}
            {activeTab === 'speed' && 'Playback Speed'}
            {activeTab === 'quality' && 'Video Quality'}
            {activeTab === 'aspect' && 'Aspect Ratio'}
            {activeTab === 'subtitles' && 'Subtitle Customization'}
          </span>
          <button
            type="button"
            className="vip-settings-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <div className="vip-settings-body">
          {/* 1. MAIN MENU */}
          {activeTab === 'main' && (
            <div className="vip-settings-list">
              {/* Quality Row */}
              <button
                type="button"
                className="vip-settings-row-btn"
                onClick={() => setActiveTab('quality')}
              >
                <div className="vip-s-left">
                  <i className="fa-solid fa-film"></i>
                  <span>Quality</span>
                </div>
                <div className="vip-s-right">
                  <span className="vip-s-val">{currentQuality.toUpperCase()}</span>
                  <i className="fa-solid fa-chevron-right"></i>
                </div>
              </button>

              {/* Speed Row */}
              <button
                type="button"
                className="vip-settings-row-btn"
                onClick={() => setActiveTab('speed')}
              >
                <div className="vip-s-left">
                  <i className="fa-solid fa-gauge-high"></i>
                  <span>Playback Speed</span>
                </div>
                <div className="vip-s-right">
                  <span className="vip-s-val">{playbackRate === 1 ? 'Normal (1x)' : `${playbackRate}x`}</span>
                  <i className="fa-solid fa-chevron-right"></i>
                </div>
              </button>

              {/* Aspect Ratio Row */}
              <button
                type="button"
                className="vip-settings-row-btn"
                onClick={() => setActiveTab('aspect')}
              >
                <div className="vip-s-left">
                  <i className="fa-solid fa-crop-simple"></i>
                  <span>Aspect Ratio</span>
                </div>
                <div className="vip-s-right">
                  <span className="vip-s-val">{aspectRatio.toUpperCase()}</span>
                  <i className="fa-solid fa-chevron-right"></i>
                </div>
              </button>

              {/* Subtitles Row */}
              <button
                type="button"
                className="vip-settings-row-btn"
                onClick={() => setActiveTab('subtitles')}
              >
                <div className="vip-s-left">
                  <i className="fa-solid fa-closed-captioning"></i>
                  <span>Subtitles & Captions</span>
                </div>
                <div className="vip-s-right">
                  <span className="vip-s-val">{currentSubtitle === 'off' ? 'Off' : currentSubtitle.toUpperCase()}</span>
                  <i className="fa-solid fa-chevron-right"></i>
                </div>
              </button>

              {/* Autoplay Switch */}
              <div className="vip-settings-toggle-row">
                <div className="vip-s-left">
                  <i className="fa-solid fa-forward-step"></i>
                  <span>Autoplay Next Movie</span>
                </div>
                <label className="vip-switch">
                  <input
                    type="checkbox"
                    checked={settings.autoplay}
                    onChange={(e) => onUpdateSettings({ autoplay: e.target.checked })}
                  />
                  <span className="vip-slider"></span>
                </label>
              </div>

              {/* Remember Progress Switch */}
              <div className="vip-settings-toggle-row">
                <div className="vip-s-left">
                  <i className="fa-solid fa-clock-rotate-left"></i>
                  <span>Auto-Resume Position</span>
                </div>
                <label className="vip-switch">
                  <input
                    type="checkbox"
                    checked={settings.rememberPosition}
                    onChange={(e) => onUpdateSettings({ rememberPosition: e.target.checked })}
                  />
                  <span className="vip-slider"></span>
                </label>
              </div>

              {/* Stats for Nerds */}
              <button
                type="button"
                className="vip-settings-row-btn"
                onClick={() => {
                  onClose();
                  if (onOpenStats) onOpenStats();
                }}
              >
                <div className="vip-s-left">
                  <i className="fa-solid fa-chart-line"></i>
                  <span>Player Statistics</span>
                </div>
                <div className="vip-s-right">
                  <i className="fa-solid fa-arrow-up-right-from-square"></i>
                </div>
              </button>
            </div>
          )}

          {/* 2. PLAYBACK SPEED SUBMENU */}
          {activeTab === 'speed' && (
            <div className="vip-settings-options-list">
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  className={`vip-option-item ${playbackRate === spd ? 'active' : ''}`}
                  onClick={() => {
                    onSelectSpeed(spd);
                    setActiveTab('main');
                  }}
                >
                  <span>{spd === 1.0 ? '1.0x (Normal)' : `${spd}x`}</span>
                  {playbackRate === spd && <i className="fa-solid fa-check"></i>}
                </button>
              ))}
            </div>
          )}

          {/* 3. QUALITY SUBMENU */}
          {activeTab === 'quality' && (
            <div className="vip-settings-options-list">
              <button
                type="button"
                className={`vip-option-item ${currentQuality === 'auto' ? 'active' : ''}`}
                onClick={() => {
                  onSelectQuality('auto');
                  setActiveTab('main');
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span>Auto</span>
                  <small style={{ color: 'var(--text-dim, #94a3b8)', fontSize: '11px' }}>Highest available source</small>
                </div>
                {currentQuality === 'auto' && <i className="fa-solid fa-check"></i>}
              </button>

              {availableQualities.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  className={`vip-option-item ${currentQuality === q.id ? 'active' : ''}`}
                  onClick={() => {
                    onSelectQuality(q.id);
                    setActiveTab('main');
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{q.label}</span>
                    {q.badge && <span className="vip-quality-badge">{q.badge}</span>}
                  </div>
                  {currentQuality === q.id && <i className="fa-solid fa-check"></i>}
                </button>
              ))}
            </div>
          )}

          {/* 4. ASPECT RATIO SUBMENU */}
          {activeTab === 'aspect' && (
            <div className="vip-settings-options-list">
              {ASPECT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`vip-option-item ${aspectRatio === opt.id ? 'active' : ''}`}
                  onClick={() => {
                    onSelectAspectRatio(opt.id);
                    setActiveTab('main');
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <i className={`fa-solid ${opt.icon}`}></i>
                    <span>{opt.label}</span>
                  </div>
                  {aspectRatio === opt.id && <i className="fa-solid fa-check"></i>}
                </button>
              ))}
            </div>
          )}

          {/* 5. SUBTITLES SUBMENU */}
          {activeTab === 'subtitles' && (
            <div className="vip-settings-subtitles-box">
              <label className="vip-sub-heading">Subtitle Track</label>
              <div className="vip-settings-options-list" style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  className={`vip-option-item ${currentSubtitle === 'off' ? 'active' : ''}`}
                  onClick={() => onSelectSubtitle('off')}
                >
                  <span>Off</span>
                  {currentSubtitle === 'off' && <i className="fa-solid fa-check"></i>}
                </button>
                {subtitles.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    className={`vip-option-item ${currentSubtitle === sub.id ? 'active' : ''}`}
                    onClick={() => onSelectSubtitle(sub.id)}
                  >
                    <span>{sub.label}</span>
                    {currentSubtitle === sub.id && <i className="fa-solid fa-check"></i>}
                  </button>
                ))}
              </div>

              {currentSubtitle !== 'off' && (
                <>
                  <label className="vip-sub-heading">Font Size</label>
                  <div className="vip-chips-row">
                    {['small', 'medium', 'large', 'xlarge'].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        className={`vip-chip-btn ${settings.subtitleSize === sz ? 'active' : ''}`}
                        onClick={() => onUpdateSettings({ subtitleSize: sz })}
                      >
                        {sz.charAt(0).toUpperCase() + sz.slice(1)}
                      </button>
                    ))}
                  </div>

                  <label className="vip-sub-heading" style={{ marginTop: '12px' }}>Background Opacity</label>
                  <div className="vip-chips-row">
                    {[
                      { id: 'none', label: 'None' },
                      { id: 'semi', label: 'Semi-Transparent' },
                      { id: 'solid', label: 'Solid Black' }
                    ].map((bg) => (
                      <button
                        key={bg.id}
                        type="button"
                        className={`vip-chip-btn ${settings.subtitleBackground === bg.id ? 'active' : ''}`}
                        onClick={() => onUpdateSettings({ subtitleBackground: bg.id })}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>

                  <label className="vip-sub-heading" style={{ marginTop: '12px' }}>Vertical Position</label>
                  <div className="vip-chips-row">
                    {['bottom', 'middle', 'top'].map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        className={`vip-chip-btn ${settings.subtitlePosition === pos ? 'active' : ''}`}
                        onClick={() => onUpdateSettings({ subtitlePosition: pos })}
                      >
                        {pos.charAt(0).toUpperCase() + pos.slice(1)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
