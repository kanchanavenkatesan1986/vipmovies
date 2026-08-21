import { useState, useEffect, useCallback, useMemo } from 'react';
import { moviesApi, getLocalMovies } from '../api/moviesApi';
import { useToast } from '../context/ToastContext';

export function useMovies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    language: '',
    year: '',
    status: '',
    category: '',
    type: ''
  });
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);
  const { addToast } = useToast();

  const loadMovies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await moviesApi.fetchAllMovies();
      setMovies(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load movie catalogue');
      setMovies(getLocalMovies());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMovies();
  }, [loadMovies]);

  // Instant Debounced / Reactive Filter & Search logic
  const filteredMovies = useMemo(() => {
    return movies.filter((movie) => {
      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = movie.title?.toLowerCase().includes(q);
        const directorMatch = movie.director?.toLowerCase().includes(q);
        const starringMatch = movie.starring?.toLowerCase().includes(q);
        const idMatch = movie.id?.toLowerCase().includes(q);
        const catMatch = movie.category?.toLowerCase().includes(q);
        if (!titleMatch && !directorMatch && !starringMatch && !idMatch && !catMatch) {
          return false;
        }
      }

      // Dropdown filters
      if (filters.language && movie.language?.toLowerCase() !== filters.language.toLowerCase()) {
        return false;
      }
      if (filters.year && String(movie.year) !== String(filters.year)) {
        return false;
      }
      if (filters.status && movie.status?.toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }
      if (filters.type && movie.type?.toLowerCase() !== filters.type.toLowerCase()) {
        return false;
      }
      if (filters.category && !movie.category?.toLowerCase().includes(filters.category.toLowerCase())) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (sortField === 'year' || sortField === 'created_at') {
        valA = String(valA);
        valB = String(valB);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [movies, searchQuery, filters, sortField, sortOrder]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback((ids) => {
    setSelectedIds(ids);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleAddMovie = async (movieData) => {
    try {
      const created = await moviesApi.createMovie(movieData);
      setMovies((prev) => [created, ...prev]);
      addToast(`Movie "${created.title}" created successfully!`, 'success');
      return created;
    } catch (e) {
      addToast(e.message || 'Failed to add movie', 'error');
      throw e;
    }
  };

  const handleUpdateMovie = async (id, updatedFields) => {
    try {
      const updated = await moviesApi.updateMovie(id, updatedFields);
      setMovies((prev) => prev.map((m) => (String(m.id) === String(id) ? updated : m)));
      addToast(`Movie updated successfully!`, 'success');
      return updated;
    } catch (e) {
      addToast(e.message || 'Failed to update movie', 'error');
      throw e;
    }
  };

  const handleDeleteMovie = async (id) => {
    try {
      await moviesApi.deleteMovie(id);
      setMovies((prev) => prev.filter((m) => String(m.id) !== String(id)));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      addToast('Movie moved to Recycle Bin', 'info');
    } catch (e) {
      addToast('Failed to delete movie', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await moviesApi.bulkDelete(selectedIds);
      setMovies((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
      addToast(`${selectedIds.length} movies moved to Recycle Bin`, 'info');
      clearSelection();
    } catch (e) {
      addToast('Bulk delete failed', 'error');
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    if (selectedIds.length === 0) return;
    try {
      await moviesApi.bulkUpdateStatus(selectedIds, status);
      setMovies((prev) =>
        prev.map((m) => (selectedIds.includes(m.id) ? { ...m, status } : m))
      );
      addToast(`Updated status for ${selectedIds.length} movies to "${status}"`, 'success');
      clearSelection();
    } catch (e) {
      addToast('Bulk status update failed', 'error');
    }
  };

  return {
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
    refetch: loadMovies,
    addMovie: handleAddMovie,
    updateMovie: handleUpdateMovie,
    deleteMovie: handleDeleteMovie,
    bulkDelete: handleBulkDelete,
    bulkStatusUpdate: handleBulkStatusUpdate
  };
}
