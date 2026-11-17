import React, { useState, useEffect, useRef } from 'react';

const POPUP_SESSION_KEY = 'vip_home_popup_shown';
const COUNTDOWN_SECONDS = 5;

export default function HomePopup() {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);
  const countRef = useRef(null);

  useEffect(() => {
    // Only mobile: max-width 768px
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    // Only show once per session
    const alreadyShown = sessionStorage.getItem(POPUP_SESSION_KEY);
    if (!isMobile || alreadyShown) return;

    // Show after 300ms so page loads first
    const delay = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem(POPUP_SESSION_KEY, '1');

      // Countdown timer
      countRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 300);

    return () => {
      clearTimeout(delay);
      clearInterval(countRef.current);
      clearTimeout(timerRef.current);
    };
  }, []);

  const handleClose = () => {
    setClosing(true);
    timerRef.current = setTimeout(() => setVisible(false), 350);
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          zIndex: 9998,
          opacity: closing ? 0 : 1,
          transition: 'opacity 0.35s ease',
        }}
      />

      {/* Popup Box — 10% margin all sides */}
      <div
        style={{
          position: 'fixed',
          top: '10%', left: '10%',
          width: '80%', height: '80%',
          zIndex: 9999,
          borderRadius: '18px',
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(255,200,0,0.4), 0 8px 40px rgba(0,0,0,0.9)',
          transform: closing ? 'scale(0.85)' : 'scale(1)',
          opacity: closing ? 0 : 1,
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0a',
        }}
      >
        {/* Film-strip top border */}
        <div style={filmStripStyle} />

        {/* Close Button with Countdown */}
        <button
          onClick={handleClose}
          style={closeButtonStyle}
          aria-label="Close popup"
        >
          {countdown > 0 ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.5 }}>
                <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1.5" />
              </svg>
              <span style={{ fontSize: '11px', fontWeight: 700, lineHeight: 1 }}>{countdown}</span>
            </>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
              <path d="M1 1l12 12M13 1L1 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {/* Countdown Ring */}
        {countdown > 0 && (
          <svg
            style={ringStyle}
            viewBox="0 0 44 44"
          >
            <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <circle
              cx="22" cy="22" r="18"
              fill="none"
              stroke="#FFD700"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 18}`}
              strokeDashoffset={`${2 * Math.PI * 18 * (1 - countdown / COUNTDOWN_SECONDS)}`}
              transform="rotate(-90 22 22)"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
        )}

        {/* Main Content */}
        <div style={contentStyle}>

          {/* Logo */}
          <div style={logoStyle}>
            <span style={{ color: '#FFD700', fontSize: 'clamp(26px, 8vw, 36px)', fontWeight: 900, fontStyle: 'italic', textShadow: '0 0 20px rgba(255,215,0,0.6)' }}>
              ✦ VIP
            </span>
            <span style={{ color: '#fff', fontSize: 'clamp(26px, 8vw, 36px)', fontWeight: 900, fontStyle: 'italic' }}>
              {' '}MOVIES
            </span>
            <div style={{ fontSize: 'clamp(9px, 2.5vw, 11px)', letterSpacing: '3px', color: '#aaa', marginTop: '2px' }}>
              VIPMOVIES.COM
            </div>
          </div>

          {/* Welcome Text */}
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <p style={{ color: '#fff', fontSize: 'clamp(13px, 3.5vw, 16px)', fontWeight: 600, margin: 0 }}>
              Welcome to VIP Movies!
            </p>
          </div>

          {/* Yellow Banner */}
          <div style={yellowBannerStyle}>
            <p style={{ margin: 0, fontSize: 'clamp(13px, 3.8vw, 17px)', fontWeight: 900, color: '#111', textAlign: 'center', lineHeight: 1.3 }}>
              Watch <span style={{ color: '#c0392b' }}>Tamil</span> , <span style={{ color: '#c0392b' }}>Hollywood</span>
              <br />Movies <span style={{ color: '#c0392b' }}>2018</span> to <span style={{ color: '#c0392b' }}>2026</span>
            </p>
          </div>

          {/* Movie Count Badge */}
          <div style={{ textAlign: 'center', margin: '6px 0' }}>
            <span style={{ color: '#fff', fontSize: 'clamp(14px, 4vw, 18px)', fontWeight: 800 }}>
              All <span style={{ color: '#FFD700', fontSize: 'clamp(20px, 6vw, 28px)' }}>1000+</span> Movies Available!
            </span>
          </div>

          {/* Hero Image strip */}
          <div style={heroStyle}>
            <div style={heroGradientTop} />
            <div style={heroGradientBottom} />
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', fontSize: 'clamp(28px, 9vw, 42px)', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))' }}>
              🎬🦸‍♂️🎥🦾🎭
            </div>
          </div>

          {/* Feature Buttons */}
          <div style={featureRowStyle}>
            {[
              { icon: '▶', label: 'Watch\nOnline' },
              { icon: '⬇', label: 'Download\nNow' },
              { icon: '🎞', label: 'HD Quality\nMovies' },
              { icon: '★', label: 'FREE\n100% Free', gold: true },
            ].map((f, i) => (
              <div key={i} style={{ ...featureBtnStyle, ...(f.gold ? { background: 'linear-gradient(135deg, #FFD700, #FFA500)' } : {}) }}>
                <span style={{ fontSize: 'clamp(14px, 4vw, 18px)', color: f.gold ? '#000' : '#FFD700' }}>{f.icon}</span>
                <span style={{ fontSize: 'clamp(8px, 2.3vw, 11px)', color: f.gold ? '#000' : '#fff', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'pre-line', textAlign: 'center' }}>{f.label}</span>
              </div>
            ))}
          </div>

          {/* Category Bar */}
          <div style={categoryBarStyle}>
            🎬 <span style={{ color: '#FFD700', fontWeight: 700 }}>Tamil</span> | <span style={{ color: '#FFD700', fontWeight: 700 }}>Hollywood</span> | 2018 – 2026
          </div>

          {/* CTA Button */}
          <button onClick={handleClose} style={ctaStyle}>
            ▶ &nbsp;Start Watching Now
          </button>

          {/* Footer badges */}
          <div style={badgeRowStyle}>
            {['Latest Movies', 'Popular Movies', 'Dubbed Movies', 'Series & More'].map((b, i) => (
              <span key={i} style={badgeStyle}>✔ {b}</span>
            ))}
          </div>

          <div style={{ textAlign: 'center', color: '#aaa', fontSize: 'clamp(8px, 2.3vw, 10px)', marginTop: '4px', fontStyle: 'italic' }}>
            Enjoy Unlimited Movies on <span style={{ color: '#FFD700' }}>VIP Movies!</span>
          </div>
        </div>

        {/* Film-strip bottom border */}
        <div style={filmStripStyle} />
      </div>
    </>
  );
}

/* ─── Styles ─── */

const filmStripStyle = {
  height: '12px',
  background: 'repeating-linear-gradient(90deg, #111 0px, #111 10px, #FFD700 10px, #FFD700 14px, #111 14px, #111 24px)',
  flexShrink: 0,
};

const closeButtonStyle = {
  position: 'absolute',
  top: '14px',
  right: '14px',
  width: '34px',
  height: '34px',
  borderRadius: '50%',
  background: 'rgba(0,0,0,0.75)',
  border: '1.5px solid rgba(255,255,255,0.3)',
  color: '#fff',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: '1px',
  zIndex: 10001,
  backdropFilter: 'blur(4px)',
  transition: 'background 0.2s',
};

const ringStyle = {
  position: 'absolute',
  top: '7px',
  right: '7px',
  width: '44px',
  height: '44px',
  zIndex: 10002,
  pointerEvents: 'none',
};

const contentStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '10px 12px 8px',
  background: 'radial-gradient(ellipse at top, #1a0a00 0%, #0a0a0a 60%)',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const logoStyle = {
  textAlign: 'center',
  paddingTop: '4px',
};

const yellowBannerStyle = {
  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
  borderRadius: '10px',
  padding: '8px 12px',
  boxShadow: '0 4px 15px rgba(255,165,0,0.4)',
};

const heroStyle = {
  position: 'relative',
  background: 'linear-gradient(180deg, #1a0500 0%, #2d1000 50%, #1a0500 100%)',
  borderRadius: '10px',
  padding: '14px 10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  minHeight: '54px',
};

const heroGradientTop = {
  position: 'absolute', top: 0, left: 0, right: 0, height: '30px',
  background: 'linear-gradient(to bottom, #1a0a00, transparent)',
  pointerEvents: 'none',
};

const heroGradientBottom = {
  position: 'absolute', bottom: 0, left: 0, right: 0, height: '30px',
  background: 'linear-gradient(to top, #1a0a00, transparent)',
  pointerEvents: 'none',
};

const featureRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '5px',
};

const featureBtnStyle = {
  background: 'linear-gradient(135deg, #1e1e1e, #2a2a2a)',
  border: '1px solid rgba(255,215,0,0.25)',
  borderRadius: '10px',
  padding: '8px 4px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
};

const categoryBarStyle = {
  background: '#111',
  border: '1px solid rgba(255,215,0,0.3)',
  borderRadius: '8px',
  padding: '7px 10px',
  textAlign: 'center',
  color: '#ccc',
  fontSize: 'clamp(9px, 2.6vw, 12px)',
  fontWeight: 600,
  letterSpacing: '0.5px',
};

const ctaStyle = {
  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
  color: '#000',
  fontWeight: 900,
  fontSize: 'clamp(13px, 4vw, 17px)',
  border: 'none',
  borderRadius: '50px',
  padding: '12px 20px',
  cursor: 'pointer',
  letterSpacing: '0.5px',
  boxShadow: '0 4px 20px rgba(255,165,0,0.5)',
  transition: 'transform 0.15s, box-shadow 0.15s',
  width: '100%',
};

const badgeRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  justifyContent: 'center',
};

const badgeStyle = {
  color: '#FFD700',
  fontSize: 'clamp(8px, 2.2vw, 10px)',
  background: 'rgba(255,215,0,0.08)',
  borderRadius: '20px',
  padding: '3px 7px',
  border: '1px solid rgba(255,215,0,0.2)',
};
