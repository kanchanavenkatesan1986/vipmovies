import React, { useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { getLocalMovies } from '../api/moviesApi';
import { useToast } from '../context/ToastContext';
import {
  Image as ImageIcon, Upload, Trash2, Eye, AlertTriangle, CheckCircle2, Loader2
} from 'lucide-react';

const IMAGE_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/images/';

export default function ImageManagerPage() {
  const { addToast } = useToast();
  const movies = getLocalMovies();
  const [scanning, setScanning] = useState(false);
  const [brokenPosters, setBrokenPosters] = useState([]);
  const [missingPosters, setMissingPosters] = useState([]);
  const [scanDone, setScanDone] = useState(false);
  const [preview, setPreview] = useState(null);

  const moviesWithPosters = movies.filter(m => m.image);
  const moviesNoPosters = movies.filter(m => !m.image);

  const scanPosters = async () => {
    setScanning(true);
    setScanDone(false);
    setBrokenPosters([]);
    setMissingPosters(moviesNoPosters.map(m => m.title));

    const broken = [];
    for (const movie of moviesWithPosters.slice(0, 30)) {
      const url = `${IMAGE_BASE}${encodeURIComponent(movie.image)}`;
      try {
        await new Promise((resolve, reject) => {
          const img = new window.Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
          setTimeout(reject, 5000);
        });
      } catch {
        broken.push({ title: movie.title, id: movie.id, image: movie.image, url });
      }
    }
    setBrokenPosters(broken);
    setScanDone(true);
    setScanning(false);
    addToast(`Scan complete: ${broken.length} broken poster(s) found`, broken.length > 0 ? 'error' : 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Image Manager</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Manage movie poster images from Cloudflare R2</p>
        </div>
        <Button
          variant="primary"
          icon={scanning ? Loader2 : ImageIcon}
          loading={scanning}
          onClick={scanPosters}
        >
          {scanDone ? 'Re-scan Posters' : 'Scan for Broken Posters'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Movies', value: movies.length, color: 'text-zinc-300' },
          { label: 'With Posters', value: moviesWithPosters.length, color: 'text-emerald-400' },
          { label: 'Missing Posters', value: moviesNoPosters.length, color: 'text-amber-400' }
        ].map(s => (
          <GlassCard key={s.label} className="flex items-center gap-4">
            <ImageIcon className={`w-8 h-8 ${s.color}`} />
            <div>
              <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-zinc-500">{s.label}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Scan Results */}
      {scanDone && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Broken */}
          <GlassCard hover={false} className="border border-red-900/30">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Broken Posters ({brokenPosters.length})
            </h3>
            {brokenPosters.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-emerald-400 font-semibold text-sm">All scanned posters are working!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {brokenPosters.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-900/30 rounded-xl">
                    <div className="w-8 h-10 bg-zinc-800 rounded flex items-center justify-center shrink-0 text-red-600">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-300 truncate">{p.title}</p>
                      <p className="text-[11px] text-zinc-600 truncate">{p.image}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Missing */}
          <GlassCard hover={false} className="border border-amber-900/30">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Missing Poster Field ({missingPosters.length})
            </h3>
            {missingPosters.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-emerald-400 font-semibold text-sm">All movies have poster filenames!</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1.5">
                {missingPosters.map((title, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-amber-950/15 border border-amber-800/30 rounded-lg text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-zinc-400 truncate">{title}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Poster Gallery */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-4">Recent Posters Gallery</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {moviesWithPosters.slice(0, 40).map(movie => (
            <div
              key={movie.id}
              className="aspect-[2/3] rounded-lg overflow-hidden bg-zinc-800 cursor-pointer group relative"
              onClick={() => setPreview(`${IMAGE_BASE}${encodeURIComponent(movie.image)}`)}
            >
              <img
                src={`${IMAGE_BASE}${encodeURIComponent(movie.image)}`}
                alt={movie.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                onError={e => e.target.style.opacity = '0'}
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Eye className="w-5 h-5 text-white" />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Full Preview Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview}
            alt="Full poster"
            className="max-h-[85vh] max-w-2xl w-auto rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
