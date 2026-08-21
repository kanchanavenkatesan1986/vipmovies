import React, { useState, useMemo } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { getLocalMovies } from '../api/moviesApi';
import { BarChart3, TrendingUp, Film, Globe, Download, Eye } from 'lucide-react';

const IMAGE_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/images/';

function PieChart({ data, size = 120 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let offset = 0;
  const cx = size / 2, cy = size / 2, r = size / 2 - 8;

  const slices = data.map((d) => {
    const pct = total > 0 ? d.value / total : 0;
    const angle = pct * 2 * Math.PI;
    const startX = cx + r * Math.sin(offset);
    const startY = cy - r * Math.cos(offset);
    offset += angle;
    const endX = cx + r * Math.sin(offset);
    const endY = cy - r * Math.cos(offset);
    const largeArc = pct > 0.5 ? 1 : 0;

    return {
      d: `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`,
      color: d.color,
      label: d.label,
      value: d.value,
      pct: Math.round(pct * 100)
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <path key={i} d={s.d} fill={s.color} opacity={0.85}>
          <title>{s.label}: {s.pct}%</title>
        </path>
      ))}
    </svg>
  );
}

function HorizontalBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-300 font-medium truncate pr-2">{d.label}</span>
            <span className="text-zinc-400 font-bold shrink-0">{d.value}</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color || '#e50914' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const movies = getLocalMovies();

  const stats = useMemo(() => {
    const byLanguage = {};
    const byCategory = {};
    const byType = {};
    const byYear = {};
    const byStatus = {};

    movies.forEach(m => {
      const lang = m.language || 'Unknown';
      byLanguage[lang] = (byLanguage[lang] || 0) + 1;

      (m.category || '').split(',').forEach(c => {
        const cat = c.trim();
        if (cat) byCategory[cat] = (byCategory[cat] || 0) + 1;
      });

      const type = m.type || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;

      const year = String(m.year || 'Unknown');
      byYear[year] = (byYear[year] || 0) + 1;

      const status = m.status || 'Unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });

    const topLanguages = Object.entries(byLanguage)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([label, value], i) => ({ label, value, color: ['#e50914','#7c3aed','#0284c7','#16a34a','#d97706','#db2777','#ea580c','#65a30d'][i] }));

    const topCategories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([label, value]) => ({ label, value, color: '#e50914' }));

    const pieType = Object.entries(byType)
      .map(([label, value], i) => ({ label, value, color: ['#e50914','#7c3aed','#0284c7','#16a34a','#d97706'][i] }));

    const pieStatus = Object.entries(byStatus)
      .map(([label, value]) => ({
        label,
        value,
        color: label === 'Active' ? '#16a34a' : label === 'Coming Soon' ? '#d97706' : '#3f3f46'
      }));

    const byYearArr = Object.entries(byYear)
      .sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 8)
      .map(([label, value]) => ({ label, value, color: '#e50914' }));

    return { topLanguages, topCategories, pieType, pieStatus, byYearArr };
  }, [movies]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Analytics</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Catalogue analysis and breakdown charts</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Movies', value: movies.length, icon: Film, color: 'text-red-400' },
          { label: 'Languages', value: new Set(movies.map(m => m.language)).size, icon: Globe, color: 'text-sky-400' },
          { label: 'Active', value: movies.filter(m => m.status?.toLowerCase() === 'active').length, icon: Eye, color: 'text-emerald-400' },
          { label: 'Coming Soon', value: movies.filter(m => m.status?.toLowerCase() === 'coming soon').length, icon: TrendingUp, color: 'text-amber-400' },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <GlassCard key={i} className="flex items-center gap-4">
              <div className={`text-3xl font-extrabold ${c.color}`}>{c.value}</div>
              <div>
                <Icon className={`w-5 h-5 ${c.color} mb-0.5`} />
                <p className="text-xs text-zinc-500">{c.label}</p>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Languages */}
        <GlassCard hover={false}>
          <h3 className="font-bold text-white mb-1">Movies by Language</h3>
          <p className="text-xs text-zinc-500 mb-4">Distribution across all languages</p>
          <div className="flex items-center gap-6">
            <PieChart data={stats.topLanguages} size={130} />
            <div className="flex-1 space-y-2">
              {stats.topLanguages.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-zinc-400 flex-1 truncate">{d.label}</span>
                  <span className="text-zinc-300 font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Status breakdown */}
        <GlassCard hover={false}>
          <h3 className="font-bold text-white mb-1">Movies by Status</h3>
          <p className="text-xs text-zinc-500 mb-4">Active vs Coming Soon vs Hidden</p>
          <div className="flex items-center gap-6">
            <PieChart data={stats.pieStatus} size={130} />
            <div className="flex-1 space-y-3">
              {stats.pieStatus.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-zinc-300 font-medium">{d.label}</span>
                  </div>
                  <span className="text-white font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Categories */}
        <GlassCard hover={false}>
          <h3 className="font-bold text-white mb-1">Top Categories</h3>
          <p className="text-xs text-zinc-500 mb-4">Most used genres in the catalogue</p>
          <HorizontalBarChart data={stats.topCategories} />
        </GlassCard>

        {/* By Year */}
        <GlassCard hover={false}>
          <h3 className="font-bold text-white mb-1">Movies by Year</h3>
          <p className="text-xs text-zinc-500 mb-4">Catalogue breakdown by release year</p>
          <HorizontalBarChart data={stats.byYearArr} />
        </GlassCard>
      </div>

      {/* Type Distribution */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-4">Movie Type Distribution</h3>
        <div className="flex items-center gap-8">
          <PieChart data={stats.pieType} size={150} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1">
            {stats.pieType.map((d, i) => (
              <div key={i} className="flex items-center gap-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/60">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                <div>
                  <p className="text-xs text-zinc-400 capitalize">{d.label}</p>
                  <p className="text-lg font-extrabold text-white">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
