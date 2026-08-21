import React, { useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { getLocalMovies, getRecycleBin, saveLocalMovies, saveRecycleBin, logActivity } from '../api/moviesApi';
import { useToast } from '../context/ToastContext';
import { Database, Download, Upload, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function BackupPage() {
  const { addToast } = useToast();
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const downloadJSON = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDatabase = () => {
    const movies = getLocalMovies();
    const bin = getRecycleBin();
    const backup = {
      type: 'vip-movies-backup',
      version: '2.0',
      exported_at: new Date().toISOString(),
      total_movies: movies.length,
      movies,
      recycle_bin: bin
    };
    downloadJSON(backup, `vipmovies-db-backup-${Date.now()}.json`);
    addToast('Database backup exported!', 'success');
    logActivity('Backup', 'Exported full database backup');
  };

  const handleExportMoviesOnly = () => {
    const movies = getLocalMovies();
    downloadJSON(movies, `vipmovies-movies-${Date.now()}.json`);
    addToast(`Exported ${movies.length} movies!`, 'success');
  };

  const handleExportImageManifest = () => {
    const movies = getLocalMovies();
    const manifest = movies.map(m => ({
      id: m.id,
      title: m.title,
      image: m.image,
      url: m.image ? `https://api-movies.akatsuki-pvt-ltd.workers.dev/images/${encodeURIComponent(m.image)}` : null
    }));
    downloadJSON(manifest, `vipmovies-image-manifest-${Date.now()}.json`);
    addToast('Image manifest exported!', 'success');
  };

  const handleRestoreFromFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      setRestoring(true);
      setRestoreSuccess(false);
      try {
        const data = JSON.parse(ev.target.result);
        if (data.type === 'vip-movies-backup' && Array.isArray(data.movies)) {
          saveLocalMovies(data.movies);
          if (data.recycle_bin) saveRecycleBin(data.recycle_bin);
          logActivity('Backup Restored', `Restored ${data.movies.length} movies from backup`);
          addToast(`Restored ${data.movies.length} movies from backup!`, 'success');
          setRestoreSuccess(true);
        } else if (Array.isArray(data)) {
          saveLocalMovies(data);
          logActivity('Backup Restored', `Restored ${data.length} movies from JSON file`);
          addToast(`Restored ${data.length} movies!`, 'success');
          setRestoreSuccess(true);
        } else {
          addToast('Invalid backup format', 'error');
        }
      } catch {
        addToast('Failed to parse backup file', 'error');
      } finally {
        setRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const backupActions = [
    {
      label: 'Export Full Database Backup',
      description: 'Movies + Recycle Bin + metadata as a complete backup bundle',
      icon: Database,
      color: 'text-red-400',
      bg: 'bg-red-950/30 border-red-800/40',
      action: handleExportDatabase
    },
    {
      label: 'Export Movies Only',
      description: `Download all ${getLocalMovies().length} movies in raw JSON array format`,
      icon: Package,
      color: 'text-sky-400',
      bg: 'bg-sky-950/30 border-sky-800/40',
      action: handleExportMoviesOnly
    },
    {
      label: 'Export Image Manifest',
      description: 'Download poster filenames and their resolved URLs',
      icon: Download,
      color: 'text-violet-400',
      bg: 'bg-violet-950/30 border-violet-800/40',
      action: handleExportImageManifest
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Backup &amp; Restore</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Export your catalogue and restore from previous backups</p>
      </div>

      {/* Export Cards */}
      <div className="space-y-3">
        {backupActions.map((action, i) => {
          const Icon = action.icon;
          return (
            <button
              key={i}
              onClick={action.action}
              className={`w-full glass-panel glass-panel-hover rounded-xl p-5 text-left flex items-center gap-5 border ${action.bg} group`}
            >
              <div className={`p-3 rounded-xl ${action.bg} ${action.color} shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className={`font-bold text-white group-hover:${action.color} transition-colors`}>{action.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{action.description}</p>
              </div>
              <Download className="w-5 h-5 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Restore */}
      <GlassCard hover={false} className="border border-amber-900/30">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-amber-400 shrink-0">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white">Restore Backup</h3>
            <p className="text-sm text-zinc-500 mt-0.5">Upload a backup JSON file to restore movies to your catalogue</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            <strong>Warning:</strong> Restoring from backup will overwrite your current catalogue. This action cannot be undone. Export a backup first!
          </p>
        </div>

        {restoreSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl mb-4 text-emerald-400 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            Restore completed successfully! Refresh the page to see changes.
          </div>
        )}

        <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-amber-700/40 rounded-xl cursor-pointer hover:border-amber-600/60 hover:bg-amber-950/20 transition-all text-center">
          <Upload className="w-10 h-10 text-amber-500/60" />
          <div>
            <p className="text-sm font-semibold text-zinc-300">Upload Backup File</p>
            <p className="text-xs text-zinc-600 mt-1">Accepts .json backup files exported from this admin panel</p>
          </div>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleRestoreFromFile}
          />
          {restoring && (
            <span className="text-sm text-amber-400 font-bold animate-pulse">Restoring…</span>
          )}
        </label>
      </GlassCard>
    </div>
  );
}
