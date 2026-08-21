import React, { useState, useEffect } from 'react';
import { validateSlideData } from '../../utils/validation';

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

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({
        title: initialData.title || '',
        image: initialData.image || '',
        url: initialData.url || '',
        status: (initialData.status || 'active').toLowerCase()
      });
    } else {
      setFormData({
        title: '',
        image: '',
        url: '',
        status: 'active'
      });
    }
    setErrors({});
  }, [isOpen, mode, initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateSlideData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const payload = isEdit && initialData ? { ...initialData, ...formData } : formData;
    onSave(payload);
  };

  if (!isOpen) return null;

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        
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
            <label>Target Click URL (Destination Link)</label>
            <input
              type="text"
              className="admin-input"
              placeholder="e.g. https://vip-movies.pages.dev/watch?reward=hollywood-2026-00001"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
            />
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
  );
}
