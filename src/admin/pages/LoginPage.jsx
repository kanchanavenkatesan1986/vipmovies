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
      background: 'radial-gradient(circle at center, #1a0b12 0%, #07080d 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div className="admin-glass-card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '36px 32px',
        border: '1px solid rgba(229, 9, 20, 0.3)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(229, 9, 20, 0.15)'
      }}>
        
        {/* Brand Header */}
        <div style={{ textAlignment: 'center', textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, var(--admin-accent) 0%, var(--admin-purple) 100%)',
            borderRadius: '14px',
            margin: '0 auto 14px auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 900,
            color: '#fff',
            boxShadow: '0 8px 24px rgba(229, 9, 20, 0.4)'
          }}>
            VIP
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '0.5px' }}>
            VIP MOVIES
          </h1>
          <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--admin-accent)', textTransform: 'uppercase', letterSpacing: '1px', margin: '4px 0 0 0' }}>
            ADMINISTRATOR CMS PANEL
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: 'var(--admin-danger)',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="admin-form-group">
            <label>Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="admin-input"
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '38px' }}
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
              <i className="fa-solid fa-user" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-dim)', fontSize: '14px' }}></i>
            </div>
          </div>

          <div className="admin-form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="admin-input"
                style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '38px', paddingRight: '40px' }}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <i className="fa-solid fa-lock" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-dim)', fontSize: '14px' }}></i>
              <button
                type="button"
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--admin-text-dim)', cursor: 'pointer' }}
                onClick={() => setShowPassword(!showPassword)}
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--admin-text-muted)' }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                style={{ accentColor: 'var(--admin-accent)' }}
              />
              <span>Remember Session</span>
            </label>
          </div>

          <button
            type="submit"
            className="admin-btn primary"
            style={{ width: '100%', padding: '14px', justifyContent: 'center', fontSize: '15px', fontWeight: 800, marginTop: '6px' }}
            disabled={loading}
          >
            {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Authenticating...</> : <><i className="fa-solid fa-right-to-bracket"></i> Sign In to CMS</>}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '11px', color: 'var(--admin-text-dim)' }}>
          🔒 Authorized Secure Admin Access Only • VIP Movies CMS
        </div>

      </div>
    </div>
  );
}
