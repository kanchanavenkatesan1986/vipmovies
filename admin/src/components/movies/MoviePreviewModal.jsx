import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import {
  Download,
  Link2,
  Code2,
  Smartphone,
  Globe,
  Copy,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

const IMAGE_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/images/';

function getStatusVariant(status) {
  if (!status) return 'default';
  const s = status.toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'coming soon') return 'comingSoon';
  return 'default';
}

function DownloadRow({ label, url }) {
  const [copied, setCopied] = useState(false);
  if (!url) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-bold text-red-400 uppercase shrink-0">{label}</span>
        <span className="text-xs text-zinc-500 truncate">{url}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleCopy}
          className="p-1.5 text-zinc-400 hover:text-green-400 hover:bg-green-950/40 rounded-lg transition-colors"
          title="Copy URL"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-zinc-400 hover:text-sky-400 hover:bg-sky-950/40 rounded-lg transition-colors"
          title="Open"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

export function MoviePreviewModal({ isOpen, onClose, movie }) {
  const [activeTab, setActiveTab] = useState('details');
  const [jsonCopied, setJsonCopied] = useState(false);

  if (!movie) return null;

  const posterUrl = movie.image ? `${IMAGE_BASE}${encodeURIComponent(movie.image)}` : null;
  const movieJson = JSON.stringify(movie, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(movieJson);
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  };

  const tabs = [
    { id: 'details', label: 'Details', icon: Globe },
    { id: 'downloads', label: 'Downloads', icon: Download },
    { id: 'json', label: 'Raw JSON', icon: Code2 },
    { id: 'preview', label: 'App Preview', icon: Smartphone },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Movie Preview" maxWidth="max-w-5xl">
      <div className="flex flex-col md:flex-row gap-5">
        {/* Poster */}
        <div className="md:w-56 shrink-0">
          <div className="aspect-[2/3] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
                onError={e => e.target.style.display = 'none'}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-5xl">🎬</div>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            <Badge variant={getStatusVariant(movie.status)} className="w-full justify-center">
              {movie.status}
            </Badge>
            <p className="text-[11px] text-zinc-500 text-center font-mono">{movie.id}</p>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-extrabold text-white leading-tight mb-1">{movie.title}</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {movie.year && <Badge variant="blue" size="sm">{movie.year}</Badge>}
            {movie.language && <Badge variant="purple" size="sm">{movie.language}</Badge>}
            {movie.type && <Badge variant="default" size="sm">{movie.type}</Badge>}
            {movie.duration && <Badge variant="default" size="sm">⏱ {movie.duration}</Badge>}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 p-1 bg-zinc-900/60 rounded-xl border border-zinc-800 w-fit">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-red-600 text-white shadow-lg'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === 'details' && (
            <div className="space-y-3 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Release', value: movie.release },
                  { label: 'Category', value: movie.category },
                  { label: 'Director', value: movie.director },
                  { label: 'Created', value: movie.created_at },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-sm text-zinc-200 font-medium">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
              {movie.starring && (
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Starring</p>
                  <p className="text-sm text-zinc-200">{movie.starring}</p>
                </div>
              )}
              {movie.story && (
                <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Story</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{movie.story}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'downloads' && (
            <div className="space-y-2.5 animate-fade-in">
              <DownloadRow label="360P" url={movie.p360} />
              <DownloadRow label="720P" url={movie.p720} />
              <DownloadRow label="1080P" url={movie.p1080} />
              <DownloadRow label="Poster" url={posterUrl} />
            </div>
          )}

          {activeTab === 'json' && (
            <div className="animate-fade-in relative">
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-semibold text-zinc-300 transition-colors"
                >
                  {jsonCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {jsonCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-emerald-400 font-mono overflow-x-auto max-h-72 leading-relaxed">
                {movieJson}
              </pre>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="animate-fade-in">
              <div className="flex gap-4 items-start">
                {/* Website Preview Card */}
                <div className="flex-1 rounded-xl border border-zinc-800/60 overflow-hidden">
                  <div className="bg-zinc-950 px-3 py-1.5 flex items-center gap-2 border-b border-zinc-800/60">
                    <Globe className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[11px] text-zinc-500 font-medium">Website Card Preview</span>
                  </div>
                  <div className="p-4 bg-zinc-900/40 flex gap-3">
                    {posterUrl && (
                      <img
                        src={posterUrl}
                        alt={movie.title}
                        className="w-16 h-24 object-cover rounded-lg shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate">{movie.title}</p>
                      <p className="text-[11px] text-zinc-400 mt-1">{movie.year} • {movie.language}</p>
                      <p className="text-[11px] text-zinc-500 mt-1">{movie.category}</p>
                      <p className="text-[11px] text-zinc-500 mt-2 line-clamp-2 leading-relaxed">{movie.story}</p>
                      <div className="flex gap-1.5 mt-2">
                        {['360P','720P','1080P'].filter((q, i) => [movie.p360, movie.p720, movie.p1080][i]).map(q => (
                          <span key={q} className="text-[10px] px-2 py-0.5 bg-red-600 text-white rounded font-bold">{q}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Android Preview */}
                <div className="w-32 shrink-0 rounded-xl border border-zinc-800/60 overflow-hidden">
                  <div className="bg-zinc-950 px-3 py-1.5 flex items-center gap-2 border-b border-zinc-800/60">
                    <Smartphone className="w-3 h-3 text-zinc-500" />
                    <span className="text-[11px] text-zinc-500">App</span>
                  </div>
                  <div className="bg-zinc-900/40 p-2">
                    {posterUrl && (
                      <img
                        src={posterUrl}
                        alt={movie.title}
                        className="w-full aspect-[2/3] object-cover rounded-lg mb-2"
                      />
                    )}
                    <p className="text-[10px] font-bold text-white leading-tight truncate">{movie.title}</p>
                    <p className="text-[10px] text-zinc-500">{movie.year}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
