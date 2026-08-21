import React from 'react';

export function LoadingSkeleton({ type = 'table', count = 5 }) {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="glass-panel p-5 rounded-xl animate-pulse space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-zinc-800 rounded" />
              <div className="h-8 w-8 bg-zinc-800 rounded-lg" />
            </div>
            <div className="h-8 w-32 bg-zinc-800 rounded" />
            <div className="h-3 w-20 bg-zinc-800/60 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl overflow-hidden animate-pulse">
      <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
        <div className="h-5 w-40 bg-zinc-800 rounded" />
        <div className="h-8 w-60 bg-zinc-800 rounded-lg" />
      </div>
      <div className="divide-y divide-zinc-800/50">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <div className="w-12 h-16 bg-zinc-800 rounded shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 bg-zinc-800 rounded" />
              <div className="h-3 w-1/4 bg-zinc-800/60 rounded" />
            </div>
            <div className="h-6 w-16 bg-zinc-800 rounded-full" />
            <div className="h-8 w-20 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
