import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useLinkTester } from '../../hooks/useLinkTester';
import { CheckCircle2, XCircle, Loader2, ExternalLink, Copy, Link2, Clock, Globe } from 'lucide-react';

const IMAGE_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/images/';

function ResultRow({ label, url, result, onCopy }) {
  if (!url) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 opacity-40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-500 w-14">{label}</span>
          <span className="text-xs text-zinc-600">No URL provided</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-400 w-14">{label}</span>
          <span className="text-xs text-zinc-500 truncate max-w-xs">{url}</span>
        </div>
        <span className="text-xs text-zinc-600">Pending...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${
      result.working
        ? 'bg-emerald-950/20 border-emerald-800/40'
        : 'bg-red-950/20 border-red-800/40'
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        {result.working
          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        }
        <span className="text-xs font-bold text-zinc-300 w-14 shrink-0">{label}</span>
        <div className="min-w-0">
          <p className="text-xs text-zinc-400 truncate max-w-xs">{url}</p>
          {result.error && (
            <p className="text-[10px] text-red-400 mt-0.5">{result.error}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Status + Metrics */}
        <div className="text-right hidden sm:block">
          <span className={`text-xs font-bold ${result.working ? 'text-emerald-400' : 'text-red-400'}`}>
            {result.status}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5 text-zinc-500 text-[10px]">
            <Clock className="w-3 h-3" />
            <span>{result.responseTime}</span>
            {result.statusCode && (
              <span className="font-mono">HTTP {result.statusCode}</span>
            )}
          </div>
        </div>
        {/* Actions */}
        <button
          onClick={() => onCopy(url)}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
          title="Copy URL"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-zinc-400 hover:text-sky-400 hover:bg-sky-950/40 rounded-lg transition-colors"
          title="Open in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

export function DownloadTesterModal({ isOpen, onClose, movie }) {
  const { testing, testResults, testMovieLinks } = useLinkTester();
  const [tested, setTested] = useState(false);
  const [copied, setCopied] = useState(null);

  if (!movie) return null;

  const posterUrl = movie.image ? `${IMAGE_BASE}${encodeURIComponent(movie.image)}` : '';

  const handleTest = async () => {
    const movieWithPoster = { ...movie, image: posterUrl };
    await testMovieLinks(movieWithPoster);
    setTested(true);
  };

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  const workingCount = Object.values(testResults).filter(r => r.working).length;
  const totalTested = Object.values(testResults).length;
  const brokenCount = totalTested - workingCount;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Link Tester — ${movie.title}`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Header Info */}
        <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/60">
          <div className="flex items-center gap-3">
            <Link2 className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-sm font-bold text-white">{movie.title}</p>
              <p className="text-xs text-zinc-500">{movie.id}</p>
            </div>
          </div>
          {tested && totalTested > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-emerald-400 font-bold">✓ {workingCount} Working</span>
              {brokenCount > 0 && <span className="text-red-400 font-bold">✗ {brokenCount} Broken</span>}
            </div>
          )}
        </div>

        {/* Link Rows */}
        <div className="space-y-2.5">
          {[
            { label: '360P', url: movie.p360, key: '360P Stream' },
            { label: '720P', url: movie.p720, key: '720P Stream' },
            { label: '1080P', url: movie.p1080, key: '1080P Stream' },
            { label: 'Poster', url: posterUrl, key: 'Poster Image' },
          ].map(item => (
            <ResultRow
              key={item.label}
              label={item.label}
              url={item.url}
              result={tested ? testResults[item.key] : null}
              onCopy={handleCopy}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-red-900/30"
          >
            {testing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</>
            ) : (
              <><Globe className="w-4 h-4" /> {tested ? 'Re-test All Links' : 'Test All Links'}</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
