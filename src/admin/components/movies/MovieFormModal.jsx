import React, { useState, useEffect } from 'react';
import { getMovieTable, dbToDisplayType, displayToDbType } from '../../utils/tableMapper';
import { generateNextMovieId } from '../../utils/idGenerator';
import { validateMovieData } from '../../utils/validation';
import { movieApi } from '../../services/movieApi';
import { getMediaBaseUrl, setMediaBaseUrl, resolveMediaUrl, DEFAULT_MEDIA_BASE_URL } from '../../../utils/mediaUtils';
import EpisodeManager from './EpisodeManager';

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
    status: 'active',
    contentType: 'movie',
    episodes: []
  });

  const [errors, setErrors] = useState({});
  const [targetTable, setTargetTable] = useState('tamil_2026');
  const [contentTypeWarning, setContentTypeWarning] = useState(false);
  const [cdnBaseUrl, setCdnBaseUrl] = useState(() => getMediaBaseUrl());
  const [isEditingCdn, setIsEditingCdn] = useState(false);
  const [cdnSavedMsg, setCdnSavedMsg] = useState('');

  // Default path route calculation for current movie
  const movieSlug = (formData.title || '')
    .toLowerCase()
    .replace(/\(\d{4}\)/g, '')
    .replace(/\((original|dvd|hdrip|bdrip|tamil|telugu|dubbed|proper|web-series|season\s*\d+)\)/gi, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();

  const currentFolderType = displayToDbType(formData.type || targetType || 'tamil');
  const currentFolderYear = String(formData.year || targetYear || '2026').trim();
  const defaultPathRoute = `${currentFolderType}/${currentFolderYear}/${movieSlug ? `${movieSlug}/` : ''}`;

  const handleSaveCdnBase = () => {
    const saved = setMediaBaseUrl(cdnBaseUrl);
    setCdnBaseUrl(saved);
    setIsEditingCdn(false);
    setCdnSavedMsg('✓ CDN Base URL Updated');
    setTimeout(() => setCdnSavedMsg(''), 3000);
  };

  const handleApplyDefaultPathRoute = () => {
    const baseSlug = movieSlug || 'movie';
    setFormData(prev => ({
      ...prev,
      p360: `${defaultPathRoute}${baseSlug}_360p.mp4`,
      p720: `${defaultPathRoute}${baseSlug}_720p.mp4`,
      p1080: `${defaultPathRoute}${baseSlug}_1080p.mp4`
    }));
  };

  // Initialize form state
  useEffect(() => {
    if (isEdit && initialData) {
      const dbType = displayToDbType(initialData.type || targetType);
      const yr = String(initialData.year || targetYear);
      let parsedEpisodes = [];
      if (Array.isArray(initialData.episodes)) {
        parsedEpisodes = initialData.episodes;
      } else if (typeof initialData.episodes === 'string') {
        try {
          parsedEpisodes = JSON.parse(initialData.episodes);
        } catch {
          parsedEpisodes = [];
        }
      }

      const inferredContentType = initialData.contentType
        ? initialData.contentType.toLowerCase()
        : (parsedEpisodes.length > 0 ? 'series' : 'movie');

      setFormData({
        id: initialData.id || '',
        title: initialData.title || '',
        image: initialData.image || '',
        release: initialData.release || '',
        language: initialData.language || (dbType === 'tamil' ? 'Tamil' : 'English'),
        year: yr,
        category: initialData.category || 'Action',
        duration: initialData.duration || '',
        director: initialData.director || '',
        starring: initialData.starring || '',
        story: initialData.story || '',
        p360: initialData.p360 || initialData.p460 || initialData['460p'] || '',
        p720: initialData.p720 || initialData['720p'] || '',
        p1080: initialData.p1080 || initialData['1080p'] || '',
        created_at: initialData.created_at || new Date().toISOString().split('T')[0],
        type: dbType,
        status: (initialData.status || 'active').toLowerCase(),
        contentType: inferredContentType,
        episodes: parsedEpisodes
      });
      setTargetTable(initialData._sourceTable || getMovieTable(dbType, yr));
    } else {
      const dbType = displayToDbType(targetType);
      const yr = String(targetYear || '2026');
      const table = getMovieTable(dbType, yr);
      setTargetTable(table);

      // Default new movie ID is always position #1 (00001)
      const defaultId = `${dbType}-${yr}-00001`;
      setFormData({
        id: defaultId,
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
        status: 'active',
        contentType: 'movie',
        episodes: []
      });
    }
    setErrors({});
    setContentTypeWarning(false);
  }, [isOpen, mode, initialData, targetType, targetYear]);

  // Handle Type or Year changes in Create mode
  const handleTypeOrYearChange = (newType, newYear) => {
    const table = getMovieTable(newType, newYear);
    setTargetTable(table);
    setFormData(prev => ({
      ...prev,
      type: newType,
      year: newYear,
      id: `${newType}-${newYear}-00001`
    }));
  };

  // Handle Content Type change with warning if episodes exist
  const handleContentTypeChange = (newType) => {
    if (formData.contentType === 'series' && newType === 'movie' && formData.episodes && formData.episodes.length > 0) {
      setContentTypeWarning(true);
      return;
    }
    handleChange('contentType', newType);
  };

  const confirmSwitchToMovie = () => {
    handleChange('contentType', 'movie');
    setContentTypeWarning(false);
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

  const isSeries = formData.contentType === 'series';

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" style={{ maxWidth: '820px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="admin-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className={`fa-solid ${isSeries ? 'fa-tv' : isEdit ? 'fa-pen-to-square' : 'fa-circle-plus'}`} style={{ color: 'var(--admin-accent)', fontSize: '18px' }}></i>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#fff' }}>
              {isEdit ? `Edit ${isSeries ? 'Series' : 'Movie'} (${formData.id})` : `Add New ${isSeries ? 'Series' : 'Movie'}`}
            </h3>
          </div>
          <button className="admin-btn" style={{ padding: '4px 8px' }} onClick={onCancel}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content Type Switch Warning Modal */}
        {contentTypeWarning && (
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            borderBottom: '1px solid #ef4444',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '12px'
          }}>
            <div style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#f87171', fontSize: '16px' }}></i>
              <span>
                <strong>Warning:</strong> This record has <strong>{formData.episodes?.length || 0} episode(s)</strong>.
                Switching to Movie will keep episode data in memory, but if saved as a movie, streaming will rely on movie quality URLs.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                className="admin-btn"
                style={{ padding: '4px 10px', fontSize: '11px' }}
                onClick={() => setContentTypeWarning(false)}
              >
                Keep Series
              </button>
              <button
                type="button"
                className="admin-btn"
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', fontSize: '11px' }}
                onClick={confirmSwitchToMovie}
              >
                Switch to Movie
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form id="movieForm" onSubmit={handleSubmit} className="admin-modal-body" style={{ overflowY: 'auto' }}>

          {/* DATABASE TARGET & ID SECTION */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--admin-border)', padding: '14px 16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--admin-accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              <i className="fa-solid fa-database"></i> Content Type, D1 Target & Generated ID
            </div>
            <div className="admin-form-grid">
              
              {/* Content Type Selector */}
              <div className="admin-form-group">
                <label>Content Type *</label>
                <select
                  className="admin-select"
                  value={formData.contentType || 'movie'}
                  onChange={(e) => handleContentTypeChange(e.target.value)}
                  style={{
                    borderColor: isSeries ? 'var(--admin-accent)' : undefined,
                    fontWeight: 700,
                    color: isSeries ? 'var(--admin-accent)' : '#fff'
                  }}
                >
                  <option value="movie">Movie</option>
                  <option value="series">Series</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label>Collection Type</label>
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
                <label>{isSeries ? 'Series' : 'Movie'} ID {!isEdit && <span style={{ color: 'var(--admin-gold)', fontSize: '11px' }}>(Position #1)</span>}</label>
                <input className="admin-input" value={formData.id} disabled readOnly style={{ color: 'var(--admin-accent)', fontWeight: 'bold' }} />
              </div>
            </div>

            {!isEdit && (
              <div style={{ fontSize: '11px', color: 'var(--admin-gold)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-arrow-down-wide-short"></i> New record will be inserted as ID 1 (Row 1). All existing records in {targetTable} will automatically shift +1 (1 → 2, 2 → 3...).
              </div>
            )}
            {isEdit && (
              <div style={{ fontSize: '11px', color: 'var(--admin-text-dim)', marginTop: '8px' }}>
                <i className="fa-solid fa-lock"></i> Type and Year are locked during edit to prevent table mismatches.
              </div>
            )}
          </div>

          {/* BASIC INFORMATION */}
          <div className="admin-form-group full">
            <label>{isSeries ? 'Series Title *' : 'Movie Title *'}</label>
            <input
              type="text"
              className="admin-input"
              placeholder={isSeries ? "e.g. Stranger Things (2026)" : "e.g. Minions and Monsters (2026)"}
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
              <label>Duration {isSeries && <span style={{ fontSize: '11px', color: 'var(--admin-text-dim)' }}>(Avg/Optional)</span>}</label>
              <input
                type="text"
                className="admin-input"
                placeholder={isSeries ? "e.g. 45 min / ep" : "e.g. 02:15:35 min"}
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
            <label>{isSeries ? 'Series Poster Image Filename or Full URL *' : 'Movie Poster Image Filename or Full URL *'}</label>
            <input
              type="text"
              className="admin-input"
              placeholder="e.g. Poster.webp OR https://..."
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

          {/* CONDITIONAL SECTION: EPISODES FOR SERIES vs VIDEO SOURCES FOR MOVIE */}
          {isSeries ? (
            <EpisodeManager
              episodes={formData.episodes || []}
              onChange={(newEpisodes) => handleChange('episodes', newEpisodes)}
              movieTitle={formData.title}
              movieImage={formData.image}
            />
          ) : (
            /* STREAMING VIDEO SOURCES FOR MOVIE */
            <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '14px', marginTop: '4px' }}>
              
              {/* CDN BASE URL CONFIGURATION & DEFAULT ROUTE CONTROLS */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--admin-border)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {/* Header: CDN Worker Base URL with Manual Change Option */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: 'var(--admin-purple)', textTransform: 'uppercase' }}>
                    <i className="fa-solid fa-server"></i> CDN Media Base URL:
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cdnSavedMsg && <span style={{ color: '#10b981', fontSize: '11px', fontWeight: 700 }}>{cdnSavedMsg}</span>}
                    <button
                      type="button"
                      className="admin-btn"
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                      onClick={() => setIsEditingCdn(prev => !prev)}
                    >
                      <i className="fa-solid fa-gear"></i> {isEditingCdn ? 'Cancel' : 'Change CDN URL'}
                    </button>
                  </div>
                </div>

                {isEditingCdn ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="admin-input"
                      style={{ fontSize: '12px', padding: '6px 10px', flex: 1 }}
                      value={cdnBaseUrl}
                      onChange={(e) => setCdnBaseUrl(e.target.value)}
                      placeholder="https://api-download.akatsuki-pvt-ltd.workers.dev"
                    />
                    <button
                      type="button"
                      className="admin-btn primary"
                      style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                      onClick={handleSaveCdnBase}
                    >
                      <i className="fa-solid fa-check"></i> Save
                    </button>
                    <button
                      type="button"
                      className="admin-btn"
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                      onClick={() => {
                        setCdnBaseUrl(DEFAULT_MEDIA_BASE_URL);
                        setMediaBaseUrl(DEFAULT_MEDIA_BASE_URL);
                        setIsEditingCdn(false);
                      }}
                      title="Reset to default CDN"
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-main)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px', wordBreak: 'break-all' }}>
                    {cdnBaseUrl}
                  </div>
                )}

                {/* Default Path Route Helper for this Movie */}
                <div style={{
                  background: 'rgba(139, 92, 246, 0.08)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                      <i className="fa-solid fa-folder-tree" style={{ color: 'var(--admin-accent)', marginRight: '5px' }}></i>
                      Default Path Route: <code style={{ color: 'var(--admin-accent)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>{defaultPathRoute}</code>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="admin-btn"
                        style={{ padding: '3px 8px', fontSize: '11px', background: 'rgba(255,255,255,0.06)' }}
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(defaultPathRoute);
                            setCdnSavedMsg('✓ Route Copied!');
                            setTimeout(() => setCdnSavedMsg(''), 2000);
                          }
                        }}
                        title="Copy route to clipboard"
                      >
                        <i className="fa-regular fa-copy"></i> Copy Route
                      </button>
                      <button
                        type="button"
                        className="admin-btn primary"
                        style={{ padding: '3px 10px', fontSize: '11px' }}
                        onClick={handleApplyDefaultPathRoute}
                        title="Auto-fill 360p, 720p, 1080p with default path route and filenames"
                      >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Auto-Fill Paths
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--admin-text-dim)' }}>
                    Paste either <strong>relative storage path</strong> (e.g. <code>{defaultPathRoute}movie_1080p.mp4</code>) or <strong>full worker URL</strong> (<code>{cdnBaseUrl}/{defaultPathRoute}movie_1080p.mp4</code>). Both work everywhere!
                  </div>
                </div>
              </div>
              
              {/* 360p Input */}
              <div className="admin-form-group full" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>360p (SD) Video Link (Path or Full URL)</label>
                  {formData.p360 && (
                    <span style={{ fontSize: '11px', color: formData.p360.startsWith('http') ? '#38bdf8' : '#10b981', fontWeight: 600 }}>
                      {formData.p360.startsWith('http') ? 'Full URL' : 'Relative Storage Path'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  className="admin-input"
                  placeholder={`${defaultPathRoute}${movieSlug || 'movie'}_360p.mp4 OR https://...`}
                  value={formData.p360}
                  onChange={(e) => handleChange('p360', e.target.value)}
                />
                {errors.p360 && <span className="error-text">{errors.p360}</span>}
                {formData.p360 && !formData.p360.startsWith('http') && formData.p360.trim() !== '#' && (
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '3px', wordBreak: 'break-all' }}>
                    <i className="fa-solid fa-cloud-arrow-up"></i> CDN Preview: <code>{resolveMediaUrl(formData.p360)}</code>
                  </div>
                )}
              </div>

              {/* 720p Input */}
              <div className="admin-form-group full" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>720p (HD) Video Link (Path or Full URL)</label>
                  {formData.p720 && (
                    <span style={{ fontSize: '11px', color: formData.p720.startsWith('http') ? '#38bdf8' : '#10b981', fontWeight: 600 }}>
                      {formData.p720.startsWith('http') ? 'Full URL' : 'Relative Storage Path'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  className="admin-input"
                  placeholder={`${defaultPathRoute}${movieSlug || 'movie'}_720p.mp4 OR https://...`}
                  value={formData.p720}
                  onChange={(e) => handleChange('p720', e.target.value)}
                />
                {errors.p720 && <span className="error-text">{errors.p720}</span>}
                {formData.p720 && !formData.p720.startsWith('http') && formData.p720.trim() !== '#' && (
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '3px', wordBreak: 'break-all' }}>
                    <i className="fa-solid fa-cloud-arrow-up"></i> CDN Preview: <code>{resolveMediaUrl(formData.p720)}</code>
                  </div>
                )}
              </div>

              {/* 1080p Input */}
              <div className="admin-form-group full" style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>1080p (Full HD) Video Link (Path or Full URL)</label>
                  {formData.p1080 && (
                    <span style={{ fontSize: '11px', color: formData.p1080.startsWith('http') ? '#38bdf8' : '#10b981', fontWeight: 600 }}>
                      {formData.p1080.startsWith('http') ? 'Full URL' : 'Relative Storage Path'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  className="admin-input"
                  placeholder={`${defaultPathRoute}${movieSlug || 'movie'}_1080p.mp4 OR https://...`}
                  value={formData.p1080}
                  onChange={(e) => handleChange('p1080', e.target.value)}
                />
                {errors.p1080 && <span className="error-text">{errors.p1080}</span>}
                {formData.p1080 && !formData.p1080.startsWith('http') && formData.p1080.trim() !== '#' && (
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '3px', wordBreak: 'break-all' }}>
                    <i className="fa-solid fa-cloud-arrow-up"></i> CDN Preview: <code>{resolveMediaUrl(formData.p1080)}</code>
                  </div>
                )}
              </div>
            </div>
          )}

        </form>

        {/* Footer Actions */}
        <div className="admin-modal-footer">
          <button className="admin-btn" type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="admin-btn primary" type="submit" form="movieForm" disabled={loading}>
            {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : isEdit ? 'Save Changes' : (isSeries ? 'Create Series' : 'Create Movie')}
          </button>
        </div>

      </div>
    </div>
  );
}
