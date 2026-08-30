import React, { useEffect, useState } from 'react';

function getMovieImageUrl(movie) {
  if (!movie) return '';
  const img = movie.image || '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const type = (movie.type || '').toLowerCase();
  const year = movie.year || '';
  if (img && type && year) return `/src/images/${type}/${year}/${img}`;
  return img;
}

export default function UpNextOverlay({
  isOpen,
  nextMovie,
  onPlayNext,
  onCancel,
  countdownSeconds = 10
}) {
  const [timeLeft, setTimeLeft] = useState(countdownSeconds);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTimeLeft(countdownSeconds);
      return;
    }

    if (isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onPlayNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isPaused, countdownSeconds, onPlayNext]);

  if (!isOpen || !nextMovie) return null;

  const poster = getMovieImageUrl(nextMovie);

  return (
    <div
      className="vip-upnext-overlay"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="vip-upnext-card">
        <div className="vip-upnext-header">
          <span className="vip-upnext-label">UP NEXT IN {timeLeft}s</span>
          <button type="button" className="vip-upnext-close" onClick={onCancel} aria-label="Cancel Up Next">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="vip-upnext-body">
          {poster && (
            <img
              src={poster}
              alt={nextMovie.title}
              className="vip-upnext-thumb"
            />
          )}
          <div className="vip-upnext-info">
            <h4 className="vip-upnext-title">{nextMovie.title}</h4>
            <div className="vip-upnext-meta">
              <span>{nextMovie.year || '2026'}</span>
              <span>•</span>
              <span>{nextMovie.language || 'Tamil'}</span>
              {nextMovie.duration && (
                <>
                  <span>•</span>
                  <span>{nextMovie.duration}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="vip-upnext-progress-bar">
          <div
            className="vip-upnext-progress-fill"
            style={{ width: `${((countdownSeconds - timeLeft) / countdownSeconds) * 100}%` }}
          />
        </div>

        <div className="vip-upnext-actions">
          <button
            type="button"
            className="vip-upnext-btn primary"
            onClick={onPlayNext}
          >
            <i className="fa-solid fa-play"></i>
            <span>Play Now</span>
          </button>
          <button
            type="button"
            className="vip-upnext-btn secondary"
            onClick={onCancel}
          >
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
