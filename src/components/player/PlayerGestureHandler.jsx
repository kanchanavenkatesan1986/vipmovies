import React, { useRef, useState, useEffect } from 'react';
import { formatPlayerTime } from './playerUtils';

export default function PlayerGestureHandler({
  containerRef,
  onToggleControls,
  onSeekRel,
  onSeekTo,
  currentTime,
  duration,
  volume,
  onVolumeChange,
  brightness,
  onBrightnessChange,
  onSpeedTemporary,
  onSpeedRestore,
  onTogglePlay,
  isRotated90 = false,
  disabled = false,
  children
}) {
  const [doubleTapFeedback, setDoubleTapFeedback] = useState(null); // { side: 'left'|'right', count: number }
  const [gestureState, setGestureState] = useState(null); // { type: 'brightness'|'volume'|'seek', value: number, display: string }
  const [isLongPressing, setIsLongPressing] = useState(false);

  // Gesture Tracker Refs
  const touchStartRef = useRef({ clientX: 0, clientY: 0, localX: 0, localY: 0, time: 0, side: 'center' });
  const longPressTimerRef = useRef(null);
  const singleTapTimerRef = useRef(null);
  const isSwipingRef = useRef(false);
  const lastTapRef = useRef({ time: 0, side: 'center' });

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
    };
  }, []);

  /**
   * Transforms physical screen touch coordinates into player container local coordinates.
   * In 90deg rotated mode:
   *   Local X (left to right along rotated player width) corresponds to physical screen Top-to-Bottom or Bottom-to-Top.
   */
  const getLocalTouchCoords = (touch) => {
    if (!containerRef.current) {
      return { x: touch.clientX, y: touch.clientY, width: window.innerWidth, height: window.innerHeight };
    }
    const rect = containerRef.current.getBoundingClientRect();

    if (isRotated90) {
      // In 90deg clockwise rotation:
      // Rotated width runs along physical height (top to bottom)
      // Rotated height runs along physical width (right to left)
      const localX = touch.clientY - rect.top;
      const localY = rect.right - touch.clientX;
      return {
        x: localX,
        y: localY,
        width: rect.height,
        height: rect.width
      };
    }

    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      width: rect.width,
      height: rect.height
    };
  };

  const handleTouchStart = (e) => {
    if (disabled || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const coords = getLocalTouchCoords(touch);
    const side = coords.x < coords.width * 0.38 ? 'left' : coords.x > coords.width * 0.62 ? 'right' : 'center';

    touchStartRef.current = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      localX: coords.x,
      localY: coords.y,
      time: Date.now(),
      side
    };
    isSwipingRef.current = false;

    // 2x Long press speed
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (!isSwipingRef.current) {
        setIsLongPressing(true);
        if (onSpeedTemporary) onSpeedTemporary(2.0);
      }
    }, 550);
  };

  const handleTouchMove = (e) => {
    if (disabled || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const coords = getLocalTouchCoords(touch);

    // Calculate local dx, dy in the player's coordinate system
    const localDx = coords.x - touchStartRef.current.localX;
    const localDy = touchStartRef.current.localY - coords.y; // Upward movement is positive

    if (Math.abs(localDx) > 12 || Math.abs(localDy) > 12) {
      isSwipingRef.current = true;
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (isLongPressing) {
        setIsLongPressing(false);
        if (onSpeedRestore) onSpeedRestore();
      }
    }

    if (!isSwipingRef.current) return;

    const { width, height } = coords;

    // Determine swipe direction: Vertical (Volume/Brightness) vs Horizontal (Seek scrub)
    if (Math.abs(localDy) > Math.abs(localDx)) {
      // Vertical gesture
      const deltaPercent = (localDy / (height * 0.75)) * 100;

      if (touchStartRef.current.side === 'left') {
        // Brightness on left
        const initial = brightness !== undefined ? brightness : 100;
        const next = Math.min(Math.max(initial + deltaPercent * 0.25, 20), 100);
        if (onBrightnessChange) onBrightnessChange(Math.round(next));
        setGestureState({
          type: 'brightness',
          value: Math.round(next),
          display: `${Math.round(next)}%`
        });
      } else {
        // Volume on right
        const initial = (volume !== undefined ? volume : 1) * 100;
        const next = Math.min(Math.max(initial + deltaPercent * 0.25, 0), 100);
        if (onVolumeChange) onVolumeChange(next / 100);
        setGestureState({
          type: 'volume',
          value: Math.round(next),
          display: `${Math.round(next)}%`
        });
      }
    } else {
      // Horizontal gesture: Seek
      if (duration > 0) {
        const deltaSeconds = (localDx / (width * 0.8)) * 90; // full swipe ~ 90s
        const targetTime = Math.min(Math.max(currentTime + deltaSeconds, 0), duration);
        setGestureState({
          type: 'seek',
          value: targetTime,
          display: `${formatPlayerTime(targetTime)} (${deltaSeconds > 0 ? '+' : ''}${Math.round(deltaSeconds)}s)`
        });
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    if (isLongPressing) {
      setIsLongPressing(false);
      if (onSpeedRestore) onSpeedRestore();
    }

    if (isSwipingRef.current) {
      if (gestureState && gestureState.type === 'seek' && onSeekTo) {
        onSeekTo(gestureState.value);
      }
      setGestureState(null);
      isSwipingRef.current = false;
      return;
    }

    setGestureState(null);

    // Tap Handling (Single vs Double Tap)
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current.time;
    const side = touchStartRef.current.side;

    if (timeSinceLastTap < 300 && lastTapRef.current.side === side && (side === 'left' || side === 'right')) {
      // Double tap recognized
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);

      const deltaSec = side === 'left' ? -10 : 10;
      if (onSeekRel) onSeekRel(deltaSec);

      setDoubleTapFeedback({ side, count: 10 });
      setTimeout(() => setDoubleTapFeedback(null), 700);

      lastTapRef.current = { time: 0, side: 'center' };
    } else {
      // Single tap confirmation
      lastTapRef.current = { time: now, side };
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);

      singleTapTimerRef.current = setTimeout(() => {
        if (onToggleControls) onToggleControls();
      }, 250);
    }
  };

  return (
    <div
      className="vip-gesture-layer"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {children}

      {/* 1. Double Tap Ripple & Animation */}
      {doubleTapFeedback && (
        <div className={`vip-double-tap-feedback ${doubleTapFeedback.side}`}>
          <div className="vip-dt-circle">
            <div className="vip-dt-arrows">
              <i className={`fa-solid ${doubleTapFeedback.side === 'left' ? 'fa-angles-left' : 'fa-angles-right'}`}></i>
            </div>
            <span className="vip-dt-text">{doubleTapFeedback.side === 'left' ? '-10s' : '+10s'}</span>
          </div>
        </div>
      )}

      {/* 2. Long Press 2x Speed Indicator */}
      {isLongPressing && (
        <div className="vip-longpress-speed-badge">
          <i className="fa-solid fa-forward-fast"></i>
          <span>2× SPEED</span>
        </div>
      )}

      {/* 3. Swipe Gesture Overlay (Brightness / Volume / Seek) */}
      {gestureState && (
        <div className="vip-gesture-indicator-box">
          <div className="vip-gesture-icon">
            {gestureState.type === 'brightness' && <i className="fa-solid fa-sun"></i>}
            {gestureState.type === 'volume' && (
              <i className={`fa-solid ${gestureState.value === 0 ? 'fa-volume-xmark' : gestureState.value < 50 ? 'fa-volume-low' : 'fa-volume-high'}`}></i>
            )}
            {gestureState.type === 'seek' && <i className="fa-solid fa-arrows-left-right"></i>}
          </div>
          <div className="vip-gesture-val">{gestureState.display}</div>
          {gestureState.type !== 'seek' && (
            <div className="vip-gesture-bar-track">
              <div className="vip-gesture-bar-fill" style={{ width: `${gestureState.value}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
