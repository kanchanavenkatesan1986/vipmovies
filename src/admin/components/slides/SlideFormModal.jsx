import React, { useState, useEffect } from 'react';
import { validateSlideData } from '../../utils/validation';
import MoviePickerModal from './MoviePickerModal';

export default function SlideFormModal({
  isOpen,
  mode = 'create', // 'create' | 'edit'
  initialData = null,
  onSave,
  onCancel,
  loading = false
}) {
  const isEdit = mode === 'edit';

  const [formData, setFormData] = useState({
    title: '',
    image: '',
    url: '',
    status: 'active'
  });

  const [linkedMovie, setLinkedMovie] = useState(null);
  const [isMoviePickerOpen, setIsMoviePickerOpen] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({
        title: initialData.title || '',
        image: initialData.image || '',
        url: initialData.url || '',
        status: (initialData.status || 'active').toLowerCase()
      });
      setLinkedMovie(null);
    } else if (!isEdit && initialData) {
      // Pre-filled from movie picker
      setFormData({
        title: initialData.title || '',
        image: initialData.image || '',
        url: initialData.targetUrl || initialData.url || (initialData.id ? `https://vip-movies.pages.dev/watch?reward=${initialData.id}` : ''),
        status: (initialData.status || 'active').toLowerCase()
      });
      setLinkedMovie(initialData);
    } else {
      setFormData({
        title: '',
        image: '',
        url: '',
        status: 'active'
      });
      setLinkedMovie(null);
    }
    setErrors({});
  }, [isOpen, mode, initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSelectMovieFromCatalog = (movie) => {
    setLinkedMovie(movie);
    const destinationUrl = movie.targetUrl || `https://vip-movies.pages.dev/watch?reward=${movie.id}`;
    setFormData(prev => ({
      ...prev,
      title: movie.title || prev.title,
      image: movie.image || prev.image,
      url: destinationUrl,
      status: 'active'
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateSlideData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const payload = {
      ...formData,
      title: formData.title.trim(),
      image: formData.image.trim(),
      url: (formData.url && formData.url.trim()) ? formData.url.trim() : '#'
    };

    onSave(payload);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="admin-modal-backdrop" onClick={onCancel}>
        <div className="admin-modal" style={{ maxWidth: '620px', width: '96%' }} onClick={(e) => e.stopPropagation()}>
          
          {/* Header */}
          <div className="admin-modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-circle-plus'}`} style={{ color: 'var(--admin-accent)', fontSize: '18px' }}></i>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#fff' }}>
                {isEdit ? `Edit Slide (#${initialData?.id})` : 'Add New Slide Banner'}
              </h3>
            </div>
            <button className="admin-btn" style={{ padding: '4px 8px' }} onClick={onCancel}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Body */}
          <form id="slideForm" onSubmit={handleSubmit} className="admin-modal-body">
            
            {/* Quick Pick from Movie Catalogue Button */}
            {!isEdit && (
              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--admin-gold)' }}></i>
                    Feature Movie from Catalogue
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                    Auto-fill title, image, and watch detail link from existing movies
                  </div>
                </div>

                <button
                  type="button"
                  className="admin-btn primary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    fontWeight: 700
                  }}
                  onClick={() => setIsMoviePickerOpen(true)}
                >
                  <i className="fa-solid fa-clapperboard"></i> Browse Movies
                </button>
              </div>
            )}

            {/* Linked Movie Notice */}
            {linkedMovie && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '14px',
                  fontSize: '12px',
                  color: '#a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <i className="fa-solid fa-circle-check" style={{ color: '#10b981', fontSize: '15px' }}></i>
                <div>
                  <strong>Linked to Movie:</strong> {linkedMovie.title} (#{linkedMovie.id})<br />
                  <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>
                    Only a new slide ID will be added to the slider table. The original movie database row in D1 is NOT changed.
                  </span>
                </div>
              </div>
            )}

            <div className="admin-form-group full">
              <label>Slide Title *</label>
              <input
                type="text"
                className="admin-input"
                placeholder="e.g. Spider-Man: Brand New Day"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
              {errors.title && <span className="error-text">{errors.title}</span>}
            </div>

            <div className="admin-form-group full">
              <label>Banner Image URL *</label>
              <input
                type="text"
                className="admin-input"
                placeholder="https://..."
                value={formData.image}
                onChange={(e) => handleChange('image', e.target.value)}
              />
              {errors.image && <span className="error-text">{errors.image}</span>}

              {formData.image && (
                <div style={{ marginTop: '8px', borderRadius: '10px', overflow: 'hidden', height: '120px', border: '1px solid var(--admin-border)', background: '#000' }}>
                  <img
                    src={formData.image}
                    alt="Slide Banner Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>

            <div className="admin-form-group full">
              <label>Target Click URL (Movie Detail Page Link)</label>
              <input
                type="text"
                className="admin-input"
                placeholder="e.g. https://vip-movies.pages.dev/watch?reward=tamil-2026-00278"
                value={formData.url}
                onChange={(e) => handleChange('url', e.target.value)}
              />
              <span style={{ fontSize: '11px', color: 'var(--admin-text-dim)', marginTop: '4px', display: 'block' }}>
                When users click this slide on the homepage, they will navigate to this movie detail page.
              </span>
            </div>

            <div className="admin-form-group full">
              <label>Status</label>
              <select
                className="admin-select"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <option value="active">Active (Visible on Homepage)</option>
                <option value="comingsoon">Coming Soon</option>
              </select>
            </div>
          </form>

          {/* Footer */}
          <div className="admin-modal-footer">
            <button className="admin-btn" type="button" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button className="admin-btn primary" type="submit" form="slideForm" disabled={loading}>
              {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : isEdit ? 'Save Changes' : 'Create Slide'}
            </button>
          </div>

        </div>
      </div>

      {/* Sub-Modal: Movie Picker */}
      <MoviePickerModal
        isOpen={isMoviePickerOpen}
        onClose={() => setIsMoviePickerOpen(false)}
        onSelectMovie={handleSelectMovieFromCatalog}
      />
    </>
  );
}
