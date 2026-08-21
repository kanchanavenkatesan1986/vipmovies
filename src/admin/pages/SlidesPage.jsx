import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { slideApi } from '../services/slideApi';
import SlideFormModal from '../components/slides/SlideFormModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { showToast } from '../components/common/ToastContainer';

export default function SlidesPage({ navigateTo }) {
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState([]);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingSlide, setEditingSlide] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingSlide, setDeletingSlide] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);

  const loadSlides = async (force = false) => {
    setLoading(true);
    try {
      const records = await slideApi.getSlides(force);
      setSlides(records);
    } catch (err) {
      showToast(err.message || 'Failed to load slider items', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlides(false);
  }, []);

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
    setActionLoading(true);
    try {
      if (formMode === 'create') {
        await slideApi.createSlide(slideData);
        showToast('🖼️ Created new banner slide!');
      } else {
        await slideApi.updateSlide(editingSlide.id, slideData);
        showToast('✏️ Updated banner slide!');
      }
      setIsFormModalOpen(false);
      loadSlides(false);
    } catch (err) {
      showToast(err.message || 'Failed to save slide', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSlide) return;
    setActionLoading(true);
    try {
      await slideApi.deleteSlide(deletingSlide.id);
      showToast('🗑️ Deleted banner slide');
      setIsDeleteModalOpen(false);
      setDeletingSlide(null);
      loadSlides(false);
    } catch (err) {
      showToast(err.message || 'Failed to delete slide', 'error');
    } finally {
      setActionLoading(false);
    }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#fff', margin: 0 }}>
            Homepage Slide Banners
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '4px 0 0 0' }}>
            Manage promotional hero banners and target watch URLs (`/api/slider`)
          </p>
        </div>

        <button className="admin-btn primary" onClick={handleOpenCreate}>
          <i className="fa-solid fa-circle-plus"></i> Add New Slide
        </button>
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
                <th>Banner Preview</th>
                <th>Slide ID</th>
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

                return (
                  <tr key={slide.id}>
                    <td>
                      <img
                        src={slide.image}
                        alt={slide.title}
                        style={{ width: '120px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--admin-border)', background: '#000' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--admin-accent)' }}>
                      #{slide.id}
                    </td>
                    <td style={{ fontWeight: 700, color: '#fff', maxWidth: '200px' }}>
                      {slide.title}
                    </td>
                    <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {slide.url ? (
                        <a href={slide.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--admin-purple)', fontSize: '12px' }}>
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
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          className="admin-btn"
                          style={{ padding: '5px 9px', fontSize: '12px' }}
                          title="Edit Slide"
                          onClick={() => handleOpenEdit(slide)}
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          className="admin-btn danger"
                          style={{ padding: '5px 9px', fontSize: '12px' }}
                          title="Delete Slide"
                          onClick={() => { setDeletingSlide(slide); setIsDeleteModalOpen(true); }}
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title="Delete Slide?"
        message={`Are you sure you want to permanently delete slide banner "${deletingSlide?.title}" (#${deletingSlide?.id})?`}
        confirmText="Delete Permanently"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </AdminLayout>
  );
}
