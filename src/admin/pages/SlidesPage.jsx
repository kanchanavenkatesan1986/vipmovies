import React, { useState, useEffect, useMemo, useRef } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { slideApi } from '../services/slideApi';
import SlideFormModal from '../components/slides/SlideFormModal';
import ArrangeSlidesModal from '../components/slides/ArrangeSlidesModal';
import MoviePickerModal from '../components/slides/MoviePickerModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { showToast } from '../components/common/ToastContainer';
import { dispatchOptimisticUpdate } from '../services/syncManager';

export default function SlidesPage({ navigateTo }) {
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState([]);

  // Sequence selection state (Order 1, 2, 3...)
  const [selectedIds, setSelectedIds] = useState([]);
  const [isOrderMode, setIsOrderMode] = useState(true);

  // Modals state
  const [isArrangeModalOpen, setIsArrangeModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isMoviePickerOpen, setIsMoviePickerOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingSlide, setEditingSlide] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingSlide, setDeletingSlide] = useState(null);

  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadSlides = async (force = true) => {
    // Don't show full-page spinner on background refreshes
    if (!force) setLoading(true);
    try {
      const records = await slideApi.getSlides(force);
      // Sort slides by ID ascending (matching homepage display order)
      const sorted = [...(records || [])].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
      setSlides(sorted);
      if (!force) setSelectedIds([]);
    } catch (err) {
      showToast(err.message || 'Failed to load slider items', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlides(true);
  }, []);

  // Listen for cross-tab catalog updates and auto-refetch slide data
  const refetchTimerRef = useRef(null);
  useEffect(() => {
    const onCatalogUpdated = (e) => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => {
        loadSlides(true);
      }, 600);
    };

    window.addEventListener('vip_catalog_updated', onCatalogUpdated);

    let bc = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('vip_catalog_sync');
        bc.onmessage = (msg) => {
          const data = msg?.data || {};
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
  }, []);

  // Selected slides in their exact clicked order (1, 2, 3...)
  const selectedSlidesList = useMemo(() => {
    return selectedIds
      .map(id => slides.find(s => Number(s.id) === Number(id)))
      .filter(Boolean);
  }, [selectedIds, slides]);

  // Optimistic instant millisecond UI update when slides are rearranged or swapped
  const handleOptimisticSlidesUpdate = (optimisticSlides) => {
    if (!optimisticSlides || optimisticSlides.length === 0) return;
    const optimisticIdSet = new Set(optimisticSlides.map(s => Number(s.id)));
    setSlides(prev => {
      const unchanged = prev.filter(s => !optimisticIdSet.has(Number(s.id)));
      const merged = [...unchanged, ...optimisticSlides];
      return merged.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    });
    setSelectedIds([]);
  };

  // Checkbox handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(slides.map(s => Number(s.id)));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    const numId = Number(id);
    setSelectedIds(prev =>
      prev.includes(numId) ? prev.filter(i => i !== numId) : [...prev, numId]
    );
  };

  const handleSelectMovieForSlider = (movie) => {
    setFormMode('create');
    setEditingSlide({
      title: movie.title || '',
      image: movie.image || '',
      targetUrl: movie.targetUrl || `https://vip-movies.pages.dev/watch?reward=${movie.id}`,
      url: movie.targetUrl || `https://vip-movies.pages.dev/watch?reward=${movie.id}`,
      id: null,
      status: 'active'
    });
    setIsMoviePickerOpen(false);
    setIsFormModalOpen(true);
  };

  const handleOpenCreate = () => {
    setFormMode('create');
    setEditingSlide(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (slide) => {
    setFormMode('edit');
    setEditingSlide(slide);
    setIsFormModalOpen(true);
  };

  const handleSaveSlide = async (slideData) => {
    setIsFormModalOpen(false);

    if (formMode === 'create') {
      const nextId = slides.length > 0 ? Math.max(...slides.map(s => Number(s.id) || 0)) + 1 : 1;
      const optimisticSlide = {
        ...slideData,
        id: slideData.id ? Number(slideData.id) : nextId,
        created_at: new Date().toISOString()
      };

      // Instantly update admin table in milliseconds
      setSlides(prev => [...prev.filter(s => Number(s.id) !== optimisticSlide.id), optimisticSlide].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0)));
      showToast('🖼️ Slide added! Saving in background...');

      // Dispatch instant optimistic sync across tabs
      dispatchOptimisticUpdate('slide_add', { item: optimisticSlide });

      // Background D1 creation
      slideApi.createSlide(slideData).then(() => {
        showToast('✅ Slide successfully saved in database!');
        loadSlides(true);
      }).catch(err => {
        console.error('Failed to create slide:', err);
        showToast(err.message || 'Failed to save slide', 'error');
        loadSlides(true);
      });
    } else {
      const updatedSlide = { ...editingSlide, ...slideData, id: Number(editingSlide.id) };

      // Instantly update admin table in milliseconds
      setSlides(prev => prev.map(s => Number(s.id) === updatedSlide.id ? updatedSlide : s));
      setEditingSlide(null);
      showToast('✏️ Slide updated! Saving in background...');

      // Dispatch instant optimistic sync across tabs
      dispatchOptimisticUpdate('slide_edit', { item: updatedSlide });

      // Background D1 update
      slideApi.updateSlide(editingSlide.id, slideData).then(() => {
        showToast('✅ Slide updated successfully in database!');
        loadSlides(true);
      }).catch(err => {
        console.error('Failed to update slide:', err);
        showToast(err.message || 'Failed to update slide', 'error');
        loadSlides(true);
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSlide) return;
    const delId = Number(deletingSlide.id);
    const delTitle = deletingSlide.title;

    // Instantly remove from admin table in milliseconds
    setSlides(prev => prev.filter(s => Number(s.id) !== delId));
    setSelectedIds(prev => prev.filter(id => Number(id) !== delId));
    setIsDeleteModalOpen(false);
    setDeletingSlide(null);
    showToast(`🗑️ Removed "${delTitle}"! Deleting in background...`);

    // Dispatch instant optimistic sync across tabs
    dispatchOptimisticUpdate('slide_delete', { id: delId });

    // Background D1 delete
    slideApi.deleteSlide(delId).then(() => {
      loadSlides(true);
    }).catch(err => {
      console.error('Failed to delete slide:', err);
      showToast(err.message || 'Failed to delete slide', 'error');
      loadSlides(true);
    });
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const delSet = new Set(selectedIds.map(Number));
    const idsToDelete = [...selectedIds];

    // Instantly remove from admin table in milliseconds
    setSlides(prev => prev.filter(s => !delSet.has(Number(s.id))));
    setSelectedIds([]);
    setIsBulkDeleteModalOpen(false);
    showToast(`🗑️ Removed ${idsToDelete.length} slides! Deleting in background...`);

    // Dispatch instant optimistic sync across tabs
    dispatchOptimisticUpdate('slide_bulk_delete', { ids: idsToDelete });

    // Background D1 bulk delete
    slideApi.bulkDeleteSlides(idsToDelete).then((res) => {
      showToast(`🗑️ Permanently removed ${res.successCount} slides from database.`);
      loadSlides(true);
    }).catch(err => {
      console.error('Failed to bulk delete slides:', err);
      showToast(err.message || 'Bulk delete failed', 'error');
      loadSlides(true);
    });
  };

  return (
    <AdminLayout
      currentRoute="slides"
      navigateTo={navigateTo}
      pageTitle="Banner Slide Management"
      breadcrumb="Slide Management"
      onRefresh={() => loadSlides(true)}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#fff', margin: 0 }}>
            Homepage Slide Banners
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '4px 0 0 0' }}>
            Manage promotional hero banners and target watch URLs (`/api/slider`)
            {selectedIds.length > 0 && (
              <span style={{ marginLeft: '8px', color: 'var(--admin-gold)', fontWeight: 700 }}>
                • {selectedIds.length} banner{selectedIds.length !== 1 ? 's' : ''} selected in sequence (1 to {selectedIds.length})
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
              title="Arrange slide sequence and swap IDs in database"
            >
              <i className={`fa-solid ${selectedIds.length === 2 ? 'fa-right-left' : 'fa-arrow-down-up-across-line'}`}></i>
              {selectedIds.length === 2 ? ' Swap Both Slides (1 ↔ 2)' : ` Arrange Slides (${selectedIds.length})`}
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

          <button
            type="button"
            className="admin-btn primary"
            onClick={() => setIsMoviePickerOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              fontWeight: 800,
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)'
            }}
            title="Pick a movie from catalogue to feature on homepage slider"
          >
            <i className="fa-solid fa-clapperboard"></i> Add Movie to Slider
          </button>

          <button className="admin-btn primary" onClick={handleOpenCreate}>
            <i className="fa-solid fa-circle-plus"></i> Add New Slide
          </button>
        </div>
      </div>

      {/* Sequence Selection Helper Banner */}
      <div
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
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
            <strong>1-by-1 Sequence Select:</strong> Click any banner rows 1 by 1 to tick them with sequence counts (1, 2, 3...). Then click <strong>{selectedIds.length === 2 ? 'Swap Both Slides' : 'Arrange Slides'}</strong> to rearrange both ID and D1 database rows. Adding a new movie detail page only assigns a new slider ID and does not modify the movie's own D1 database row.
          </span>
        </div>
        {selectedIds.length > 0 && (
          <button
            className="admin-btn"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => setSelectedIds([])}
          >
            Clear Selection ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Slide Table */}
      {loading ? (
        <div className="admin-glass-card" style={{ padding: '50px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '28px', marginBottom: '14px' }}></i>
          <p style={{ margin: 0, fontWeight: 700 }}>Fetching slides from /api/slider...</p>
        </div>
      ) : slides.length > 0 ? (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '65px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === slides.length}
                    onChange={handleSelectAll}
                    style={{ accentColor: 'var(--admin-accent)', cursor: 'pointer' }}
                  />
                </th>
                <th>Banner Preview</th>
                <th>Slide ID (Order)</th>
                <th>Title</th>
                <th>Target URL</th>
                <th>Status</th>
                <th>Created Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {slides.map((slide) => {
                const isComingSoon = String(slide.status || '').toLowerCase() === 'comingsoon';
                const isSelected = selectedIds.includes(Number(slide.id));
                const selectionIndex = selectedIds.indexOf(Number(slide.id));
                const selectionRank = selectionIndex !== -1 ? selectionIndex + 1 : null;

                return (
                  <tr
                    key={slide.id}
                    className={`selectable-row ${isSelected ? 'is-selected-row' : ''}`}
                    onClick={() => handleSelectOne(slide.id)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(59, 130, 246, 0.12)' : undefined,
                      transition: 'background 0.15s ease'
                    }}
                    title="Click row to select/unselect in 1-by-1 sequence (1, 2, 3...)"
                  >
                    <td style={{ width: '65px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(slide.id)}
                          style={{ accentColor: 'var(--admin-accent)', cursor: 'pointer', width: '18px', height: '18px' }}
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
                        src={slide.image}
                        alt={slide.title}
                        style={{ width: '120px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--admin-border)', background: '#000' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--admin-accent)' }}>
                          #{slide.id}
                        </span>
                        {isSelected && (
                          <span
                            style={{
                              background: 'linear-gradient(135deg, var(--admin-gold), #ea580c)',
                              color: '#000',
                              fontSize: '10px',
                              fontWeight: 900,
                              padding: '1px 6px',
                              borderRadius: '10px'
                            }}
                          >
                            Order: #{selectionRank}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: '#fff', maxWidth: '200px' }}>
                      {slide.title}
                    </td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {slide.url ? (
                        <a
                          href={slide.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: 'var(--admin-purple)', fontSize: '12px' }}
                        >
                          {slide.url}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--admin-text-dim)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-badge ${isComingSoon ? 'comingsoon' : 'active'}`}>
                        {isComingSoon ? 'Coming Soon' : 'Active'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--admin-text-dim)' }}>{slide.created_at || '-'}</td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          className="admin-btn"
                          style={{ padding: '5px 9px', fontSize: '12px' }}
                          title="Edit Slide"
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(slide); }}
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          className="admin-btn danger"
                          style={{ padding: '5px 9px', fontSize: '12px' }}
                          title="Delete Slide"
                          onClick={(e) => { e.stopPropagation(); setDeletingSlide(slide); setIsDeleteModalOpen(true); }}
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
        </div>
      ) : (
        <div className="admin-glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
          <i className="fa-solid fa-images" style={{ fontSize: '32px', color: 'var(--admin-accent)', marginBottom: '12px' }}></i>
          <h3>No Slides Found</h3>
          <p style={{ margin: '4px 0 16px 0', fontSize: '13.5px' }}>No slider banners exist in the database.</p>
          <button className="admin-btn primary" onClick={handleOpenCreate}>
            <i className="fa-solid fa-circle-plus"></i> Add First Slide
          </button>
        </div>
      )}

      {/* Add / Edit Slide Modal */}
      <SlideFormModal
        isOpen={isFormModalOpen}
        mode={formMode}
        initialData={editingSlide}
        onSave={handleSaveSlide}
        onCancel={() => setIsFormModalOpen(false)}
        loading={actionLoading}
      />

      {/* Movie Picker Modal for adding movie detail page to slider */}
      <MoviePickerModal
        isOpen={isMoviePickerOpen}
        onClose={() => setIsMoviePickerOpen(false)}
        onSelectMovie={handleSelectMovieForSlider}
      />

      {/* Arrange / Swap Slides Modal */}
      <ArrangeSlidesModal
        isOpen={isArrangeModalOpen}
        selectedSlides={selectedSlidesList}
        onClose={() => setIsArrangeModalOpen(false)}
        onOptimisticUpdate={handleOptimisticSlidesUpdate}
        onSuccess={() => {
          setSelectedIds([]);
          loadSlides(true);
        }}
      />

      {/* Single Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Delete Slide?"
        message={`Are you sure you want to permanently delete slide banner "${deletingSlide?.title}" (#${deletingSlide?.id})?`}
        confirmText="Delete Permanently"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        title={`Delete ${selectedIds.length} Selected Slides?`}
        message={`This action will permanently remove all ${selectedIds.length} selected slide banners from the database. This action cannot be undone.`}
        confirmText={`Delete ${selectedIds.length} Slides`}
        loading={actionLoading}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
      />

      {/* Floating Bottom Selection Bar (1 by 1 count sequence) */}
      {selectedIds.length > 0 && (
        <div className="admin-floating-selection-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--admin-gold)', display: 'inline-block', boxShadow: '0 0 10px var(--admin-gold)' }}></span>
              <strong style={{ color: '#fff', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                {selectedIds.length} {selectedIds.length === 1 ? 'Slide' : 'Slides'} Selected (Count 1 to {selectedIds.length})
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
              {selectedSlidesList.slice(0, 5).map((s, idx) => (
                <div key={s.id} style={{ position: 'relative', flexShrink: 0 }} title={`#${idx + 1}: ${s.title}`}>
                  <img
                    src={s.image}
                    alt=""
                    style={{ width: '48px', height: '24px', borderRadius: '4px', objectFit: 'cover', background: '#000', border: '1px solid var(--admin-border)' }}
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
              {selectedSlidesList.length > 5 && (
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'center' }}>
                  +{selectedSlidesList.length - 5} more
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
                {selectedIds.length === 2 ? ' Swap Both Slides' : ` Arrange (${selectedIds.length})`}
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
