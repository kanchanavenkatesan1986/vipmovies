import React, { useState } from 'react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { ConfirmationModal } from '../common/ConfirmationModal';
import {
  ArrowUpDown,
  Pencil,
  Trash2,
  Eye,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Link2
} from 'lucide-react';

const PAGE_SIZE = 25;

function getStatusVariant(status) {
  if (!status) return 'default';
  const s = status.toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'coming soon') return 'comingSoon';
  if (s === 'hidden') return 'hidden';
  return 'default';
}

export function MovieTable({
  movies = [],
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onEdit,
  onDelete,
  onPreview,
  onDuplicate,
  onTestLinks,
  sortField,
  sortOrder,
  onSort,
  loading = false
}) {
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const totalPages = Math.ceil(movies.length / PAGE_SIZE);
  const pageMovies = movies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPageSelected = pageMovies.length > 0 && pageMovies.every(m => selectedIds.includes(m.id));

  const handleSelectAll = () => {
    if (allPageSelected) {
      onClearSelection();
    } else {
      onSelectAll(pageMovies.map(m => m.id));
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      onSort(field, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(field, 'asc');
    }
  };

  const SortableHeader = ({ field, label }) => (
    <th
      className="cursor-pointer select-none hover:text-red-400 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === field ? 'text-red-500' : 'text-zinc-600'}`} />
      </div>
    </th>
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    await onDelete(deleteTarget.id);
    setDeletingId(null);
    setDeleteTarget(null);
  };

  const IMAGE_BASE = 'https://api-movies.akatsuki-pvt-ltd.workers.dev/images/';

  return (
    <>
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="netflix-table">
            <thead>
              <tr>
                <th className="w-12 px-4">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded accent-red-600 cursor-pointer"
                  />
                </th>
                <th className="w-14">Poster</th>
                <SortableHeader field="title" label="Title" />
                <SortableHeader field="year" label="Year" />
                <th>Language</th>
                <th>Type</th>
                <th>Category</th>
                <SortableHeader field="status" label="Status" />
                <SortableHeader field="created_at" label="Added" />
                <th className="text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageMovies.map((movie) => (
                <tr
                  key={movie.id}
                  className={`group ${selectedIds.includes(movie.id) ? 'bg-red-950/15 border-l-2 border-l-red-600' : ''}`}
                >
                  <td className="px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(movie.id)}
                      onChange={() => onToggleSelect(movie.id)}
                      className="w-4 h-4 rounded accent-red-600 cursor-pointer"
                    />
                  </td>
                  <td>
                    <div className="w-10 h-14 rounded overflow-hidden bg-zinc-800 shrink-0">
                      <img
                        src={`${IMAGE_BASE}${encodeURIComponent(movie.image)}`}
                        alt={movie.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentNode.classList.add('flex', 'items-center', 'justify-center');
                        }}
                      />
                    </div>
                  </td>
                  <td className="max-w-xs">
                    <p className="font-semibold text-white truncate text-sm leading-tight">{movie.title}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{movie.id}</p>
                  </td>
                  <td className="text-zinc-300 font-medium">{movie.year}</td>
                  <td className="text-zinc-400 text-sm">{movie.language}</td>
                  <td>
                    <Badge variant={movie.type?.toLowerCase() === 'hollywood' ? 'blue' : 'purple'} size="sm">
                      {movie.type}
                    </Badge>
                  </td>
                  <td className="text-zinc-400 text-xs max-w-32 truncate">{movie.category}</td>
                  <td>
                    <Badge variant={getStatusVariant(movie.status)} size="sm">
                      <span className={`w-1.5 h-1.5 rounded-full mr-1 inline-block ${
                        movie.status?.toLowerCase() === 'active' ? 'bg-emerald-400' :
                        movie.status?.toLowerCase() === 'coming soon' ? 'bg-amber-400' : 'bg-zinc-500'
                      }`} />
                      {movie.status}
                    </Badge>
                  </td>
                  <td className="text-zinc-500 text-xs">{movie.created_at}</td>
                  <td className="pr-4">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onPreview(movie)}
                        className="p-1.5 text-zinc-400 hover:text-sky-400 hover:bg-sky-950/40 rounded-lg transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(movie)}
                        className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-950/40 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDuplicate(movie)}
                        className="p-1.5 text-zinc-400 hover:text-purple-400 hover:bg-purple-950/40 rounded-lg transition-colors"
                        title="Clone"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onTestLinks(movie)}
                        className="p-1.5 text-zinc-400 hover:text-green-400 hover:bg-green-950/40 rounded-lg transition-colors"
                        title="Test Links"
                      >
                        <Link2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(movie)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {movies.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl">🎬</span>
                      <p className="text-sm">No movies found. Try adjusting your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-800/60 bg-zinc-950/40">
            <p className="text-xs text-zinc-500">
              Showing <span className="text-zinc-300 font-semibold">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, movies.length)}</span> of{' '}
              <span className="text-zinc-300 font-semibold">{movies.length}</span> movies
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (page <= 3) pageNum = i + 1;
                else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                      page === pageNum
                        ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Movie"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? It will be moved to the Recycle Bin.`}
        confirmText="Move to Trash"
        loading={!!deletingId}
      />
    </>
  );
}
