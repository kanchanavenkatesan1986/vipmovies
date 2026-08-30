import React, { useRef, useState, useCallback, useEffect } from 'react';
import { formatPlayerTime } from './playerUtils';

export default function PlayerSeekBar({
  currentTime = 0,
  duration = 0,
  bufferedRanges = [],
  onSeek,
  onSeekStart,
  onSeekEnd,
  disabled = false
}) {
  const barRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPosition, setHoverPosition] = useState(null); // { pct: number, time: number, x: number }
  const [dragTime, setDragTime] = useState(null);

  const playedPct = duration > 0 ? ((isDragging && dragTime !== null ? dragTime : currentTime) / duration) * 100 : 0;

  const calculateSeekTime = useCallback((clientX) => {
    if (!barRef.current || duration <= 0) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = x / rect.width;
    return Math.max(0, Math.min(pct * duration, duration));
  }, [duration]);

  // Mouse Hover on Desktop
  const handleMouseMove = (e) => {
    if (disabled || duration <= 0 || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const pct = x / rect.width;
    const time = pct * duration;
    setHoverPosition({ pct: pct * 100, time, x });
  };

  const handleMouseLeave = () => {
    setHoverPosition(null);
  };

  // Mouse & Touch Dragging Handlers
  const handleStart = (clientX) => {
    if (disabled || duration <= 0) return;
    setIsDragging(true);
    const time = calculateSeekTime(clientX);
    setDragTime(time);
    if (onSeekStart) onSeekStart();
  };

  const handleMove = useCallback((clientX) => {
    if (!isDragging || duration <= 0) return;
    const time = calculateSeekTime(clientX);
    setDragTime(time);
  }, [isDragging, duration, calculateSeekTime]);

  const handleEnd = useCallback((clientX) => {
    if (!isDragging) return;
    setIsDragging(false);
    const targetTime = dragTime !== null ? dragTime : calculateSeekTime(clientX);
    setDragTime(null);
    if (onSeek) onSeek(targetTime);
    if (onSeekEnd) onSeekEnd(targetTime);
  }, [isDragging, dragTime, calculateSeekTime, onSeek, onSeekEnd]);

  useEffect(() => {
    if (!isDragging) return;

    const onWindowMouseMove = (e) => handleMove(e.clientX);
    const onWindowMouseUp = (e) => handleEnd(e.clientX);

    const onWindowTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };
    const onWindowTouchEnd = (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        handleEnd(e.changedTouches[0].clientX);
      } else {
        handleEnd(0);
      }
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
    window.addEventListener('touchend', onWindowTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  return (
    <div
      className={`vip-player-seek-wrap ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      ref={barRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={(e) => handleStart(e.clientX)}
      onTouchStart={(e) => {
        if (e.touches && e.touches[0]) handleStart(e.touches[0].clientX);
      }}
      role="slider"
      aria-label="Seek Bar"
      aria-valuemin="0"
      aria-valuemax={duration || 100}
      aria-valuenow={currentTime || 0}
      tabIndex={0}
      onKeyDown={(e) => {
        if (disabled || duration <= 0) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onSeek(Math.min(currentTime + 5, duration));
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onSeek(Math.max(currentTime - 5, 0));
        }
      }}
    >
      <div className="vip-seek-track">
        {/* Buffered Segments */}
        {bufferedRanges.map((range, idx) => {
          const startPct = duration > 0 ? (range.start / duration) * 100 : 0;
          const endPct = duration > 0 ? (range.end / duration) * 100 : 0;
          const widthPct = Math.max(0, endPct - startPct);

          return (
            <div
              key={idx}
              className="vip-seek-buffered"
              style={{ left: `${startPct}%`, width: `${widthPct}%` }}
            />
          );
        })}

        {/* Hover Highlight Bar (Desktop) */}
        {hoverPosition && (
          <div
            className="vip-seek-hover"
            style={{ width: `${hoverPosition.pct}%` }}
          />
        )}

        {/* Played Progress Bar */}
        <div
          className="vip-seek-played"
          style={{ width: `${Math.min(Math.max(playedPct, 0), 100)}%` }}
        />

        {/* Scrub Handle Thumb */}
        <div
          className="vip-seek-thumb"
          style={{ left: `${Math.min(Math.max(playedPct, 0), 100)}%` }}
        />
      </div>

      {/* Tooltip on Hover or Touch Drag */}
      {(hoverPosition || (isDragging && dragTime !== null)) && (
        <div
          className="vip-seek-tooltip"
          style={{
            left: isDragging && dragTime !== null && duration > 0
              ? `${(dragTime / duration) * 100}%`
              : `${hoverPosition?.pct || 0}%`
          }}
        >
          {formatPlayerTime(isDragging && dragTime !== null ? dragTime : hoverPosition?.time || 0)}
        </div>
      )}
    </div>
  );
}
