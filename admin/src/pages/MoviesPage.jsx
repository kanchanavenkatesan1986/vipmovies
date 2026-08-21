import React, { useState } from 'react';
import { useMovies } from '../hooks/useMovies';
import { MovieTable } from '../components/movies/MovieTable';
import { MovieFormModal } from '../components/movies/MovieFormModal';
import { MoviePreviewModal } from '../components/movies/MoviePreviewModal';
import { MovieFilterBar } from '../components/movies/MovieFilterBar';
import { DownloadTesterModal } from '../components/movies/DownloadTesterModal';
import { Button } from '../components/common/Button';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import { moviesApi } from '../api/moviesApi';
import { useToast } from '../context/ToastContext';
import {
  Plus, Trash2, CheckSquare, RefreshCw, Download as DownloadIcon, Film
} from 'lucide-react';

export default function MoviesPage({ filterType, filterLanguage, title = 'All Movies' }) {
  const { addToast } = useToast();
  const {
    movies,
    filteredMovies,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    refetch,
    addMovie,
    updateMovie,
    deleteMovie,
    bulkDelete,
    bulkStatusUpdate
  } = useMovies();

  const [addOpen, setAddOpen] = useState(false);
  const [editMovie, setEditMovie] = useState(null);
  const [previewMovie, setPreviewMovie] = useState(null);
  const [testLinksMovie, setTestLinksMovie] = useState(null);
  const [bulkStatusValue, setBulkStatusValue] = useState('');

  // Apply page-level prop filters on top of user filters
  const displayedMovies = filteredMovies.filter(m => {
    if (filterType && m.type?.toLowerCase() !== filterType.toLowerCase()) return false;
    if (filterLanguage && m.language?.toLowerCase() !== filterLanguage.toLowerCase()) return false;
    return true;
  });

  const handleDuplicate = async (movie) => {
    const cloned = {
      ...movie,
      id: `${movie.type || 'hollywood'}-${movie.year || '2026'}-clone-${Date.now()}`,
      title: `${movie.title} (Copy)`,
      created_at: new Date().toISOString().split('T')[0]
    };
    await addMovie(cloned);
  };

  const handleSaveEdit = async (formData) => {
    if (editMovie) {
      await updateMovie(editMovie.id, formData);
    } else {
      await addMovie(formData);
    }
  };

  const handleExportSelected = () => {
    const toExport = displayedMovies.filter(m => selectedIds.includes(m.id));
    const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vipmovies-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(`Exported ${toExport.length} movies`, 'success');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">{title}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {displayedMovies.length} movies{selectedIds.length > 0 ? ` • ${selectedIds.length} selected` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refetch()}
            className="p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors border border-zinc-800/60"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button variant="primary" icon={Plus} onClick={() => { setEditMovie(null); setAddOpen(true); }}>
            Add Movie
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <MovieFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFilterChange={setFilters}
        movies={movies}
        onClearAll={() => { setSearchQuery(''); setFilters({ language:'', year:'', status:'', category:'', type:'' }); }}
      />

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="glass-panel rounded-xl px-5 py-3 flex items-center justify-between gap-4 border border-red-900/30 bg-red-950/10 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckSquare className="w-5 h-5 text-red-400" />
            <span className="text-sm font-semibold text-zinc-200">
              {selectedIds.length} movie{selectedIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Bulk Status */}
            <div className="flex items-center gap-2">
              <select
                value={bulkStatusValue}
                onChange={e => setBulkStatusValue(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none cursor-pointer"
              >
                <option value="">Set Status…</option>
                <option value="Active">Active</option>
                <option value="Coming Soon">Coming Soon</option>
                <option value="Hidden">Hidden</option>
              </select>
              {bulkStatusValue && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { bulkStatusUpdate(bulkStatusValue); setBulkStatusValue(''); }}
                >
                  Apply
                </Button>
              )}
            </div>
            <Button variant="secondary" size="sm" icon={DownloadIcon} onClick={handleExportSelected}>
              Export
            </Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={bulkDelete}>
              Delete Selected
            </Button>
            <button onClick={clearSelection} className="text-xs text-zinc-500 hover:text-white px-2 transition-colors">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingSkeleton type="table" count={8} />
      ) : error ? (
        <div className="glass-panel rounded-2xl p-12 text-center">
          <p className="text-red-400 font-semibold">{error}</p>
          <button onClick={refetch} className="mt-3 text-sm text-zinc-400 hover:text-white transition-colors">
            Try again
          </button>
        </div>
      ) : (
        <MovieTable
          movies={displayedMovies}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onEdit={(m) => { setEditMovie(m); setAddOpen(true); }}
          onDelete={deleteMovie}
          onPreview={setPreviewMovie}
          onDuplicate={handleDuplicate}
          onTestLinks={setTestLinksMovie}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={(field, order) => { setSortField(field); setSortOrder(order); }}
          loading={loading}
        />
      )}

      {/* Modals */}
      <MovieFormModal
        isOpen={addOpen}
        onClose={() => { setAddOpen(false); setEditMovie(null); }}
        onSave={handleSaveEdit}
        editMovie={editMovie}
      />
      <MoviePreviewModal
        isOpen={!!previewMovie}
        onClose={() => setPreviewMovie(null)}
        movie={previewMovie}
      />
      <DownloadTesterModal
        isOpen={!!testLinksMovie}
        onClose={() => setTestLinksMovie(null)}
        movie={testLinksMovie}
      />
    </div>
  );
}
