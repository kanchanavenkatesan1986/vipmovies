import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { movieApi } from '../services/movieApi';
import { VALID_TABLES, getMovieTable, dbToDisplayType, displayToDbType } from '../utils/tableMapper';
import MovieFormModal from '../components/movies/MovieFormModal';
import MovieDetailsModal from '../components/movies/MovieDetailsModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { showToast } from '../components/common/ToastContainer';

export default function MoviesPage({ navigateTo, initialType = '', initialYear = '' }) {
  const [loading, setLoading] = useState(true);
  const [allMovies, setAllMovies] = useState([]);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState(initialType || '');
  const [selectedYear, setSelectedYear] = useState(initialYear || '');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingMovie, setEditingMovie] = useState(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [viewingMovie, setViewingMovie] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingMovie, setDeletingMovie] = useState(null);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch movies from tables based on current selection or all tables
  const loadMovies = async (force = false) => {
    setLoading(true);
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
      setSelectedIds([]);
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
      const dateA = a.created_at || '';
      const dateB = b.created_at || '';
      return dateB.localeCompare(dateA);
    });
  }, [allMovies, searchText, selectedStatus, selectedCategory, selectedLanguage]);

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
    setSelectedType('');
    setSelectedYear('');
    setSelectedStatus('');
    setSelectedCategory('');
    setSelectedLanguage('');
    setCurrentPage(1);
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

  // Save Movie (Create or Update)
  const handleSaveMovie = async (movieData, targetTable) => {
    setActionLoading(true);
    try {
      if (formMode === 'create') {
        await movieApi.createMovie(targetTable, movieData);
        showToast(`🎬 Created movie "${movieData.title}" in ${targetTable}!`);
      } else {
        const table = editingMovie._sourceTable || getMovieTable(editingMovie.type, editingMovie.year);
        await movieApi.updateMovie(table, movieData.id, movieData);
        showToast(`✏️ Updated movie "${movieData.title}"!`);
      }
      setIsFormModalOpen(false);
      loadMovies(false);
    } catch (err) {
      showToast(err.message || 'Failed to save movie', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Single Delete
  const handleConfirmDelete = async () => {
    if (!deletingMovie) return;
    setActionLoading(true);
    try {
      const table = deletingMovie._sourceTable || getMovieTable(deletingMovie.type, deletingMovie.year);
      await movieApi.deleteMovie(table, deletingMovie.id);
      showToast(`🗑️ Deleted movie "${deletingMovie.title}"`);
      setIsDeleteModalOpen(false);
      setDeletingMovie(null);
      loadMovies(false);
    } catch (err) {
      showToast(err.message || 'Failed to delete movie', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      const itemsToDelete = allMovies
        .filter(m => selectedIds.includes(m.id))
        .map(m => ({
          id: m.id,
          table: m._sourceTable || getMovieTable(m.type, m.year)
        }));

      const res = await movieApi.bulkDeleteMovies(itemsToDelete);
      showToast(`🗑️ Bulk delete completed: ${res.successCount} deleted, ${res.failCount} failed.`);
      setIsBulkDeleteModalOpen(false);
      setSelectedIds([]);
      loadMovies(false);
    } catch (err) {
      showToast(err.message || 'Bulk delete failed', 'error');
    } finally {
      setActionLoading(false);
    }
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
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedIds.length > 0 && (
            <button className="admin-btn danger" onClick={() => setIsBulkDeleteModalOpen(true)}>
              <i className="fa-solid fa-trash-can"></i> Delete Selected ({selectedIds.length})
            </button>
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

        <button className="admin-btn" onClick={handleResetFilters} title="Reset all filters">
          <i className="fa-solid fa-rotate-left"></i> Reset
        </button>
      </div>

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
                <th style={{ width: '40px' }}>
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

                return (
                  <tr key={movie.id} style={isSelected ? { background: 'rgba(229,9,20,0.08)' } : {}}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectOne(movie.id)}
                        style={{ accentColor: 'var(--admin-accent)', cursor: 'pointer' }}
                      />
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
                    <td style={{ fontWeight: 700, color: '#fff', maxWidth: '220px' }}>
                      {movie.title}
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

    </AdminLayout>
  );
}
