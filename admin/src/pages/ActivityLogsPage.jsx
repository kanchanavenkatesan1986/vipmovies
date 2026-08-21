import React, { useState, useMemo } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { getActivityLogs } from '../api/moviesApi';
import { History, Search, LogIn, LogOut, Plus, Pencil, Trash2, Bell, Settings, X } from 'lucide-react';

const ACTION_ICONS = {
  'Login': LogIn,
  'Logout': LogOut,
  'Movie Added': Plus,
  'Movie Edited': Pencil,
  'Movie Deleted': Trash2,
  'Movie Restored': Plus,
  'Trash Purged': Trash2,
  'Bulk Delete': Trash2,
  'Bulk Status Update': Pencil,
  'Bulk Import': Plus,
  'Notification Sent': Bell,
  'Settings Changed': Settings,
  'default': History
};

const ACTION_COLORS = {
  'Login': 'text-emerald-400 bg-emerald-950/50 border-emerald-800/40',
  'Logout': 'text-zinc-400 bg-zinc-800/50 border-zinc-700/40',
  'Movie Added': 'text-sky-400 bg-sky-950/50 border-sky-800/40',
  'Movie Edited': 'text-amber-400 bg-amber-950/50 border-amber-800/40',
  'Movie Deleted': 'text-red-400 bg-red-950/50 border-red-800/40',
  'Bulk Delete': 'text-red-400 bg-red-950/50 border-red-800/40',
  'Bulk Status Update': 'text-amber-400 bg-amber-950/50 border-amber-800/40',
  'default': 'text-zinc-400 bg-zinc-800/50 border-zinc-700/40'
};

export default function ActivityLogsPage() {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const allLogs = getActivityLogs();

  const filtered = useMemo(() => {
    return allLogs.filter(log => {
      if (filterAction && log.action !== filterAction) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return log.action.toLowerCase().includes(q) || log.details.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allLogs, search, filterAction]);

  const uniqueActions = [...new Set(allLogs.map(l => l.action))];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Activity Logs</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{allLogs.length} total log entries</p>
        </div>
      </div>

      {/* Filters */}
      <GlassCard hover={false} className="flex flex-wrap items-center gap-3 py-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search logs…"
            className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-600/70 transition-all"
          />
        </div>
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="bg-zinc-900/70 border border-zinc-800 text-zinc-300 rounded-xl px-3 py-2 text-sm focus:outline-none cursor-pointer appearance-none"
        >
          <option value="">All Actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(search || filterAction) && (
          <button
            onClick={() => { setSearch(''); setFilterAction(''); }}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-3 py-2 border border-red-800/40 rounded-xl transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </GlassCard>

      {/* Logs */}
      {filtered.length === 0 ? (
        <GlassCard className="py-20 text-center">
          <History className="w-12 h-12 mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500">No activity logs found</p>
        </GlassCard>
      ) : (
        <GlassCard hover={false} className="p-0 overflow-hidden">
          <div className="divide-y divide-zinc-800/50">
            {filtered.map(log => {
              const Icon = ACTION_ICONS[log.action] || ACTION_ICONS.default;
              const colorClass = ACTION_COLORS[log.action] || ACTION_COLORS.default;
              const date = new Date(log.timestamp);
              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-zinc-800/25 transition-colors">
                  <div className={`p-2 rounded-lg border shrink-0 mt-0.5 ${colorClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-200">{log.action}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{log.details}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-500 font-medium">
                      {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{log.user || 'Admin'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
