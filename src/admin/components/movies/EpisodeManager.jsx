import React, { useState, useMemo } from 'react';
import { fetchExactVideoSize, probeVideoDuration } from '../../../utils/mediaUtils';

/**
 * Generate a stable unique episode ID that is preserved across edits.
 */
export function generateEpisodeId(seasonNum, epNum) {
  const sStr = String(seasonNum || 1).padStart(2, '0');
  const eStr = String(epNum || 1).padStart(3, '0');
  const rand = Math.random().toString(36).substring(2, 6);
  return `ep-s${sStr}e${eStr}-${rand}`;
}

export default function EpisodeManager({
  episodes = [],
  onChange,
  movieTitle = '',
  movieImage = ''
}) {
  const [activeSeason, setActiveSeason] = useState(1);
  const [editingEpisode, setEditingEpisode] = useState(null); // null or episode object
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [detectingMeta, setDetectingMeta] = useState(false);
  const [detectedMeta, setDetectedMeta] = useState(null);

  // Form field state for Add/Edit
  const [formState, setFormState] = useState({
    episodeId: '',
    seasonNumber: 1,
    episodeNumber: 1,
    title: '',
    image: '',
    duration: '',
    clickurl: ''
  });

  // Calculate distinct seasons present in the episodes list
  const seasons = useMemo(() => {
    const sSet = new Set(episodes.map(e => Number(e.seasonNumber) || 1));
    sSet.add(1); // Always ensure Season 1 exists
    return Array.from(sSet).sort((a, b) => a - b);
  }, [episodes]);

  // Filter episodes for the currently active season
  const currentSeasonEpisodes = useMemo(() => {
    return episodes
      .filter(e => (Number(e.seasonNumber) || 1) === activeSeason)
      .sort((a, b) => (Number(a.episodeNumber) || 0) - (Number(b.episodeNumber) || 0));
  }, [episodes, activeSeason]);

  // Open Add Episode modal with prefilled season and next episode number
  const handleOpenAdd = () => {
    const existingInSeason = episodes.filter(e => (Number(e.seasonNumber) || 1) === activeSeason);
    const maxEp = existingInSeason.reduce((max, e) => Math.max(max, Number(e.episodeNumber) || 0), 0);
    const nextEpNum = maxEp + 1;

    setFormState({
      episodeId: generateEpisodeId(activeSeason, nextEpNum),
      seasonNumber: activeSeason,
      episodeNumber: nextEpNum,
      title: `Episode ${nextEpNum}`,
      image: '',
      duration: '',
      clickurl: ''
    });
    setFormErrors({});
    setEditingEpisode(null);
    setDetectedMeta(null);
    setIsFormOpen(true);
  };

  // Open Edit Episode modal
  const handleOpenEdit = (ep) => {
    setFormState({
      episodeId: ep.episodeId || generateEpisodeId(ep.seasonNumber, ep.episodeNumber),
      seasonNumber: Number(ep.seasonNumber) || 1,
      episodeNumber: Number(ep.episodeNumber) || 1,
      title: ep.title || '',
      image: ep.image || '',
      duration: ep.duration || '',
      clickurl: ep.clickurl || ''
    });
    setFormErrors({});
    setEditingEpisode(ep);
    setDetectedMeta(ep.duration ? { duration: ep.duration } : null);
    setIsFormOpen(true);
    if (ep.clickurl && ep.clickurl.startsWith('http')) {
      fetchExactVideoSize(ep.clickurl).then(sz => {
        if (sz) setDetectedMeta(prev => ({ ...(prev || {}), size: sz }));
      });
    }
  };

  // Auto-detect exact video size and duration from Cloudflare R2 CDN URL
  const handleAutoDetectMeta = async () => {
    const url = formState.clickurl ? formState.clickurl.trim() : '';
    if (!url || !url.startsWith('http')) {
      setFormErrors(prev => ({ ...prev, clickurl: 'Enter a valid http/https video URL first' }));
      return;
    }
    setDetectingMeta(true);
    setDetectedMeta(null);
    try {
      const [size, dur] = await Promise.all([
        fetchExactVideoSize(url),
        probeVideoDuration(url, formState.duration || '')
      ]);

      const meta = {};
      if (size) meta.size = size;
      if (dur) meta.duration = dur;

      setDetectedMeta(meta);

      if (dur && (!formState.duration || formState.duration === '00:35:00' || formState.duration === '')) {
        setFormState(prev => ({ ...prev, duration: dur }));
      }
    } catch (e) {
      console.warn('Auto detect failed:', e);
    } finally {
      setDetectingMeta(false);
    }
  };

  // Add a new season
  const handleAddSeason = () => {
    const maxSeason = seasons.reduce((max, s) => Math.max(max, s), 0);
    const newSeason = maxSeason + 1;
    setActiveSeason(newSeason);
  };

  // Move Episode Up within current season
  const handleMoveUp = (index) => {
    if (index <= 0) return;
    const list = [...currentSeasonEpisodes];
    const temp = list[index - 1];
    list[index - 1] = list[index];
    list[index] = temp;

    // Re-assign episode numbers based on new order
    list.forEach((ep, idx) => {
      ep.episodeNumber = idx + 1;
    });

    // Merge back into all episodes
    const otherEpisodes = episodes.filter(e => (Number(e.seasonNumber) || 1) !== activeSeason);
    onChange([...otherEpisodes, ...list]);
  };

  // Move Episode Down within current season
  const handleMoveDown = (index) => {
    if (index >= currentSeasonEpisodes.length - 1) return;
    const list = [...currentSeasonEpisodes];
    const temp = list[index + 1];
    list[index + 1] = list[index];
    list[index] = temp;

    // Re-assign episode numbers based on new order
    list.forEach((ep, idx) => {
      ep.episodeNumber = idx + 1;
    });

    // Merge back into all episodes
    const otherEpisodes = episodes.filter(e => (Number(e.seasonNumber) || 1) !== activeSeason);
    onChange([...otherEpisodes, ...list]);
  };

  // Delete Episode
  const handleDeleteEpisode = (episodeId) => {
    const updated = episodes.filter(e => String(e.episodeId) !== String(episodeId));
    onChange(updated);
    setDeleteConfirmId(null);
  };

  // Save Episode (Add or Edit) — called by onClick (not form submit) to avoid nested-form bug
  const handleSaveEpisode = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const errors = {};

    if (!formState.title || !formState.title.trim()) {
      errors.title = 'Title is required';
    }
    if (!formState.episodeNumber || Number(formState.episodeNumber) < 1) {
      errors.episodeNumber = 'Valid episode number is required';
    }
    if (!formState.clickurl || !formState.clickurl.trim()) {
      errors.clickurl = 'Playback URL (clickurl) is required';
    }

    // Check duplicate season & episode number
    const duplicate = episodes.find(ep =>
      String(ep.episodeId) !== String(formState.episodeId) &&
      Number(ep.seasonNumber) === Number(formState.seasonNumber) &&
      Number(ep.episodeNumber) === Number(formState.episodeNumber)
    );
    if (duplicate) {
      errors.episodeNumber = `Episode ${formState.episodeNumber} already exists in Season ${formState.seasonNumber}`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const newEp = {
      episodeId: formState.episodeId || generateEpisodeId(formState.seasonNumber, formState.episodeNumber),
      seasonNumber: Number(formState.seasonNumber),
      episodeNumber: Number(formState.episodeNumber),
      title: formState.title.trim(),
      image: formState.image.trim() || movieImage || '',
      duration: (detectedMeta?.duration || formState.duration || '').trim(),
      clickurl: formState.clickurl.trim()
    };

    let updatedEpisodes;
    if (editingEpisode) {
      updatedEpisodes = episodes.map(ep =>
        String(ep.episodeId) === String(editingEpisode.episodeId) ? newEp : ep
      );
    } else {
      updatedEpisodes = [...episodes, newEp];
    }

    // Sort by season and episode number
    updatedEpisodes.sort((a, b) => {
      const sDiff = (Number(a.seasonNumber) || 1) - (Number(b.seasonNumber) || 1);
      if (sDiff !== 0) return sDiff;
      return (Number(a.episodeNumber) || 0) - (Number(b.episodeNumber) || 0);
    });

    onChange(updatedEpisodes);
    setIsFormOpen(false);
    setEditingEpisode(null);
  };

  return (
    <div className="vip-episode-manager" style={{ marginTop: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--admin-border)', borderRadius: '12px', padding: '16px' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--admin-accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-list-ol"></i> Episodes Management
            <span style={{ fontSize: '11px', background: 'rgba(229,9,20,0.15)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '12px' }}>
              {episodes.length} {episodes.length === 1 ? 'Episode' : 'Episodes'}
            </span>
          </h4>
          <span style={{ fontSize: '12px', color: 'var(--admin-text-dim)' }}>
            Manage seasons, episode metadata, and streaming playback URLs (clickurl).
          </span>
        </div>

        <button
          type="button"
          className="admin-btn primary"
          style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={handleOpenAdd}
        >
          <i className="fa-solid fa-plus"></i> Add Episode
        </button>
      </div>

      {/* Season Selection Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--admin-text-dim)', marginRight: '4px' }}>
          Season:
        </span>
        {seasons.map(s => {
          const count = episodes.filter(e => (Number(e.seasonNumber) || 1) === s).length;
          const isActive = activeSeason === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActiveSeason(s)}
              style={{
                background: isActive ? 'var(--admin-accent)' : 'rgba(255,255,255,0.06)',
                color: isActive ? '#fff' : 'var(--admin-text-dim)',
                border: '1px solid ' + (isActive ? 'var(--admin-accent)' : 'var(--admin-border)'),
                borderRadius: '8px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              Season {s}
              <span style={{
                fontSize: '10px',
                background: isActive ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.1)',
                padding: '1px 5px',
                borderRadius: '10px'
              }}>
                {count}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={handleAddSeason}
          title="Add New Season"
          style={{
            background: 'transparent',
            color: 'var(--admin-accent)',
            border: '1px dashed var(--admin-accent)',
            borderRadius: '8px',
            padding: '5px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap'
          }}
        >
          <i className="fa-solid fa-plus"></i> Add Season
        </button>
      </div>

      {/* Episodes List for Active Season */}
      {currentSeasonEpisodes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px dashed var(--admin-border)' }}>
          <i className="fa-solid fa-film" style={{ fontSize: '28px', color: 'var(--admin-text-dim)', marginBottom: '8px' }}></i>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-text-dim)' }}>
            No episodes added for Season {activeSeason} yet.
          </p>
          <button
            type="button"
            className="admin-btn"
            style={{ marginTop: '10px', fontSize: '12px' }}
            onClick={handleOpenAdd}
          >
            <i className="fa-solid fa-plus"></i> Add Episode 1
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
          {currentSeasonEpisodes.map((ep, idx) => {
            const hasUrl = Boolean(ep.clickurl && ep.clickurl.trim() && ep.clickurl !== '#');
            const epImg = ep.image || movieImage || '';
            const previewUrl = epImg ? (epImg.startsWith('http') ? epImg : `/src/images/${epImg}`) : '';

            return (
              <div
                key={ep.episodeId || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  gap: '12px',
                  transition: 'background 0.2s'
                }}
              >
                {/* Left: Number + Thumbnail + Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: 'var(--admin-accent)',
                    width: '32px',
                    textAlign: 'center',
                    flexShrink: 0
                  }}>
                    #{ep.episodeNumber}
                  </span>

                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={ep.title}
                      style={{
                        width: '45px',
                        height: '32px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        background: '#000',
                        flexShrink: 0,
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{
                      width: '45px',
                      height: '32px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--admin-text-dim)',
                      fontSize: '11px',
                      flexShrink: 0
                    }}>
                      <i className="fa-solid fa-image"></i>
                    </div>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ep.title}
                      </span>
                      {ep.duration && (
                        <span style={{ fontSize: '11px', color: 'var(--admin-text-dim)', whiteSpace: 'nowrap' }}>
                          <i className="fa-regular fa-clock" style={{ fontSize: '10px' }}></i> {ep.duration}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: hasUrl ? '#4ade80' : '#f87171', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                      {hasUrl ? (
                        <><i className="fa-solid fa-link"></i> <span style={{ opacity: 0.8 }}>{ep.clickurl}</span></>
                      ) : (
                        <><i className="fa-solid fa-triangle-exclamation"></i> No stream URL</>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                    title="Move Up"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--admin-border)',
                      color: idx === 0 ? 'rgba(255,255,255,0.2)' : '#fff',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: idx === 0 ? 'default' : 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    <i className="fa-solid fa-arrow-up"></i>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx === currentSeasonEpisodes.length - 1}
                    title="Move Down"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--admin-border)',
                      color: idx === currentSeasonEpisodes.length - 1 ? 'rgba(255,255,255,0.2)' : '#fff',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: idx === currentSeasonEpisodes.length - 1 ? 'default' : 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    <i className="fa-solid fa-arrow-down"></i>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(ep)}
                    title="Edit Episode"
                    style={{
                      background: 'rgba(59,130,246,0.15)',
                      border: '1px solid rgba(59,130,246,0.3)',
                      color: '#60a5fa',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    <i className="fa-solid fa-pen"></i>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(ep.episodeId)}
                    title="Delete Episode"
                    style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#f87171',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000
        }}>
          <div style={{
            background: '#181820',
            border: '1px solid var(--admin-border)',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '380px',
            width: '90%',
            textAlign: 'center'
          }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '32px', color: '#f87171', marginBottom: '12px' }}></i>
            <h4 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '16px' }}>Delete Episode?</h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--admin-text-dim)' }}>
              Are you sure you want to remove this episode from the series? The change will apply when the series is saved.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                className="admin-btn"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn"
                style={{ background: '#ef4444', color: '#fff', border: 'none' }}
                onClick={() => handleDeleteEpisode(deleteConfirmId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Episode Modal */}
      {isFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '16px'
        }}>
          <div style={{
            background: '#16161f',
            border: '1px solid var(--admin-border)',
            borderRadius: '14px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid var(--admin-border)',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className={`fa-solid ${editingEpisode ? 'fa-pen' : 'fa-circle-plus'}`} style={{ color: 'var(--admin-accent)' }}></i>
                {editingEpisode ? `Edit Episode ${formState.episodeNumber}` : `Add Episode to Season ${formState.seasonNumber}`}
              </h4>
              <button
                type="button"
                className="admin-btn"
                style={{ padding: '4px 8px' }}
                onClick={() => setIsFormOpen(false)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body — NOTE: must NOT be a <form> because this component renders inside MovieFormModal's outer <form>.
                 HTML does not allow nested <form> elements; browsers silently ignore the inner one,
                 which means the submit button triggers the outer form instead. */}
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="admin-form-group">
                  <label>Season Number *</label>
                  <input
                    type="number"
                    min="1"
                    className="admin-input"
                    value={formState.seasonNumber}
                    onChange={(e) => setFormState(prev => ({ ...prev, seasonNumber: parseInt(e.target.value, 10) || 1 }))}
                  />
                </div>

                <div className="admin-form-group">
                  <label>Episode Number *</label>
                  <input
                    type="number"
                    min="1"
                    className="admin-input"
                    value={formState.episodeNumber}
                    onChange={(e) => setFormState(prev => ({ ...prev, episodeNumber: parseInt(e.target.value, 10) || 1 }))}
                  />
                  {formErrors.episodeNumber && <span className="error-text" style={{ color: '#f87171', fontSize: '11px' }}>{formErrors.episodeNumber}</span>}
                </div>
              </div>

              <div className="admin-form-group">
                <label>Episode Title *</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="e.g. Episode 1: Pilot"
                  value={formState.title}
                  onChange={(e) => setFormState(prev => ({ ...prev, title: e.target.value }))}
                />
                {formErrors.title && <span className="error-text" style={{ color: '#f87171', fontSize: '11px' }}>{formErrors.title}</span>}
              </div>

              <div className="admin-form-group">
                <label>Episode ID (Stable)</label>
                <input
                  type="text"
                  className="admin-input"
                  value={formState.episodeId}
                  disabled
                  readOnly
                  style={{ color: 'var(--admin-accent)', opacity: 0.8 }}
                />
              </div>

              <div className="admin-form-group">
                <label>Episode Image Filename or URL</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="e.g. episode-1.webp OR https://..."
                  value={formState.image}
                  onChange={(e) => setFormState(prev => ({ ...prev, image: e.target.value }))}
                />
                <span style={{ fontSize: '11px', color: 'var(--admin-text-dim)', marginTop: '2px' }}>
                  Leave empty to inherit series poster.
                </span>
              </div>

              <div className="admin-form-group">
                <label>Playback Video URL (clickurl) *</label>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="https://... direct streaming or CDN URL"
                  value={formState.clickurl}
                  onChange={(e) => setFormState(prev => ({ ...prev, clickurl: e.target.value }))}
                  onBlur={() => {
                    const url = formState.clickurl ? formState.clickurl.trim() : '';
                    if (url && url.startsWith('http')) {
                      handleAutoDetectMeta();
                    }
                  }}
                />
                {formErrors.clickurl && <span className="error-text" style={{ color: '#f87171', fontSize: '11px' }}>{formErrors.clickurl}</span>}

                {/* Auto-detected Video Duration & Size Display */}
                <div style={{
                  marginTop: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--admin-text-dim)' }}>Auto-Detected Duration:</span>
                    <span style={{ fontWeight: 700, color: (detectedMeta?.duration || formState.duration) ? '#10b981' : 'var(--admin-text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-regular fa-clock"></i>
                      {detectedMeta?.duration || formState.duration || (detectingMeta ? 'Probing...' : 'Pending URL')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--admin-text-dim)' }}>Auto-Detected Size:</span>
                    <span style={{ fontWeight: 700, color: detectedMeta?.size ? '#ffd700' : 'var(--admin-text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-hard-drive"></i>
                      {detectedMeta?.size || (detectingMeta ? 'Probing...' : 'Pending URL')}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="admin-btn secondary"
                    style={{ fontSize: '11px', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    onClick={handleAutoDetectMeta}
                    disabled={detectingMeta}
                  >
                    <i className={`fa-solid ${detectingMeta ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
                    {detectingMeta ? 'Probing...' : 'Re-Detect'}
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', paddingTop: '12px', borderTop: '1px solid var(--admin-border)' }}>
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => setIsFormOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-btn primary"
                  onClick={handleSaveEpisode}
                >
                  {editingEpisode ? 'Save Episode' : 'Add Episode'}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
