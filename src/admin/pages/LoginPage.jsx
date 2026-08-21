import React, { useState } from 'react';
import { authService } from '../services/authService';

export default function LoginPage({ navigateTo }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const res = authService.login(username, password, remember);
      setLoading(false);
      if (res.success) {
        navigateTo('admin/dashboard');
      } else {
        setErrorMsg(res.message || 'Invalid username or password.');
      }
    }, 400);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(ellipse at top, #0f1729 0%, #050810 60%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#f1f5f9'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(10,14,26,0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: '20px',
        padding: '36px 30px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.8), 0 0 40px rgba(59,130,246,0.08)'
      }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '60px', height: '60px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            borderRadius: '16px',
            margin: '0 auto 16px auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 900, color: '#fff',
            boxShadow: '0 8px 28px rgba(59,130,246,0.4)'
          }}>VIP</div>

          <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#fff', margin: '0 0 4px 0', letterSpacing: '0.5px' }}>
            VIP MOVIES
          </h1>
          <p style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>
            ADMINISTRATOR CMS PANEL
          </p>
        </div>

        {/* Error */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.35)',
            color: '#ef4444',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: 600,
            marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-user" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '14px' }}></i>
              <input
                type="text"
                className="admin-input"
                style={{ paddingLeft: '40px' }}
                placeholder="Enter admin username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <label style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <i className="fa-solid fa-lock" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '14px' }}></i>
              <input
                type={showPassword ? 'text' : 'password'}
                className="admin-input"
                style={{ paddingLeft: '40px', paddingRight: '42px' }}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', padding: '4px'
                }}
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* Remember */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
            />
            Remember my session (30 minutes)
          </label>

          {/* Submit */}
          <button
            type="submit"
            className="admin-btn primary"
            style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px', fontWeight: 800, marginTop: '4px' }}
            disabled={loading}
          >
            {loading
              ? <><i className="fa-solid fa-spinner fa-spin"></i> Authenticating...</>
              : <><i className="fa-solid fa-right-to-bracket"></i> Sign In to Admin Panel</>
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '22px', fontSize: '12px', color: '#475569' }}>
          🔒 Authorized Access Only · VIP Movies CMS
        </p>
      </div>
    </div>
  );
}
