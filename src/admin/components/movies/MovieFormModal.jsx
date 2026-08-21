import React, { useState, useEffect } from 'react';
import { getMovieTable, dbToDisplayType, displayToDbType } from '../../utils/tableMapper';
import { generateNextMovieId } from '../../utils/idGenerator';
import { validateMovieData } from '../../utils/validation';
import { movieApi } from '../../services/movieApi';

export default function MovieFormModal({
  isOpen,
  mode = 'create', // 'create' | 'edit'
  initialData = null,
  targetType = 'tamil',
  targetYear = '2026',
  onSave,
  onCancel,
  loading = false
}) {
  const isEdit = mode === 'edit';

  const [formData, setFormData] = useState({
    id: '',
    title: '',
    image: '',
    release: '',
    language: 'Tamil',
    year: targetYear || '2026',
    category: 'Action',
    duration: '',
    director: '',
    starring: '',
    story: '',
    p360: '',
    p720: '',
    p1080: '',
    created_at: new Date().toISOString().split('T')[0],
    type: targetType || 'tamil',
    status: 'active'
  });

  const [errors, setErrors] = useState({});
  const [targetTable, setTargetTable] = useState('tamil_2026');

  // Initialize form state
  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({
        ...initialData,
        type: displayToDbType(initialData.type || targetType),
        year: String(initialData.year || targetYear),
        status: (initialData.status || 'active').toLowerCase()
      });
      setTargetTable(getMovieTable(initialData.type || targetType, initialData.year || targetYear));
    } else {
      const dbType = displayToDbType(targetType);
      const yr = String(targetYear || '2026');
      const table = getMovieTable(dbType, yr);
      setTargetTable(table);

      // Auto generate ID
      movieApi.getMovies(table).then((existing) => {
        const nextId = generateNextMovieId(dbType, yr, existing);
        setFormData({
          id: nextId,
          title: '',
          image: '',
          release: '',
          language: dbType === 'tamil' ? 'Tamil' : 'English',
          year: yr,
          category: 'Action',
          duration: '',
          director: '',
          starring: '',
          story: '',
          p360: '',
          p720: '',
          p1080: '',
          created_at: new Date().toISOString().split('T')[0],
          type: dbType,
          status: 'active'
        });
      }).catch(() => {
        setFormData(prev => ({ ...prev, id: `${dbType}-${yr}-00001` }));
      });
    }
    setErrors({});
  }, [isOpen, mode, initialData, targetType, targetYear]);

  // Handle Type or Year changes in Create mode
  const handleTypeOrYearChange = (newType, newYear) => {
    const table = getMovieTable(newType, newYear);
    setTargetTable(table);
    movieApi.getMovies(table).then((existing) => {
      const nextId = generateNextMovieId(newType, newYear, existing);
      setFormData(prev => ({
        ...prev,
        type: newType,
        year: newYear,
        id: nextId
      }));
    }).catch(() => {
      setFormData(prev => ({
        ...prev,
        type: newType,
        year: newYear,
        id: `${newType}-${newYear}-00001`
      }));
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validation = validateMovieData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    onSave(formData, targetTable);
  };

  if (!isOpen) return null;

  // Resolve Image URL preview
  const previewImgUrl = formData.image
    ? (formData.image.startsWith('http') ? formData.image : `/src/images/${formData.type}/${formData.year}/${formData.image}`)
    : '';

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" style={{ maxWidth: '760px' }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="admin-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-circle-plus'}`} style={{ color: 'var(--admin-accent)', fontSize: '18px' }}></i>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#fff' }}>
              {isEdit ? `Edit Movie (${formData.id})` : 'Add New Movie'}
            </h3>
          </div>
          <button className="admin-btn" style={{ padding: '4px 8px' }} onClick={onCancel}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Form Body */}
        <form id="movieForm" onSubmit={handleSubmit} className="admin-modal-body">

          {/* DATABASE TARGET & ID SECTION */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--admin-border)', padding: '14px 16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--admin-accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              <i className="fa-solid fa-database"></i> Target D1 Database & Generated ID
            </div>
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label>Movie Type</label>
                {isEdit ? (
                  <input className="admin-input" value={dbToDisplayType(formData.type)} disabled readOnly />
                ) : (
                  <select
                    className="admin-select"
                    value={formData.type}
                    onChange={(e) => handleTypeOrYearChange(e.target.value, formData.year)}
                  >
                    <option value="tamil">Tamil</option>
                    <option value="hollywood">Hollywood</option>
                  </select>
                )}
              </div>

              <div className="admin-form-group">
                <label>Release Year</label>
                {isEdit ? (
                  <input className="admin-input" value={formData.year} disabled readOnly />
                ) : (
                  <select
                    className="admin-select"
                    value={formData.year}
                    onChange={(e) => handleTypeOrYearChange(formData.type, e.target.value)}
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                )}
              </div>

              <div className="admin-form-group">
                <label>Target Table</label>
                <input className="admin-input" value={targetTable} disabled readOnly style={{ color: 'var(--admin-purple)', fontWeight: 'bold' }} />
              </div>

              <div className="admin-form-group">
                <label>Movie ID</label>
                <input className="admin-input" value={formData.id} disabled readOnly style={{ color: 'var(--admin-accent)', fontWeight: 'bold' }} />
              </div>
            </div>
            {isEdit && (
              <div style={{ fontSize: '11px', color: 'var(--admin-text-dim)', marginTop: '8px' }}>
                <i className="fa-solid fa-lock"></i> Type and Year are locked during edit to prevent table mismatches.
              </div>
            )}
          </div>

          {/* BASIC INFORMATION */}
          <div className="admin-form-group full">
            <label>Movie Title *</label>
            <input
              type="text"
              className="admin-input"
              placeholder="e.g. Minions and Monsters (2026)"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          <div className="admin-form-grid">
            <div className="admin-form-group">
              <label>Language *</label>
              <select
                className="admin-select"
                value={formData.language}
                onChange={(e) => handleChange('language', e.target.value)}
              >
                <option value="Tamil">Tamil</option>
                <option value="English">English</option>
                <option value="Malayalam">Malayalam</option>
                <option value="Telugu">Telugu</option>
                <option value="Hindi">Hindi</option>
                <option value="Kannada">Kannada</option>
                {!['Tamil','English','Malayalam','Telugu','Hindi','Kannada'].includes(formData.language) && (
                  <option value={formData.language}>{formData.language}</option>
                )}
              </select>
            </div>

            <div className="admin-form-group">
              <label>Category / Genre *</label>
              <input
                type="text"
                className="admin-input"
                placeholder="Action, Comedy, Drama..."
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
              />
              {errors.category && <span className="error-text">{errors.category}</span>}
            </div>

            <div className="admin-form-group">
              <label>Release Date *</label>
              <input
                type="text"
                className="admin-input"
                placeholder="e.g. 21 June 2026"
                value={formData.release}
                onChange={(e) => handleChange('release', e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label>Duration</label>
              <input
                type="text"
                className="admin-input"
                placeholder="e.g. 02:15:35 min"
                value={formData.duration}
                onChange={(e) => handleChange('duration', e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label>Director</label>
              <input
                type="text"
                className="admin-input"
                placeholder="Director name"
                value={formData.director}
                onChange={(e) => handleChange('director', e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label>Status *</label>
              <select
                className="admin-select"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <option value="active">Active (Available)</option>
                <option value="coming soon">Coming Soon</option>
              </select>
            </div>
          </div>

          {/* MEDIA & IMAGE PREVIEW */}
          <div className="admin-form-group full">
            <label>Image Filename or Full URL *</label>
            <input
              type="text"
              className="admin-input"
              placeholder="e.g. Movie Poster.webp OR https://..."
              value={formData.image}
              onChange={(e) => handleChange('image', e.target.value)}
            />
            {previewImgUrl && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px' }}>
                <img
                  src={previewImgUrl}
                  alt="Poster Preview"
                  style={{ width: '45px', height: '65px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--admin-border)' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <span style={{ fontSize: '12px', color: 'var(--admin-text-dim)' }}>Live Poster Preview</span>
              </div>
            )}
          </div>

          {/* STARRING & STORY */}
          <div className="admin-form-group full">
            <label>Starring Cast</label>
            <input
              type="text"
              className="admin-input"
              placeholder="Actor 1, Actor 2..."
              value={formData.starring}
              onChange={(e) => handleChange('starring', e.target.value)}
            />
          </div>

          <div className="admin-form-group full">
            <label>Storyline / Overview</label>
            <textarea
              className="admin-input"
              rows={3}
              placeholder="Full plot summary..."
              value={formData.story}
              onChange={(e) => handleChange('story', e.target.value)}
            ></textarea>
          </div>

          {/* STREAMING VIDEO SOURCES */}
          <div style={{ borderTop: '1px solid var(--admin-border)', pt: '12px', marginTop: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--admin-purple)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              <i className="fa-solid fa-play"></i> Streaming & Download Video Sources (URLs)
            </div>
            
            <div className="admin-form-group full" style={{ marginBottom: '10px' }}>
              <label>360p (SD) Download URL</label>
              <input
                type="text"
                className="admin-input"
                placeholder="https://..."
                value={formData.p360}
                onChange={(e) => handleChange('p360', e.target.value)}
              />
              {errors.p360 && <span className="error-text">{errors.p360}</span>}
            </div>

            <div className="admin-form-group full" style={{ marginBottom: '10px' }}>
              <label>720p (HD) Download URL</label>
              <input
                type="text"
                className="admin-input"
                placeholder="https://..."
                value={formData.p720}
                onChange={(e) => handleChange('p720', e.target.value)}
              />
              {errors.p720 && <span className="error-text">{errors.p720}</span>}
            </div>

            <div className="admin-form-group full">
              <label>1080p (Full HD) Download URL</label>
              <input
                type="text"
                className="admin-input"
                placeholder="https://..."
                value={formData.p1080}
                onChange={(e) => handleChange('p1080', e.target.value)}
              />
              {errors.p1080 && <span className="error-text">{errors.p1080}</span>}
            </div>
          </div>

        </form>

        {/* Footer Actions */}
        <div className="admin-modal-footer">
          <button className="admin-btn" type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="admin-btn primary" type="submit" form="movieForm" disabled={loading}>
            {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : isEdit ? 'Save Changes' : 'Create Movie'}
          </button>
        </div>

      </div>
    </div>
  );
}
