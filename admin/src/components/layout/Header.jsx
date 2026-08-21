import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Plus,
  Keyboard,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function Header({ onNewMovie, onToggleShortcuts, searchRef }) {
  const { user, role, logout, switchRole } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();

  const roles = ['Super Admin', 'Editor', 'Uploader', 'Viewer'];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
        setRoleOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 glass-panel border-b border-zinc-800/80 sticky top-0 z-30 flex items-center justify-between px-5 gap-4 bg-zinc-950/80 backdrop-blur-md">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search movies, directors, actors… (Ctrl+F)"
          className="w-full bg-zinc-900/70 border border-zinc-800/70 text-zinc-200 placeholder-zinc-600 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-red-600/70 focus:bg-zinc-900 transition-all"
          onFocus={(e) => navigate('/movies')}
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Quick Add */}
        <button
          onClick={onNewMovie}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all shadow-lg shadow-red-900/30 active:scale-95"
          title="Add Movie (Ctrl+N)"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Movie</span>
        </button>

        {/* Keyboard Shortcuts Toggle */}
        <button
          onClick={onToggleShortcuts}
          className="p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors"
          title="Keyboard Shortcuts (?)"
        >
          <Keyboard className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <button
          className="relative p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors"
          title="Notifications"
          onClick={() => navigate('/notifications')}
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-zinc-950" />
        </button>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-zinc-800/60 transition-colors border border-transparent hover:border-zinc-700/60"
          >
            <img
              src={user?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'}
              alt="Avatar"
              className="w-8 h-8 rounded-full border-2 border-red-600/50"
            />
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-white leading-tight">{user?.name || 'ADMIN'}</p>
              <p className="text-[10px] text-red-400 font-medium">{role}</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-14 w-64 glass-panel border border-zinc-700/70 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in">
              {/* User Info */}
              <div className="px-3 py-2.5 mb-1">
                <p className="text-sm font-bold text-white">{user?.name || 'Admin'}</p>
                <p className="text-xs text-zinc-400">{user?.email || 'admin@vipmovies.com'}</p>
              </div>
              <div className="h-px bg-zinc-800 mb-1" />

              {/* Role Switcher */}
              <div className="px-3 py-2 mb-1">
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1.5">Switch Role</p>
                <div className="flex flex-wrap gap-1.5">
                  {roles.map((r) => (
                    <button
                      key={r}
                      onClick={() => { switchRole(r); setProfileOpen(false); }}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-semibold border transition-all ${
                        role === r
                          ? 'bg-red-600/20 text-red-400 border-red-600/50'
                          : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-px bg-zinc-800 mb-1" />

              {/* Links */}
              <button
                onClick={() => { navigate('/profile'); setProfileOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors"
              >
                <User className="w-4 h-4" />
                <span>My Profile</span>
              </button>
              <button
                onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <div className="h-px bg-zinc-800 my-1" />
              <button
                onClick={() => { logout(); setProfileOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
