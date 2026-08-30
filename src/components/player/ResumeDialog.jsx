import React from 'react';
import { formatPlayerTime } from './playerUtils';

export default function ResumeDialog({
  isOpen,
  savedTime,
  duration,
  movieTitle,
  onResume,
  onStartOver
}) {
  if (!isOpen) return null;

  return (
    <div className="vip-resume-dialog-overlay">
      <div className="vip-resume-dialog-card">
        <div className="vip-resume-icon">
          <i className="fa-solid fa-clock-rotate-left"></i>
        </div>

        <h3 className="vip-resume-title">Continue Watching?</h3>

        <p className="vip-resume-desc">
          You were watching <strong>{movieTitle || 'this movie'}</strong>. Would you like to resume from where you left off?
        </p>

        <div className="vip-resume-time-badge">
          <i className="fa-regular fa-circle-play"></i>
          <span>Resume at <strong>{formatPlayerTime(savedTime)}</strong> {duration > 0 && `(of ${formatPlayerTime(duration)})`}</span>
        </div>

        <div className="vip-resume-actions">
          <button
            type="button"
            className="vip-btn-resume primary"
            onClick={onResume}
            autoFocus
          >
            <i className="fa-solid fa-play"></i>
            <span>Resume</span>
          </button>

          <button
            type="button"
            className="vip-btn-resume secondary"
            onClick={onStartOver}
          >
            <i className="fa-solid fa-rotate-left"></i>
            <span>Start Over</span>
          </button>
        </div>
      </div>
    </div>
  );
}
