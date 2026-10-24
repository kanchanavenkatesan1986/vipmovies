import React, { useState, useEffect, useMemo, useRef } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { movieApi } from '../services/movieApi';
import { slideApi } from '../services/slideApi';
import { VALID_TABLES, getMovieTable, dbToDisplayType, displayToDbType } from '../utils/tableMapper';
import MovieFormModal from '../components/movies/MovieFormModal';
import MovieDetailsModal from '../components/movies/MovieDetailsModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import ArrangeMoviesModal from '../components/movies/ArrangeMoviesModal';
import { showToast } from '../components/common/ToastContainer';
import { dispatchOptimisticUpdate } from '../services/syncManager';

export default function MoviesPage({ navigateTo, initialType = '', initialYear = '' }) {
  const [loading, setLoading] = useState(true);
  const [allMovies, setAllMovies] = useState([]);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [selectedContentType, setSelectedContentType] = useState(''); // '' | 'movie' | 'series'
  const [selectedType, setSelectedType] = useState(initialType || '');
  const [selectedYear, setSelectedYear] = useState(initialYear || '');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Bulk / Sequence Selection (Order 1, 2, 3...)
  const [selectedIds, setSelectedIds] = useState([]);
  const [isOrderMode, setIsOrderMode] = useState(false);

  // Modals state
  const [isArrangeModalOpen, setIsArrangeModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingMovie, setEditingMovie] = useState(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [viewingMovie, setViewingMovie] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingMovie, setDeletingMovie] = useState(null);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Add Movie to Homepage Slider state
  const [sliderCandidate, setSliderCandidate] = useState(null);
  const [isSliderConfirmOpen, setIsSliderConfirmOpen] = useState(false);

  // Selected movies in their exact clicked order (1, 2, 3...)
  const selectedMoviesList = useMemo(() => {
    return selectedIds
      .map(id => allMovies.find(m => String(m.id) === String(id)))
      .filter(Boolean);
  }, [selectedIds, allMovies]);

  // Optimistic instant millisecond UI update when movies are rearranged or swapped
  const handleOptimisticMoviesUpdate = (optimisticMovies) => {
    if (!optimisticMovies || optimisticMovies.length === 0) return;
    const optimisticIdSet = new Set(optimisticMovies.map(m => String(m.id)));
    setAllMovies(prev => {
      // Remove previous versions of movies occupying these target IDs
      const unchanged = prev.filter(m => !optimisticIdSet.has(String(m.id)));
      return [...unchanged, ...optimisticMovies];
    });
    setSelectedIds([]);
  };

  // Fetch movies from tables based on current selection or all tables
  const loadMovies = async (force = false) => {
    // Don't show full-page spinner during background refreshes (force=true)
    if (!force) setLoading(true);
    try {
      let tablesToFetch = [];
      if (selectedType && selectedYear) {
        tablesToFetch = [getMovieTable(selectedType, selectedYear)];
      } else if (selectedType) {
        const norm = displayToDbType(selectedType);
        tablesToFetch = VALID_TABLES.filter(t => t.startsWith(`${norm}_`));
      } else if (selectedYear) {
        tablesToFetch = VALID_TABLES.filter(t => t.endsWith(`_${selectedYear}`));
      } else {
        tablesToFetch = VALID_TABLES.filter(t => t !== 'slider');
      }

      let combined = [];
      for (const table of tablesToFetch) {
        try {
          const records = await movieApi.getMovies(table, force);
          // Attach source table to record for bulk deletion reference
          const enriched = records.map(r => ({ ...r, _sourceTable: table }));
          combined = combined.concat(enriched);
        } catch (e) {
          console.error(`Failed to load ${table}:`, e);
        }
      }

      setAllMovies(combined);
      if (!force) setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedType(initialType || '');
    setSelectedYear(initialYear || '');
  }, [initialType, initialYear]);

  useEffect(() => {
    loadMovies(false);
  }, [selectedType, selectedYear]);

  // Listen for cross-tab catalog updates (from other admin operations or main website)
  // and auto-refetch so admin table always shows the latest D1 data.
  const refetchTimerRef = useRef(null);
  useEffect(() => {
    const onCatalogUpdated = (e) => {
      // Debounce: only refetch once if multiple events fire quickly
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => {
        loadMovies(true);
      }, 600);
    };

    // Listen for vip_catalog_updated fired by triggerCatalogSync
    window.addEventListener('vip_catalog_updated', onCatalogUpdated);

    // Also listen via BroadcastChannel for cross-tab updates
    let bc = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('vip_catalog_sync');
        bc.onmessage = (msg) => {
          const data = msg?.data || {};
          // Only react to full catalog updates (not optimistic-only ones from this same tab)
          if (data.type === 'CATALOG_UPDATE') {
            onCatalogUpdated();
          }
        };
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('vip_catalog_updated', onCatalogUpdated);
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      if (bc) bc.close();
    };
  }, [selectedType, selectedYear]);

  // Derived filtered & searched movies
  const filteredMovies = useMemo(() => {
    let result = allMovies;

    if (searchText.trim()) {
      const term = searchText.toLowerCase().trim();
      result = result.filter(m =>
        (m.title && m.title.toLowerCase().includes(term)) ||
        (m.id && m.id.toLowerCase().includes(term)) ||
        (m.director && m.director.toLowerCase().includes(term)) ||
        (m.starring && m.starring.toLowerCase().includes(term)) ||
        (m.category && m.category.toLowerCase().includes(term)) ||
        (m.language && m.language.toLowerCase().includes(term))
      );
    }

    if (selectedContentType) {
      result = result.filter(m => {
        const cType = (m.contentType || (Array.isArray(m.episodes) && m.episodes.length > 0 ? 'series' : 'movie')).toLowerCase();
        return cType === selectedContentType.toLowerCase();
      });
    }

    if (selectedStatus) {
      const normStat = selectedStatus.toLowerCase();
      result = result.filter(m => (m.status || '').toLowerCase() === normStat);
    }

    if (selectedCategory) {
      const catLower = selectedCategory.toLowerCase();
      result = result.filter(m => (m.category || '').toLowerCase().includes(catLower));
    }

    if (selectedLanguage) {
      result = result.filter(m => (m.language || '').toLowerCase() === selectedLanguage.toLowerCase());
    }

    return [...result].sort((a, b) => {
      const getNum = (id) => {
        if (!id) return 0;
        if (typeof window !== 'undefined' && typeof window.getMovieNumber === 'function') {
          const num = window.getMovieNumber(id);
          if (!isNaN(num) && num !== 0) return num;
        }
        const parts = String(id).split(/[-_]/);
        const last = parseInt(parts[parts.length - 1], 10);
        return isNaN(last) ? 0 : last;
      };
      const numA = getNum(a.id);
      const numB = getNum(b.id);
      if (numA !== numB) return numA - numB;
      const dateA = a.created_at || '';
      const dateB = b.created_at || '';
      return dateB.localeCompare(dateA);
    });
  }, [allMovies, searchText, selectedContentType, selectedStatus, selectedCategory, selectedLanguage]);

  // Pagination calculation
  const totalRecords = filteredMovies.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedMovies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMovies.slice(start, start + pageSize);
  }, [filteredMovies, currentPage, pageSize]);

  // Checkbox handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(paginatedMovies.map(m => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchText('');
    setSelectedContentType('');
    setSelectedType('');
    setSelectedYear('');
    setSelectedStatus('');
    setSelectedCategory('');
    setSelectedLanguage('');
    setCurrentPage(1);
  };

  // Prompt to feature movie on homepage slider
  const handlePromptAddToSlider = (movie) => {
    setSliderCandidate(movie);
    setIsSliderConfirmOpen(true);
  };

  // Confirm adding movie to homepage slider
  const handleConfirmAddToSlider = async () => {
    if (!sliderCandidate) return;
    const movie = sliderCandidate;
    setIsSliderConfirmOpen(false);
    try {
      const isSeries = movie.contentType === 'series' || (Array.isArray(movie.episodes) && movie.episodes.length > 0);
      const destinationUrl = isSeries
        ? `https://vip-movies.pages.dev/watch-series.html?id=${movie.id}`
        : `https://vip-movies.pages.dev/watch-movie.html?id=${movie.id}`;
      const slidePayload = {
        title: movie.title || '',
        image: movie.image || '',
        url: destinationUrl,
        status: 'active'
      };
      await slideApi.createSlide(slidePayload);
      showToast(`🖼️ Added "${movie.title}" to Homepage Slider! (Movie database row was not changed).`);
    } catch (err) {
      showToast(err.message || 'Failed to add movie to slider', 'error');
    }
  };

  // Open Form Modal for Create
  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingMovie(null);
    setIsFormModalOpen(true);
  };

  // Open Form Modal for Edit
  const handleOpenEdit = (movie) => {
    setFormMode('edit');
    setEditingMovie(movie);
    setIsFormModalOpen(true);
  };

  // Save Movie (Create or Update) with instant millisecond UI response
  const handleSaveMovie = async (movieData, targetTable) => {
    setIsFormModalOpen(false);

    if (formMode === 'create') {
      const prefix = String(targetTable).replace(/_/g, '-');
      const newId = `${prefix}-00001`;
      const optimisticMovie = {
        ...movieData,
        id: newId,
        _sourceTable: targetTable,
        created_at: new Date().toISOString()
      };

      // Instantly show in admin table: new movie gets ID 00001, existing movies in targetTable shift +1
      setAllMovies(prev => {
        const shifted = prev.map(m => {
          const mTable = m._sourceTable || (m.type && m.year ? `${String(m.type).toLowerCase()}_${m.year}` : '');
          if (mTable === targetTable) {
            const parts = String(m.id).split(/[-_]/);
            const num = parseInt(parts[parts.length - 1], 10) || 0;
            if (num > 0) {
              return { ...m, id: `${prefix}-${String(num + 1).padStart(5, '0')}` };
            }
          }
          return m;
        });
        return [optimisticMovie, ...shifted];
      });
      showToast(`🎬 Added "${movieData.title}" as #1! Existing movies shifted down...`);

      // Dispatch instant optimistic sync across tabs
      dispatchOptimisticUpdate('movie_add', { item: optimisticMovie, table: targetTable });

      // Background D1 creation
      movieApi.createMovie(targetTable, movieData).then(() => {
        showToast(`✅ "${movieData.title}" saved successfully to database!`);
        loadMovies(true);
      }).catch(err => {
        console.error('Failed to create movie in D1:', err);
        showToast(err.message || 'Failed to save movie', 'error');
        loadMovies(true);
      });
    } else {
      const table = editingMovie._sourceTable || getMovieTable(editingMovie.type, editingMovie.year);
      const updatedMovie = { ...editingMovie, ...movieData };

      // Instantly update in admin table in milliseconds
      setAllMovies(prev => prev.map(m => String(m.id) === String(movieData.id) ? updatedMovie : m));
      showToast(`✏️ Updated "${movieData.title}"! Updating database in background...`);

      // Dispatch instant optimistic sync across tabs
      dispatchOptimisticUpdate('movie_edit', { item: updatedMovie, table });

      // Background D1 update
      movieApi.updateMovie(table, movieData.id, movieData).then(() => {
        showToast(`✅ "${movieData.title}" updated successfully in database!`);
        loadMovies(true);
      }).catch(err => {
        console.error('Failed to update movie in D1:', err);
        showToast(err.message || 'Failed to update movie', 'error');
        loadMovies(true);
      });
    }
  };

  // Confirm Single Delete with instant millisecond UI response
  const handleConfirmDelete = async () => {
    if (!deletingMovie) return;
    const toDeleteId = deletingMovie.id;
    const toDeleteTable = deletingMovie._sourceTable || getMovieTable(deletingMovie.type, deletingMovie.year);
    const toDeleteTitle = deletingMovie.title;

    // Instantly remove from admin table in milliseconds
    setAllMovies(prev => prev.filter(m => String(m.id) !== String(toDeleteId)));
    setSelectedIds(prev => prev.filter(id => String(id) !== String(toDeleteId)));
    setIsDeleteModalOpen(false);
    setDeletingMovie(null);
    showToast(`🗑️ Removed "${toDeleteTitle}"! Deleting in background...`);

    // Dispatch instant optimistic sync across tabs
    dispatchOptimisticUpdate('movie_delete', { id: toDeleteId, table: toDeleteTable });

    // Background D1 delete
    movieApi.deleteMovie(toDeleteTable, toDeleteId).then(() => {
      loadMovies(true);
    }).catch(err => {
      console.error('Failed to delete movie:', err);
      showToast(err.message || 'Failed to delete movie', 'error');
      loadMovies(true);
    });
  };

  // Confirm Bulk Delete with instant millisecond UI response
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const delSet = new Set(selectedIds.map(String));
    const count = selectedIds.length;
    const itemsToDelete = allMovies
      .filter(m => delSet.has(String(m.id)))
      .map(m => ({
        id: m.id,
        table: m._sourceTable || getMovieTable(m.type, m.year)
      }));

    // Instantly remove from admin table in milliseconds
    setAllMovies(prev => prev.filter(m => !delSet.has(String(m.id))));
    setSelectedIds([]);
    setIsBulkDeleteModalOpen(false);
    showToast(`🗑️ Removed ${count} movies! Deleting in background...`);

    // Dispatch instant optimistic sync across tabs
    dispatchOptimisticUpdate('movie_bulk_delete', { ids: Array.from(delSet) });

    // Background D1 bulk delete
    movieApi.bulkDeleteMovies(itemsToDelete).then((res) => {
      showToast(`🗑️ Permanently removed ${res.successCount} movies from database.`);
      loadMovies(true);
    }).catch(err => {
      console.error('Failed to bulk delete movies:', err);
      showToast(err.message || 'Bulk delete failed', 'error');
      loadMovies(true);
    });
  };

  const getPosterUrl = (movie) => {
    if (!movie) return '';
    const img = movie.image || '';
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    return `/src/images/${movie.type}/${movie.year}/${img}`;
  };

  return (
    <AdminLayout
      currentRoute={`movies${selectedType ? '-' + selectedType : ''}${selectedYear ? '-' + selectedYear : ''}`}
      navigateTo={navigateTo}
      pageTitle="Movie Catalog CMS"
      breadcrumb={`Movies ${selectedType ? ' / ' + dbToDisplayType(selectedType) : ''}${selectedYear ? ' ' + selectedYear : ''}`}
      onRefresh={() => loadMovies(true)}
    >
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#fff', margin: 0 }}>
            {selectedType ? `${dbToDisplayType(selectedType)} ${selectedYear || 'All Years'} Catalog` : 'All Movies Management'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '4px 0 0 0' }}>
            Showing {filteredMovies.length} total records from D1 database
            {selectedIds.length > 0 && (
              <span style={{ marginLeft: '8px', color: 'var(--admin-gold)', fontWeight: 700 }}>
                • {selectedIds.length} movie{selectedIds.length !== 1 ? 's' : ''} selected in sequence (1 to {selectedIds.length})
              </span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedIds.length >= 2 && (
            <button
              className="admin-btn primary"
              onClick={() => setIsArrangeModalOpen(true)}
              style={{
                background: selectedIds.length === 2
                  ? 'linear-gradient(135deg, var(--admin-blue), var(--admin-purple))'
                  : 'linear-gradient(135deg, var(--admin-gold), #ea580c)',
                color: selectedIds.length === 2 ? '#fff' : '#000',
                fontWeight: 800,
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
              }}
              title="Arrange movie sequence and swap IDs in database"
            >
              <i className={`fa-solid ${selectedIds.length === 2 ? 'fa-right-left' : 'fa-arrow-down-up-across-line'}`}></i>
              {selectedIds.length === 2 ? ' Swap Both Movies (1 ↔ 2)' : ` Arrange Movies (${selectedIds.length})`}
            </button>
          )}

          {selectedIds.length > 0 && (
            <>
              <button className="admin-btn danger" onClick={() => setIsBulkDeleteModalOpen(true)}>
                <i className="fa-solid fa-trash-can"></i> Delete Selected ({selectedIds.length})
              </button>
              <button className="admin-btn" onClick={() => setSelectedIds([])} title="Clear all selections">
                <i className="fa-solid fa-xmark"></i> Clear ({selectedIds.length})
              </button>
            </>
          )}

          <button className="admin-btn primary" onClick={handleOpenCreate}>
            <i className="fa-solid fa-circle-plus"></i> Add Movie
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="admin-filter-bar">
        <div style={{ flex: 1, minWidth: '200px' }}>
          <input
            type="text"
            className="admin-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
            placeholder="Search title, ID, director, cast..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <select
          className="admin-select"
          value={selectedContentType}
          onChange={(e) => { setSelectedContentType(e.target.value); setCurrentPage(1); }}
          style={{ borderColor: selectedContentType ? 'var(--admin-accent)' : undefined, fontWeight: selectedContentType ? 700 : 400 }}
        >
          <option value="">All Formats</option>
          <option value="movie">Movies Only</option>
          <option value="series">Series Only</option>
        </select>

        <select
          className="admin-select"
          value={selectedType}
          onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
        >
          <option value="">All Types</option>
          <option value="tamil">Tamil</option>
          <option value="hollywood">Hollywood</option>
        </select>

        <select
          className="admin-select"
          value={selectedYear}
          onChange={(e) => { setSelectedYear(e.target.value); setCurrentPage(1); }}
        >
          <option value="">All Years</option>
          <option value="2026">2026</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
        </select>

        <select
          className="admin-select"
          value={selectedStatus}
          onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="coming soon">Coming Soon</option>
        </select>

        <select
          className="admin-select"
          value={selectedLanguage}
          onChange={(e) => { setSelectedLanguage(e.target.value); setCurrentPage(1); }}
        >
          <option value="">All Languages</option>
          <option value="Tamil">Tamil</option>
          <option value="English">English</option>
          <option value="Malayalam">Malayalam</option>
          <option value="Telugu">Telugu</option>
        </select>

        <button
          type="button"
          className={`admin-btn ${isOrderMode ? 'primary' : ''}`}
          onClick={() => setIsOrderMode(prev => !prev)}
          style={isOrderMode ? { background: 'linear-gradient(135deg, var(--admin-gold), #ea580c)', color: '#000', fontWeight: 800 } : {}}
          title="When ON, clicking anywhere on a movie row ticks it in sequence (1, 2, 3...)"
        >
          <i className="fa-solid fa-list-ol"></i> Sequence Select: {isOrderMode ? 'ON' : 'OFF'}
        </button>

        <button className="admin-btn" onClick={handleResetFilters} title="Reset all filters">
          <i className="fa-solid fa-rotate-left"></i> Reset
        </button>
      </div>

      {/* Sequence Selection Helper Banner */}
      {isOrderMode && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '10px',
            padding: '10px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            animation: 'adminFadeIn 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fef3c7', fontSize: '13px' }}>
            <i className="fa-solid fa-hand-pointer" style={{ color: 'var(--admin-gold)', fontSize: '16px' }}></i>
            <span>
              <strong>Sequence Mode Active:</strong> Click any movie rows 1 by 1 to tick them with counts (1, 2, 3...). Then click <strong>{selectedIds.length === 2 ? 'Swap Both Movies' : 'Arrange Movies'}</strong> to update their IDs in D1 and reorder them across the main website!
            </span>
          </div>
          <button
            className="admin-btn"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => setIsOrderMode(false)}
          >
            Exit Sequence Mode
          </button>
        </div>
      )}

      {/* Movie Data Table */}
      {loading ? (
        <div className="admin-glass-card" style={{ padding: '50px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px', marginBottom: '14px' }}></i>
          <p style={{ margin: 0, fontWeight: 700 }}>Fetching movies from Cloudflare Workers API...</p>
        </div>
      ) : paginatedMovies.length > 0 ? (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '65px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === paginatedMovies.length}
                    onChange={handleSelectAll}
                    style={{ accentColor: 'var(--admin-accent)', cursor: 'pointer' }}
                  />
                </th>
                <th>Poster</th>
                <th>Movie ID</th>
                <th>Title</th>
                <th>Release</th>
                <th>Language</th>
                <th>Year</th>
                <th>Category</th>
                <th>Type</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMovies.map((movie) => {
                const isComingSoon = String(movie.status || '').toLowerCase() === 'coming soon';
                const isSelected = selectedIds.includes(movie.id);
                const selectionIndex = selectedIds.indexOf(movie.id);
                const selectionRank = selectionIndex !== -1 ? selectionIndex + 1 : null;

                return (
                  <tr
                    key={movie.id}
                    className={`${isOrderMode ? 'order-mode-row' : ''} ${isSelected ? 'is-selected-row' : ''}`}
                    onClick={() => isOrderMode && handleSelectOne(movie.id)}
                    style={isSelected ? { background: 'rgba(59, 130, 246, 0.12)' } : {}}
                  >
                    <td style={{ width: '65px' }} onClick={(e) => isOrderMode && e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectOne(movie.id);
                          }}
                          style={{ accentColor: 'var(--admin-accent)', cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        {isSelected && (
                          <span
                            className="admin-order-count-badge"
                            title={`Selected order count: #${selectionRank}`}
                          >
                            {selectionRank}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <img
                        src={getPosterUrl(movie)}
                        alt={movie.title}
                        className="admin-poster-thumb"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--admin-accent)' }}>
                      {movie.id}
                    </td>
                    <td style={{ fontWeight: 700, color: '#fff', maxWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{movie.title}</span>
                        {(() => {
                          const isSeries = (movie.contentType === 'series') || (Array.isArray(movie.episodes) && movie.episodes.length > 0);
                          const epCount = Array.isArray(movie.episodes) ? movie.episodes.length : 0;
                          return isSeries ? (
                            <span style={{
                              background: 'rgba(229, 9, 20, 0.15)',
                              color: 'var(--accent)',
                              border: '1px solid rgba(229, 9, 20, 0.3)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <i className="fa-solid fa-tv"></i> SERIES {epCount > 0 ? `(${epCount})` : ''}
                            </span>
                          ) : (
                            <span style={{
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#60a5fa',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <i className="fa-solid fa-film"></i> MOVIE
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td style={{ color: 'var(--admin-text-muted)' }}>{movie.release || '-'}</td>
                    <td>{movie.language || 'Tamil'}</td>
                    <td>{movie.year || '-'}</td>
                    <td style={{ color: 'var(--admin-text-muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {movie.category || '-'}
                    </td>
                    <td>{dbToDisplayType(movie.type)}</td>
                    <td>
                      <span className={`admin-badge ${isComingSoon ? 'comingsoon' : 'active'}`}>
                        {isComingSoon ? 'Coming Soon' : 'Active'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          className="admin-btn"
                          style={{ padding: '5px 9px', fontSize: '12px', color: 'var(--admin-gold)' }}
                          title="Feature on Homepage Slider"
                          onClick={() => handlePromptAddToSlider(movie)}
                        >
                          <i className="fa-solid fa-images"></i>
                        </button>
                        <button
                          className="admin-btn"
                          style={{ padding: '5px 9px', fontSize: '12px' }}
                          title="View Movie Details"
                          onClick={() => { setViewingMovie(movie); setIsDetailsModalOpen(true); }}
                        >
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        <button
                          className="admin-btn"
                          style={{ padding: '5px 9px', fontSize: '12px' }}
                          title="Edit Movie"
                          onClick={() => handleOpenEdit(movie)}
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          className="admin-btn danger"
                          style={{ padding: '5px 9px', fontSize: '12px' }}
                          title="Delete Movie"
                          onClick={() => { setDeletingMovie(movie); setIsDeleteModalOpen(true); }}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="admin-pagination">
            <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>
              Showing {Math.min((currentPage - 1) * pageSize + 1, totalRecords)}–{Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} movies
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--admin-text-muted)' }}>
                <span>Per Page:</span>
                <select
                  className="admin-select"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  className="admin-btn"
                  style={{ padding: '5px 10px' }}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <span style={{ padding: '5px 12px', fontSize: '13px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center' }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  className="admin-btn"
                  style={{ padding: '5px 10px' }}
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="admin-glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <i className="fa-solid fa-film" style={{ fontSize: '32px', color: 'var(--admin-accent)', marginBottom: '12px' }}></i>
          <h3>No Movies Found</h3>
          <p style={{ margin: '4px 0 16px 0', fontSize: '13.5px' }}>No movies match your current search or filter criteria.</p>
          <button className="admin-btn primary" onClick={handleResetFilters}>
            <i className="fa-solid fa-rotate-left"></i> Reset Filters
          </button>
        </div>
      )}

      {/* Add / Edit Movie Modal */}
      <MovieFormModal
        isOpen={isFormModalOpen}
        mode={formMode}
        initialData={editingMovie}
        targetType={selectedType || 'tamil'}
        targetYear={selectedYear || '2026'}
        onSave={handleSaveMovie}
        onCancel={() => setIsFormModalOpen(false)}
        loading={actionLoading}
      />

      {/* View Movie Details Drawer/Modal */}
      <MovieDetailsModal
        isOpen={isDetailsModalOpen}
        movie={viewingMovie}
        onEdit={(m) => handleOpenEdit(m)}
        onClose={() => setIsDetailsModalOpen(false)}
      />

      {/* Single Delete Confirmation */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Delete Movie?"
        message={`Are you sure you want to permanently delete "${deletingMovie?.title}" (${deletingMovie?.id}) from D1 Database?`}
        confirmText="Delete Permanently"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        title={`Delete ${selectedIds.length} Selected Movies?`}
        message={`This action will permanently remove all ${selectedIds.length} selected movie records from their respective database tables. This action cannot be undone.`}
        confirmText={`Delete ${selectedIds.length} Movies`}
        loading={actionLoading}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
      />

      {/* Arrange / Swap Movies Modal */}
      <ArrangeMoviesModal
        isOpen={isArrangeModalOpen}
        selectedMovies={selectedMoviesList}
        allMoviesInTable={allMovies.filter(m => {
          const activeTable = selectedType && selectedYear ? getMovieTable(selectedType, selectedYear) : (selectedMoviesList[0]?._sourceTable || '');
          const mTable = m._sourceTable || (m.type && m.year ? `${String(m.type).toLowerCase()}_${m.year}` : '');
          return mTable === activeTable;
        })}
        targetTable={selectedType && selectedYear ? getMovieTable(selectedType, selectedYear) : (selectedMoviesList[0]?._sourceTable || '')}
        onClose={() => setIsArrangeModalOpen(false)}
        onOptimisticUpdate={handleOptimisticMoviesUpdate}
        onSuccess={() => {
          setSelectedIds([]);
          loadMovies(true);
        }}
      />

      {/* Add Movie to Slider Confirmation Modal */}
      <ConfirmationModal
        isOpen={isSliderConfirmOpen}
        title={`Feature "${sliderCandidate?.title}" on Homepage Slider?`}
        message={`This will add "${sliderCandidate?.title}" as a promotional hero banner on the homepage carousel. A new slider ID will be created in the slider database. The original movie detail page and its D1 database row will NOT be modified.`}
        confirmText="Add to Slider"
        onConfirm={handleConfirmAddToSlider}
        onCancel={() => { setIsSliderConfirmOpen(false); setSliderCandidate(null); }}
      />

      {/* Floating Bottom Selection Bar (1 by 1 count sequence) */}
      {selectedIds.length > 0 && (
        <div className="admin-floating-selection-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--admin-gold)', display: 'inline-block', boxShadow: '0 0 10px var(--admin-gold)' }}></span>
              <strong style={{ color: '#fff', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                {selectedIds.length} {selectedIds.length === 1 ? 'Movie' : 'Movies'} Selected (Count 1 to {selectedIds.length})
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
              {selectedMoviesList.slice(0, 6).map((m, idx) => (
                <div key={m.id} style={{ position: 'relative', flexShrink: 0 }} title={`#${idx + 1}: ${m.title}`}>
                  <img
                    src={getPosterUrl(m)}
                    alt=""
                    style={{ width: '26px', height: '36px', borderRadius: '4px', objectFit: 'cover', background: '#111' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      background: 'linear-gradient(135deg, var(--admin-gold), #ea580c)',
                      color: '#000',
                      fontSize: '9px',
                      fontWeight: 900,
                      borderRadius: '50%',
                      width: '15px',
                      height: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}
                  >
                    {idx + 1}
                  </span>
                </div>
              ))}
              {selectedMoviesList.length > 6 && (
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'center' }}>
                  +{selectedMoviesList.length - 6} more
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {selectedIds.length >= 2 && (
              <button
                className="admin-btn primary"
                style={{
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  background: selectedIds.length === 2
                    ? 'linear-gradient(135deg, var(--admin-blue), var(--admin-purple))'
                    : 'linear-gradient(135deg, var(--admin-gold), #ea580c)',
                  color: selectedIds.length === 2 ? '#fff' : '#000',
                  fontWeight: 800
                }}
                onClick={() => setIsArrangeModalOpen(true)}
              >
                <i className={`fa-solid ${selectedIds.length === 2 ? 'fa-right-left' : 'fa-arrow-down-up-across-line'}`}></i>
                {selectedIds.length === 2 ? ' Swap Both Movies' : ` Arrange (${selectedIds.length})`}
              </button>
            )}
            <button
              className="admin-btn"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={() => setSelectedIds([])}
            >
              <i className="fa-solid fa-xmark"></i> Clear
            </button>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
