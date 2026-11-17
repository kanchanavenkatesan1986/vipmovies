import React, { useState, useEffect, useRef } from 'react';

const POPUP_SESSION_KEY = 'vip_home_popup_shown';
const COUNTDOWN_SECONDS = 10;

export default function HomePopup() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const countRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    // Only mobile: max-width 768px
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const alreadyShown = sessionStorage.getItem(POPUP_SESSION_KEY);
    if (!isMobile || alreadyShown) return;

    const delay = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem(POPUP_SESSION_KEY, '1');
      requestAnimationFrame(() => setTimeout(() => setMounted(true), 30));

      countRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countRef.current);
            // DO NOT close automatically — user must click close button
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 350);

    return () => {
      clearTimeout(delay);
      clearInterval(countRef.current);
      clearTimeout(closeTimerRef.current);
    };
  }, []);

  // When popup is open: move bottom nav down smoothly & lock background
  useEffect(() => {
    if (visible && mounted) {
      document.body.classList.add('vip-home-popup-active');
    } else {
      document.body.classList.remove('vip-home-popup-active');
    }
    return () => {
      document.body.classList.remove('vip-home-popup-active');
    };
  }, [visible, mounted]);

  const handleClose = () => {
    setMounted(false);
    clearInterval(countRef.current);
    closeTimerRef.current = setTimeout(() => {
      setVisible(false);
      document.body.classList.remove('vip-home-popup-active');
    }, 350);
  };

  if (!visible) return null;

  const R = 22;
  const CIRC = 2 * Math.PI * R;
  const strokeOffset = CIRC * (1 - countdown / COUNTDOWN_SECONDS);
  const progressPercent = (countdown / COUNTDOWN_SECONDS) * 100;

  return (
    <>
      {/* ── CSS for moving bottom nav & animation ── */}
      <style>{`
        body.vip-home-popup-active .bottom-nav {
          transform: translate(-50%, 120%) !important;
          opacity: 0 !important;
          pointer-events: none !important;
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease !important;
        }
      `}</style>

      {/* ── 1. Full-screen Dark Backdrop Layer (covers everything including bottom-nav) ── */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.88)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 100000,
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.35s ease',
        }}
      />

      {/* ── 2. Ambient moving glow layer behind popup ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100001,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '120vw',
            height: '120vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 200, 0, 0.16) 0%, rgba(255, 120, 0, 0.05) 50%, transparent 70%)',
            transform: mounted
              ? 'translate(-50%, -50%) scale(1)'
              : 'translate(-50%, -50%) scale(0.6)',
            transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </div>

      {/* ── 3. Adaptive Popup Card: adopts natural image size (not fixed), 2px white border ── */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: mounted
            ? 'translate(-50%, -50%) scale(1)'
            : 'translate(-50%, -50%) scale(0.85)',
          /* Full adopt: width & height adapt to natural 682/1024 poster ratio with min 10% screen margin */
          width: 'min(80vw, calc(80vh * 682 / 1024))',
          maxHeight: '80vh',
          zIndex: 100002,
          /* 2px white border as requested */
          border: '2px solid #ffffff',
          borderRadius: '16px',
          boxShadow: '0 0 0 2px #000000, 0 15px 45px rgba(0, 0, 0, 0.95), 0 0 100px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          backgroundColor: '#000000',
          opacity: mounted ? 1 : 0,
          transition: 'transform 0.38s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.35s ease',
          lineHeight: 0,
        }}
      >
        {/* Exact Banner Image — 100% visible, fully adopted width & height, zero crop */ }
        <img
          src="/home-popup-banner.jpg"
          alt="VIP Movies Welcome"
          onClick={handleClose}
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: '80vh',
            display: 'block',
            objectFit: 'contain',
            cursor: 'pointer',
          }}
        />

        {/* Thin dynamic countdown progress bar along the bottom border (does NOT cover artwork) */}
        {countdown > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: '3px',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #FFD700, #FF5500)',
              boxShadow: '0 0 8px #FFD700',
              transition: 'width 1s linear',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />
        )}

        {/* ── Close Button (Top-Right): Big, 100% Dark Solid Color, Highly Visible ── */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: '#000000', // 100% solid jet black
            border: '2.5px solid #ffffff', // Crisp white outer border
            boxShadow: '0 0 0 2px #000000, 0 6px 20px rgba(0, 0, 0, 0.95)',
            cursor: 'pointer',
            padding: 0,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
            transition: 'transform 0.15s ease',
          }}
        >
          {/* Animated circular progress indicator */}
          <svg
            width="54"
            height="54"
            viewBox="0 0 54 54"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: 'rotate(-90deg)',
              pointerEvents: 'none',
            }}
          >
            {/* Background ring track */}
            <circle
              cx="27"
              cy="27"
              r={R}
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="3"
            />
            {/* Moving progress countdown stroke */}
            {countdown > 0 && (
              <circle
                cx="27"
                cy="27"
                r={R}
                fill="none"
                stroke="#FFD700"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={strokeOffset}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            )}
          </svg>

          {/* Center Content: Countdown number (10 to 1) or crisp bold white ✕ */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {countdown > 0 ? (
              <>
                <span
                  style={{
                    fontSize: '17px',
                    fontWeight: 900,
                    color: '#FFD700',
                    lineHeight: 1,
                    textShadow: '0 0 8px rgba(255, 215, 0, 0.8)',
                    fontFamily: 'monospace, sans-serif',
                  }}
                >
                  {countdown}
                </span>
                <span
                  style={{
                    fontSize: '7px',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '0.5px',
                    lineHeight: 1,
                    marginTop: '2px',
                  }}
                >
                  SEC
                </span>
              </>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <line x1="4" y1="4" x2="20" y2="20" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="20" y1="4" x2="4" y2="20" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </button>

        {/* Small badge below close button when countdown reaches 0 to prompt user click */}
        {countdown === 0 && (
          <div
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '68px',
              right: '6px',
              backgroundColor: '#000000',
              color: '#ffffff',
              border: '1.5px solid #ffffff',
              borderRadius: '12px',
              padding: '3px 8px',
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.9)',
              cursor: 'pointer',
              zIndex: 20,
              whiteSpace: 'nowrap',
            }}
          >
            TAP TO CLOSE ✕
          </div>
        )}
      </div>
    </>
  );
}
