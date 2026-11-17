import React, { useState, useEffect, useRef } from 'react';

const POPUP_SESSION_KEY = 'vip_home_popup_shown';
const COUNTDOWN_SECONDS = 5;

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
            // Auto close when countdown finishes
            setTimeout(() => {
              handleClose();
            }, 600);
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

  // When popup is open: move bottom nav down & lock background scroll
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
    }, 380);
  };

  if (!visible) return null;

  const R = 23;
  const CIRC = 2 * Math.PI * R;
  const strokeOffset = CIRC * (1 - countdown / COUNTDOWN_SECONDS);
  const progressPercent = (countdown / COUNTDOWN_SECONDS) * 100;

  return (
    <>
      {/* ── Dynamic CSS injection for smooth bottom-nav move ── */}
      <style>{`
        body.vip-home-popup-active .bottom-nav {
          transform: translate(-50%, 120%) !important;
          opacity: 0 !important;
          pointer-events: none !important;
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease !important;
        }
        @keyframes vipPulseRing {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes vipShimmerBar {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
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
          transition: 'opacity 0.38s ease',
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

      {/* ── 3. Main Popup Card — 10% space on top, bottom, left, right ── */}
      <div
        style={{
          position: 'fixed',
          top: '10%',
          bottom: '10%',
          left: '10%',
          right: '10%',
          width: '80%',
          height: '80%',
          zIndex: 100002,
          /* 5px white border + intense black shadow */
          border: '5px solid #ffffff',
          borderRadius: '18px',
          boxShadow: '0 0 0 3px #000000, 0 15px 50px rgba(0, 0, 0, 0.98), 0 0 120px rgba(0, 0, 0, 0.95)',
          overflow: 'hidden',
          backgroundColor: '#000000',
          display: 'flex',
          flexDirection: 'column',
          transform: mounted ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(24px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 0.38s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.35s ease',
        }}
      >
        {/* Exact Banner Image — clickable to start watching */}
        <div
          onClick={handleClose}
          style={{
            flex: 1,
            position: 'relative',
            width: '100%',
            height: '100%',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <img
            src="/home-popup-banner.jpg"
            alt="VIP Movies"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
              display: 'block',
            }}
          />
        </div>

        {/* ── Close Button (Top-Right): 100% Dark Color, Big, Increased Visibility ── */}
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
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#000000', // 100% solid jet black dark color
            border: '3px solid #ffffff', // Crisp white outer border
            boxShadow: '0 0 0 2px #000000, 0 6px 20px rgba(0, 0, 0, 0.95), 0 0 12px rgba(255, 215, 0, 0.5)',
            cursor: 'pointer',
            padding: 0,
            zIndex: 100005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s ease, background-color 0.2s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* Animated circular progress indicator */}
          <svg
            width="56"
            height="56"
            viewBox="0 0 56 56"
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
              cx="28"
              cy="28"
              r={R}
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="3.5"
            />
            {/* Moving progress countdown stroke */}
            {countdown > 0 && (
              <circle
                cx="28"
                cy="28"
                r={R}
                fill="none"
                stroke="#FFD700"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={strokeOffset}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            )}
          </svg>

          {/* Center Content: Big countdown seconds or crisp white ✕ */}
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
                    fontSize: '18px',
                    fontWeight: 900,
                    color: '#FFD700',
                    lineHeight: 1,
                    textShadow: '0 0 10px rgba(255, 215, 0, 0.8)',
                    fontFamily: 'monospace, sans-serif',
                  }}
                >
                  {countdown}
                </span>
                <span
                  style={{
                    fontSize: '8px',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '0.5px',
                    lineHeight: 1,
                    marginTop: '1px',
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

        {/* ── Bottom Moving Layer: Dark Nav Layer that moves and shows countdown seconds ── */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          style={{
            position: 'relative',
            width: '100%',
            backgroundColor: '#0a0a0c', // 100% dark solid bar
            borderTop: '2px solid rgba(255, 255, 255, 0.2)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            cursor: 'pointer',
            boxShadow: '0 -4px 15px rgba(0, 0, 0, 0.8)',
            zIndex: 100004,
          }}
        >
          {/* Moving Progress Bar at top edge of bottom layer */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '3px',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #FFD700, #FF6B00)',
              boxShadow: '0 0 8px #FFD700',
              transition: 'width 1s linear',
            }}
          />

          {/* Left: Seconds status & countdown message */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#FFD700',
                color: '#000000',
                fontWeight: 900,
                fontSize: '12px',
              }}
            >
              {countdown}s
            </span>
            <span
              style={{
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.3px',
              }}
            >
              {countdown > 0 ? `Closing in ${countdown} sec...` : 'Enjoy VIP Movies!'}
            </span>
          </div>

          {/* Right: Big visible Close / Watch button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            style={{
              backgroundColor: '#1f1f23',
              color: '#ffffff',
              border: '1.5px solid rgba(255, 255, 255, 0.35)',
              borderRadius: '20px',
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            <span>CLOSE</span>
            <span style={{ color: '#FFD700', fontSize: '13px' }}>✕</span>
          </button>
        </div>
      </div>
    </>
  );
}
