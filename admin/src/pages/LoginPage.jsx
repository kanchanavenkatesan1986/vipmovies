import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff, Mail, Lock, Film } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await login(email, password, rememberMe);
      addToast('Welcome back! Login successful.', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      addToast(err.message || 'Login failed', 'error');
      setErrors({ auth: err.message || 'Invalid credentials' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background grid lines */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#e50914 1px, transparent 1px), linear-gradient(to right, #e50914 1px, transparent 1px)',
          backgroundSize: '80px 80px'
        }}
      />

      {/* Red glow center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand */}
      <div className="flex items-center gap-3 mb-10 z-10">
        <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center shadow-xl shadow-red-900/50">
          <Film className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-wider">VIP MOVIES</h1>
          <p className="text-xs font-bold text-red-500 tracking-[0.25em] uppercase">Admin Dashboard</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm glass-panel rounded-2xl border border-zinc-800/80 shadow-2xl p-8 z-10">
        <div className="mb-7">
          <h2 className="text-xl font-bold text-white">Sign In</h2>
          <p className="text-sm text-zinc-500 mt-1">Access the Netflix Admin Panel</p>
        </div>

        {errors.auth && (
          <div className="mb-5 p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-sm text-red-400 font-medium">
            {errors.auth}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="email"
                id="login-email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: null, auth: null })); }}
                placeholder="admin@vipmovies.com"
                className={`w-full bg-zinc-900/70 border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-red-600/70 transition-all text-zinc-200 placeholder-zinc-600 ${
                  errors.email ? 'border-red-700' : 'border-zinc-800/70'
                }`}
              />
            </div>
            {errors.email && <p className="text-[11px] text-red-400 mt-1">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: null, auth: null })); }}
                placeholder="Enter your password"
                className={`w-full bg-zinc-900/70 border rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:border-red-600/70 transition-all text-zinc-200 placeholder-zinc-600 ${
                  errors.password ? 'border-red-700' : 'border-zinc-800/70'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-red-400 mt-1">{errors.password}</p>}
          </div>

          {/* Options */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-red-600 cursor-pointer"
              />
              <span className="text-sm text-zinc-400">Remember me</span>
            </label>
            <button
              type="button"
              className="text-sm text-red-500 hover:text-red-400 font-medium transition-colors"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            id="login-submit"
            disabled={loading}
            className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-xl shadow-red-900/30 mt-2 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </span>
            ) : 'Sign In to Dashboard'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-600 mt-6">
          VIP Movies Admin v2.0 • Netflix Dark Edition
        </p>
      </div>
    </div>
  );
}
