import React, { useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { getLocalMovies } from '../api/moviesApi';
import { useLinkTester } from '../hooks/useLinkTester';
import {
  Link2Off, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Download, RefreshCw, Scan
} from 'lucide-react';

const IMAGE_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/images/';

export default function BrokenLinksPage() {
  const movies = getLocalMovies();
  const { testSingleUrl } = useLinkTester();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    setDone(false);
    setResults([]);
    setProgress(0);

    const allResults = [];
    const total = movies.length;

    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i];
      const links = [
        { label: 'Poster', url: movie.image ? `${IMAGE_BASE}${encodeURIComponent(movie.image)}` : '' },
        { label: '360P', url: movie.p360 || '' },
        { label: '720P', url: movie.p720 || '' },
        { label: '1080P', url: movie.p1080 || '' },
      ];

      const movieResult = {
        movie: { id: movie.id, title: movie.title, image: movie.image },
        links: []
      };

      for (const link of links) {
        if (!link.url) {
          movieResult.links.push({ label: link.label, url: '', status: 'Missing', working: false });
          continue;
        }
        const res = await testSingleUrl(link.url, link.label);
        movieResult.links.push({ label: link.label, url: link.url, ...res });
      }

      const hasBroken = movieResult.links.some(l => !l.working);
      if (hasBroken) {
        allResults.push(movieResult);
        setResults([...allResults]);
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setScanning(false);
    setDone(true);
  };

  const exportReport = () => {
    const lines = ['BROKEN LINKS REPORT - VIP Movies Admin', '='.repeat(50), ''];
    results.forEach(r => {
      lines.push(`Movie: ${r.movie.title} (${r.movie.id})`);
      r.links.filter(l => !l.working).forEach(l => {
        lines.push(`  [${l.label}] ${l.url || 'MISSING'} — ${l.status}`);
      });
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `broken-links-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalBroken = results.reduce((acc, r) => acc + r.links.filter(l => !l.working).length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Broken Link Scanner</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Scan all {movies.length} movies for broken poster and download links
          </p>
        </div>
        <div className="flex gap-2">
          {done && results.length > 0 && (
            <Button variant="secondary" icon={Download} onClick={exportReport}>
              Export Report
            </Button>
          )}
          <Button
            variant="primary"
            icon={scanning ? Loader2 : Scan}
            loading={scanning}
            onClick={handleScan}
            disabled={scanning || movies.length === 0}
          >
            {scanning ? `Scanning… ${progress}%` : done ? 'Re-scan All' : 'Scan All Links'}
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      {scanning && (
        <GlassCard hover={false} className="animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-zinc-300">Scanning movies…</p>
            <span className="text-sm font-bold text-red-400">{progress}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-700 to-red-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">{results.length} movies with broken links found so far…</p>
        </GlassCard>
      )}

      {/* Results Summary */}
      {done && (
        <GlassCard hover={false} className={`animate-fade-in border ${
          totalBroken > 0 ? 'border-red-900/40 bg-red-950/10' : 'border-emerald-900/40 bg-emerald-950/10'
        }`}>
          <div className="flex items-center gap-4">
            {totalBroken > 0 ? (
              <AlertTriangle className="w-8 h-8 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
            )}
            <div>
              <p className={`font-bold text-lg ${totalBroken > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {totalBroken > 0
                  ? `${totalBroken} Broken Links Found Across ${results.length} Movies`
                  : 'All Links are Working! ✓'}
              </p>
              <p className="text-sm text-zinc-500">Scanned {movies.length} movies · {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((r, ri) => (
            <GlassCard key={ri} hover={false} className="border border-red-900/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                  {r.movie.image && (
                    <img
                      src={`${IMAGE_BASE}${encodeURIComponent(r.movie.image)}`}
                      alt={r.movie.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={e => e.target.style.display = 'none'}
                    />
                  )}
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{r.movie.title}</p>
                  <p className="text-[11px] text-zinc-500">{r.movie.id}</p>
                </div>
                <Badge variant="red" size="sm" className="ml-auto">
                  {r.links.filter(l => !l.working).length} broken
                </Badge>
              </div>
              <div className="space-y-2">
                {r.links.map((link, li) => (
                  <div
                    key={li}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs border ${
                      link.working
                        ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'
                        : link.status === 'Missing'
                        ? 'bg-zinc-900/40 border-zinc-800/40 text-zinc-500'
                        : 'bg-red-950/25 border-red-900/40 text-red-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {link.working
                        ? <CheckCircle2 className="w-3.5 h-3.5" />
                        : <XCircle className="w-3.5 h-3.5" />
                      }
                      <span className="font-bold w-12">{link.label}</span>
                      <span className="text-zinc-500 truncate max-w-xs font-mono">{link.url || '(empty)'}</span>
                    </div>
                    <span className="font-semibold shrink-0">{link.status} {link.responseTime ? `· ${link.responseTime}` : ''}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Initial Empty State */}
      {!scanning && !done && (
        <GlassCard hover={false} className="py-20 text-center">
          <Link2Off className="w-16 h-16 mx-auto text-zinc-700 mb-4" />
          <p className="text-zinc-400 font-semibold">Ready to Scan</p>
          <p className="text-xs text-zinc-600 mt-1 max-w-sm mx-auto">
            Click "Scan All Links" to automatically check all poster images and download URLs across your entire catalogue.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
