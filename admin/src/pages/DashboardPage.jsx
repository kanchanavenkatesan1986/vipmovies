import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/common/GlassCard';
import { getLocalMovies, getActivityLogs } from '../api/moviesApi';
import {
  Film,
  Globe,
  Clapperboard,
  Clock,
  Eye,
  EyeOff,
  TrendingUp,
  Download,
  Server,
  Database,
  HardDrive,
  Plus,
  ArrowRight,
  Activity,
  Zap
} from 'lucide-react';

function StatCard({ title, value, subtitle, icon: Icon, color, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`glass-panel glass-panel-hover rounded-xl p-5 flex items-center gap-4 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`p-3 rounded-xl ${color} shrink-0`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-extrabold text-white mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-zinc-400 font-medium">{label}</span>
        <span className="text-zinc-300 font-bold">{value}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SimpleLineChart({ data, color = '#e50914', height = 60 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 200;
  const h = height;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h * 0.8 - h * 0.1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12 overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const movies = getLocalMovies();
  const logs = getActivityLogs();

  const stats = useMemo(() => {
    const total = movies.length;
    const tamil = movies.filter(m => m.language?.toLowerCase() === 'tamil').length;
    const hollywood = movies.filter(m => m.type?.toLowerCase() === 'hollywood').length;
    const comingSoon = movies.filter(m => m.status?.toLowerCase() === 'coming soon').length;
    const active = movies.filter(m => m.status?.toLowerCase() === 'active').length;
    const hidden = movies.filter(m => m.status?.toLowerCase() === 'hidden').length;
    return { total, tamil, hollywood, comingSoon, active, hidden };
  }, [movies]);

  // Simulate monthly chart data based on created_at dates
  const monthlyData = useMemo(() => {
    const months = Array(7).fill(0);
    const now = new Date();
    movies.forEach(m => {
      if (!m.created_at) return;
      const d = new Date(m.created_at);
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      if (diff >= 0 && diff < 7) months[6 - diff]++;
    });
    return months;
  }, [movies]);

  const recentMovies = [...movies]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 6);

  const IMAGE_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/images/';

  const statCards = [
    { title: 'Total Movies', value: stats.total, icon: Film, color: 'bg-red-950/60 text-red-400', subtitle: `${stats.active} active`, onClick: () => navigate('/movies') },
    { title: 'Tamil Movies', value: stats.tamil, icon: Globe, color: 'bg-violet-950/60 text-violet-400', onClick: () => navigate('/movies/tamil') },
    { title: 'Hollywood', value: stats.hollywood, icon: Clapperboard, color: 'bg-sky-950/60 text-sky-400', onClick: () => navigate('/movies/hollywood') },
    { title: 'Coming Soon', value: stats.comingSoon, icon: Clock, color: 'bg-amber-950/60 text-amber-400', onClick: () => navigate('/coming-soon') },
    { title: 'Active', value: stats.active, icon: Eye, color: 'bg-emerald-950/60 text-emerald-400' },
    { title: 'Hidden', value: stats.hidden, icon: EyeOff, color: 'bg-zinc-800/80 text-zinc-400' },
    { title: 'API Requests', value: '—', icon: Zap, color: 'bg-purple-950/60 text-purple-400', subtitle: 'Cloudflare Workers' },
    { title: 'Cloudflare Cache', value: '—', icon: Server, color: 'bg-orange-950/60 text-orange-400', subtitle: 'Workers KV' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">VIP Movies Admin Overview</p>
        </div>
        <button
          onClick={() => navigate('/movies')}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-red-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>Add Movie</span>
        </button>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Movies Added Chart */}
        <GlassCard className="lg:col-span-2" hover={false}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-white">Movies Added</h3>
              <p className="text-xs text-zinc-500">Last 7 months activity</p>
            </div>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-full">
              +{monthlyData[6]} this month
            </span>
          </div>
          <div className="h-32 flex items-end gap-2">
            {monthlyData.map((val, i) => {
              const maxVal = Math.max(...monthlyData, 1);
              const pct = (val / maxVal) * 100;
              const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const monthIdx = (new Date().getMonth() - 6 + i + 12) % 12;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center h-24 relative group">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-red-700 to-red-500 transition-all duration-500 cursor-default relative"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-zinc-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {val}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-600 font-medium">{monthNames[monthIdx]}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Category Breakdown */}
        <GlassCard hover={false}>
          <h3 className="font-bold text-white mb-4">Catalogue Breakdown</h3>
          <div className="space-y-3.5">
            <MiniBar label="Active" value={stats.active} max={stats.total} color="bg-emerald-500" />
            <MiniBar label="Coming Soon" value={stats.comingSoon} max={stats.total} color="bg-amber-500" />
            <MiniBar label="Hidden" value={stats.hidden} max={stats.total} color="bg-zinc-500" />
            <MiniBar label="Tamil" value={stats.tamil} max={stats.total} color="bg-violet-500" />
            <MiniBar label="Hollywood" value={stats.hollywood} max={stats.total} color="bg-sky-500" />
          </div>
        </GlassCard>
      </div>

      {/* Recent Movies + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Movies */}
        <GlassCard hover={false}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Recently Added</h3>
            <button
              onClick={() => navigate('/movies')}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold transition-colors"
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3">
            {recentMovies.map(movie => (
              <div key={movie.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-800/40 transition-colors">
                <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                  <img
                    src={`${IMAGE_BASE}${encodeURIComponent(movie.image)}`}
                    alt={movie.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={e => e.target.style.display = 'none'}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">{movie.title}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{movie.year} • {movie.language}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  movie.status?.toLowerCase() === 'active'
                    ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50'
                    : movie.status?.toLowerCase() === 'coming soon'
                    ? 'bg-amber-950/50 text-amber-400 border-amber-800/50'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                }`}>
                  {movie.status}
                </span>
              </div>
            ))}
            {recentMovies.length === 0 && (
              <div className="py-8 text-center text-zinc-600">
                <Film className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No movies yet</p>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Activity Logs */}
        <GlassCard hover={false}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Recent Activity</h3>
            <button
              onClick={() => navigate('/activity-logs')}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold transition-colors"
            >
              Full Log <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            {logs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-zinc-800/40 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5 text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-200">{log.action}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{log.details}</p>
                </div>
                <span className="text-[10px] text-zinc-600 font-medium shrink-0 mt-1">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="py-8 text-center text-zinc-600">
                <Activity className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No activity yet</p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
