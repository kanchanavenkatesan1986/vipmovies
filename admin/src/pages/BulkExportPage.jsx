import React from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { getLocalMovies } from '../api/moviesApi';
import { useToast } from '../context/ToastContext';
import { Download, FileJson, FileText, Package } from 'lucide-react';

export default function BulkExportPage() {
  const { addToast } = useToast();
  const movies = getLocalMovies();

  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = (data, filename) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const rows = [
      headers.join(','),
      ...data.map(m => headers.map(h => `"${String(m[h] || '').replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exports = [
    {
      label: 'All Movies (JSON)',
      description: `Export all ${movies.length} movies in exact API schema format`,
      icon: FileJson,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-800/40',
      action: () => {
        downloadJSON(movies, `vipmovies-all-${Date.now()}.json`);
        addToast(`Exported ${movies.length} movies as JSON`, 'success');
      }
    },
    {
      label: 'All Movies (CSV)',
      description: 'Export catalogue as CSV for Excel/Sheets',
      icon: FileText,
      color: 'text-sky-400',
      bg: 'bg-sky-950/40 border-sky-800/40',
      action: () => {
        downloadCSV(movies, `vipmovies-all-${Date.now()}.csv`);
        addToast(`Exported ${movies.length} movies as CSV`, 'success');
      }
    },
    {
      label: 'Tamil Movies Only',
      description: `Export ${movies.filter(m => m.language?.toLowerCase() === 'tamil').length} Tamil movies`,
      icon: FileJson,
      color: 'text-violet-400',
      bg: 'bg-violet-950/40 border-violet-800/40',
      action: () => {
        const filtered = movies.filter(m => m.language?.toLowerCase() === 'tamil');
        downloadJSON(filtered, `vipmovies-tamil-${Date.now()}.json`);
        addToast(`Exported ${filtered.length} Tamil movies`, 'success');
      }
    },
    {
      label: 'Hollywood Movies Only',
      description: `Export ${movies.filter(m => m.type?.toLowerCase() === 'hollywood').length} Hollywood movies`,
      icon: FileJson,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-800/40',
      action: () => {
        const filtered = movies.filter(m => m.type?.toLowerCase() === 'hollywood');
        downloadJSON(filtered, `vipmovies-hollywood-${Date.now()}.json`);
        addToast(`Exported ${filtered.length} Hollywood movies`, 'success');
      }
    },
    {
      label: 'Coming Soon Only',
      description: `Export ${movies.filter(m => m.status?.toLowerCase() === 'coming soon').length} upcoming movies`,
      icon: FileJson,
      color: 'text-orange-400',
      bg: 'bg-orange-950/40 border-orange-800/40',
      action: () => {
        const filtered = movies.filter(m => m.status?.toLowerCase() === 'coming soon');
        downloadJSON(filtered, `vipmovies-coming-soon-${Date.now()}.json`);
        addToast(`Exported ${filtered.length} Coming Soon movies`, 'success');
      }
    },
    {
      label: 'Full Backup Package',
      description: 'Export all movies + metadata in a single backup bundle',
      icon: Package,
      color: 'text-red-400',
      bg: 'bg-red-950/40 border-red-800/40',
      action: () => {
        const backup = {
          version: '2.0',
          exported_at: new Date().toISOString(),
          total_movies: movies.length,
          movies
        };
        downloadJSON(backup, `vipmovies-backup-${Date.now()}.json`);
        addToast('Full backup exported!', 'success');
      }
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Bulk Export</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Download your movie catalogue in various formats</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exports.map((exp, i) => {
          const Icon = exp.icon;
          return (
            <button
              key={i}
              onClick={exp.action}
              className={`glass-panel glass-panel-hover rounded-xl p-5 text-left border ${exp.bg} flex items-start gap-4 group`}
            >
              <div className={`p-3 rounded-xl ${exp.bg} ${exp.color} shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">{exp.label}</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{exp.description}</p>
              </div>
              <Download className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0 mt-0.5" />
            </button>
          );
        })}
      </div>

      {/* Stats Summary */}
      <GlassCard hover={false}>
        <h3 className="font-semibold text-white text-sm mb-3">Catalogue Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Movies', value: movies.length },
            { label: 'Active', value: movies.filter(m => m.status?.toLowerCase() === 'active').length },
            { label: 'Coming Soon', value: movies.filter(m => m.status?.toLowerCase() === 'coming soon').length },
            { label: 'Hidden', value: movies.filter(m => m.status?.toLowerCase() === 'hidden').length },
          ].map(s => (
            <div key={s.label} className="text-center p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/60">
              <p className="text-xl font-extrabold text-white">{s.value}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
