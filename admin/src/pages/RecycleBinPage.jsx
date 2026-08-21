import React, { useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { getRecycleBin, saveRecycleBin, getLocalMovies, saveLocalMovies, logActivity } from '../api/moviesApi';
import { useToast } from '../context/ToastContext';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react';

const IMAGE_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/images/';

export default function RecycleBinPage() {
  const { addToast } = useToast();
  const [bin, setBin] = useState(() => getRecycleBin());
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [purgeAll, setPurgeAll] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleRestore = (movie) => {
    const { deletedAt, ...cleanMovie } = movie;
    const movies = getLocalMovies();
    movies.unshift(cleanMovie);
    saveLocalMovies(movies);
    const newBin = bin.filter(m => m.id !== movie.id);
    saveRecycleBin(newBin);
    setBin(newBin);
    logActivity('Movie Restored', `Restored "${cleanMovie.title}" from Recycle Bin`);
    addToast(`"${cleanMovie.title}" restored!`, 'success');
  };

  const handlePurge = async () => {
    setProcessing(true);
    if (purgeAll) {
      saveRecycleBin([]);
      setBin([]);
      logActivity('Trash Purged', 'Permanently purged all items from Recycle Bin');
      addToast('Recycle Bin cleared!', 'info');
    } else if (purgeTarget) {
      const newBin = bin.filter(m => m.id !== purgeTarget.id);
      saveRecycleBin(newBin);
      setBin(newBin);
      logActivity('Trash Purged', `Permanently deleted "${purgeTarget.title}"`);
      addToast(`"${purgeTarget.title}" permanently deleted`, 'info');
    }
    setPurgeTarget(null);
    setPurgeAll(false);
    setProcessing(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Recycle Bin</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{bin.length} deleted movie{bin.length !== 1 ? 's' : ''} · Restore or permanently delete</p>
        </div>
        {bin.length > 0 && (
          <Button variant="danger" icon={Trash2} onClick={() => setPurgeAll(true)}>
            Empty Bin
          </Button>
        )}
      </div>

      {bin.length === 0 ? (
        <GlassCard className="py-20 text-center">
          <Trash2 className="w-16 h-16 mx-auto text-zinc-700 mb-4" />
          <p className="text-zinc-400 font-semibold">Recycle Bin is Empty</p>
          <p className="text-xs text-zinc-600 mt-1">Deleted movies will appear here</p>
        </GlassCard>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 p-4 bg-amber-950/15 border-b border-amber-800/30">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300 font-medium">
              Items in the Recycle Bin are not part of your live catalogue. Restore or permanently delete them.
            </p>
          </div>
          <div className="divide-y divide-zinc-800/50">
            {bin.map(movie => (
              <div key={movie.id} className="flex items-center gap-4 p-4 hover:bg-zinc-800/25 transition-colors">
                {/* Poster */}
                <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0 opacity-60">
                  {movie.image && (
                    <img
                      src={`${IMAGE_BASE}${encodeURIComponent(movie.image)}`}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                      onError={e => e.target.style.display = 'none'}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-300 truncate">{movie.title}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{movie.id} · {movie.year} · {movie.language}</p>
                  {movie.deletedAt && (
                    <p className="text-[10px] text-zinc-700 mt-0.5">
                      Deleted: {new Date(movie.deletedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(movie)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-lg hover:bg-emerald-950/70 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                  <button
                    onClick={() => setPurgeTarget(movie)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-400 bg-red-950/40 border border-red-800/50 rounded-lg hover:bg-red-950/70 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Delete Forever
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!purgeTarget || purgeAll}
        onClose={() => { setPurgeTarget(null); setPurgeAll(false); }}
        onConfirm={handlePurge}
        title={purgeAll ? 'Empty Recycle Bin' : 'Permanently Delete Movie'}
        message={
          purgeAll
            ? `This will permanently delete all ${bin.length} movies in the Recycle Bin. This cannot be undone.`
            : `"${purgeTarget?.title}" will be permanently deleted. This cannot be undone.`
        }
        confirmText={purgeAll ? 'Empty Bin' : 'Delete Forever'}
        loading={processing}
      />
    </div>
  );
}
