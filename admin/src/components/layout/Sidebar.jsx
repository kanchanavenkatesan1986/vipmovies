import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Film,
  Globe,
  Clapperboard,
  Clock,
  FileSpreadsheet,
  DownloadCloud,
  Link2Off,
  Image,
  BarChart3,
  Bell,
  Settings,
  User,
  History,
  Database,
  Trash2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function Sidebar({ collapsed, setCollapsed, movieCounts = {} }) {
  const { user, role, logout } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'All Movies', path: '/movies', icon: Film, count: movieCounts.total || 0 },
    { label: 'Tamil Movies', path: '/movies/tamil', icon: Globe, count: movieCounts.tamil || 0 },
    { label: 'Hollywood', path: '/movies/hollywood', icon: Clapperboard, count: movieCounts.hollywood || 0 },
    { label: 'Coming Soon', path: '/coming-soon', icon: Clock, count: movieCounts.comingSoon || 0 },
    { label: 'Bulk Import', path: '/bulk-import', icon: FileSpreadsheet },
    { label: 'Bulk Export', path: '/bulk-export', icon: DownloadCloud },
    { label: 'Broken Links', path: '/broken-links', icon: Link2Off, badge: movieCounts.broken || 0 },
    { label: 'Images Manager', path: '/images', icon: Image },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Notifications', path: '/notifications', icon: Bell },
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Profile', path: '/profile', icon: User },
    { label: 'Activity Logs', path: '/activity-logs', icon: History },
    { label: 'Backup & Restore', path: '/backup', icon: Database },
    { label: 'Recycle Bin', path: '/trash', icon: Trash2, count: movieCounts.trash || 0 },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen glass-panel border-r border-zinc-800/80 transition-all duration-300 flex flex-col justify-between ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="p-4 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/60">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-red-900/50">
              V
            </div>
            <div>
              <h1 className="font-extrabold text-white text-sm tracking-wider uppercase">VIP MOVIES</h1>
              <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">NETFLIX ADMIN</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-10 h-10 mx-auto rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-xl">
            V
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-red-600/15 text-red-500 border border-red-600/30 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                }`
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>
              {!collapsed && item.count !== undefined && item.count > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {item.count}
                </span>
              )}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800/60">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Footer User Info */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={user?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin'}
                alt="User Avatar"
                className="w-8 h-8 rounded-full border border-red-600/50 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.name || 'ADMIN'}</p>
                <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <ShieldCheck className="w-3 h-3 text-red-500" />
                  <span>{role}</span>
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="w-full py-2.5 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </aside>
  );
}
