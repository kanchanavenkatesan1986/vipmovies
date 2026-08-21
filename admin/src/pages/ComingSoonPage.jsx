import React, { useState, useMemo } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { getLocalMovies } from '../api/moviesApi';
import { Clock, Calendar, Bell, Eye } from 'lucide-react';

function Countdown({ releaseDate }) {
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const release = new Date(releaseDate);
  const diff = release - now;

  if (diff <= 0) {
    return <span className="text-emerald-400 font-bold text-sm">Released!</span>;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / 60000) % 60);
  const secs = Math.floor((diff / 1000) % 60);

  return (
    <div className="flex items-center gap-2">
      {[
        { v: days, l: 'd' },
        { v: hours, l: 'h' },
        { v: mins, l: 'm' },
        { v: secs, l: 's' },
      ].map(({ v, l }) => (
        <div key={l} className="text-center">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white font-mono font-bold text-sm">
            {String(v).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5 uppercase">{l}</div>
        </div>
      ))}
    </div>
  );
}

export default function ComingSoonPage() {
  const movies = getLocalMovies();
  const comingSoon = useMemo(
    () => movies.filter(m => m.status?.toLowerCase() === 'coming soon'),
    [movies]
  );

  const IMAGE_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/images/';

  const parseRelease = (releaseStr) => {
    if (!releaseStr) return null;
    const d = new Date(releaseStr);
    return isNaN(d.getTime()) ? null : d;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Coming Soon</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{comingSoon.length} upcoming movies with live countdowns</p>
      </div>

      {comingSoon.length === 0 ? (
        <GlassCard className="py-20 text-center">
          <Clock className="w-12 h-12 mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 font-medium">No Coming Soon movies found</p>
          <p className="text-xs text-zinc-600 mt-1">Set movie status to "Coming Soon" to see them here</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {comingSoon.map(movie => {
            const releaseDate = parseRelease(movie.release);
            return (
              <GlassCard key={movie.id} className="relative overflow-hidden" glow>
                {/* Background Poster Blur */}
                {movie.image && (
                  <img
                    src={`${IMAGE_BASE}${encodeURIComponent(movie.image)}`}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-5 scale-110"
                  />
                )}
                <div className="relative z-10">
                  <div className="flex gap-4">
                    {/* Poster */}
                    <div className="w-20 h-28 rounded-xl overflow-hidden bg-zinc-800 shrink-0">
                      {movie.image && (
                        <img
                          src={`${IMAGE_BASE}${encodeURIComponent(movie.image)}`}
                          alt={movie.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={e => e.target.style.display = 'none'}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-sm leading-tight truncate">{movie.title}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        <span>{movie.release || 'Release date TBD'}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">{movie.language} • {movie.category}</div>
                    </div>
                  </div>

                  {/* Countdown */}
                  {releaseDate ? (
                    <div className="mt-4 pt-4 border-t border-zinc-800/60">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Time Until Release</p>
                      <Countdown releaseDate={releaseDate} />
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t border-zinc-800/60">
                      <p className="text-xs text-zinc-500 italic">Set a release date for countdown</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4">
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-600/20 border border-amber-700/40 text-amber-400 text-xs font-bold rounded-lg hover:bg-amber-600/30 transition-colors">
                      <Bell className="w-3.5 h-3.5" /> Notify Users
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-sky-600/20 border border-sky-700/40 text-sky-400 text-xs font-bold rounded-lg hover:bg-sky-600/30 transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
