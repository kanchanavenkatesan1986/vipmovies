import React, { useState, useEffect, useMemo } from 'react';
import { movieApi } from '../../services/movieApi';
import { dbToDisplayType } from '../../utils/tableMapper';
import { showToast } from '../common/ToastContainer';

export default function ArrangeMoviesModal({
  isOpen,
  selectedMovies = [],
  targetTable = '',
  onClose,
  onSuccess,
  onOptimisticUpdate
}) {
  const [orderedList, setOrderedList] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState(null);

  // Synchronize initial ordered list whenever modal opens or selection changes
  useEffect(() => {
    if (isOpen && Array.isArray(selectedMovies)) {
      setOrderedList([...selectedMovies]);
      setError(null);
      setProgressStep('');
      setProgressPercent(0);
      setIsExecuting(false);
    }
  }, [isOpen, selectedMovies]);

  // Compute numeric order helper
  const getMovieNumericOrder = (id) => {
    if (!id) return 0;
    if (typeof window !== 'undefined' && typeof window.getMovieNumber === 'function') {
      return window.getMovieNumber(id);
    }
    const parts = String(id).split('_');
    const last = parseInt(parts[parts.length - 1], 10);
    return isNaN(last) ? 0 : last;
  };

  // Determine available target slot IDs (sorted in ascending sequence)
  const targetIds = useMemo(() => {
    const ids = orderedList.map(m => m.id);
    return [...ids].sort((a, b) => getMovieNumericOrder(a) - getMovieNumericOrder(b));
  }, [orderedList]);

  // Check if all movies belong to the same table
  const tableCheck = useMemo(() => {
    if (orderedList.length === 0) return { isValid: true, table: targetTable };
    const tables = new Set(
      orderedList.map(m => m._sourceTable || (m.type && m.year ? `${String(m.type).toLowerCase()}_${m.year}` : targetTable))
    );
    const tableList = Array.from(tables).filter(Boolean);
    if (tableList.length > 1) {
      return {
        isValid: false,
        error: `Selected movies span multiple database tables (${tableList.join(', ')}). Movies must be in the same category and year table to arrange IDs.`
      };
    }
    return { isValid: true, table: tableList[0] || targetTable };
  }, [orderedList, targetTable]);

  // Count how many IDs will actually change
  const changesCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < orderedList.length; i++) {
      if (orderedList[i].id !== targetIds[i]) {
        count++;
      }
    }
    return count;
  }, [orderedList, targetIds]);

  // Reorder handlers
  const moveUp = (index) => {
    if (index <= 0 || isExecuting) return;
    setOrderedList(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const moveDown = (index) => {
    if (index >= orderedList.length - 1 || isExecuting) return;
    setOrderedList(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleReverse = () => {
    if (isExecuting) return;
    setOrderedList(prev => [...prev].reverse());
  };

  const handleReset = () => {
    if (isExecuting) return;
    setOrderedList([...selectedMovies]);
  };

  const handleRemoveItem = (id) => {
    if (isExecuting) return;
    setOrderedList(prev => prev.filter(m => m.id !== id));
  };

  // Execute Arrange / Swap immediately with optimistic UI update in milliseconds
  const handleExecute = async () => {
    if (!tableCheck.isValid) {
      setError(tableCheck.error);
      return;
    }
    if (orderedList.length < 2) {
      setError('At least 2 movies are required to arrange or swap.');
      return;
    }
    if (changesCount === 0) {
      showToast('Movies are already in this exact order. No changes needed.', 'info');
      onClose();
      return;
    }

    // 1. Immediately compute new movie card objects with new target IDs assigned
    const optimisticMovies = orderedList.map((movie, index) => ({
      ...movie,
      id: targetIds[index],
      _sourceTable: tableCheck.table
    }));

    // 2. Trigger instant UI update in milliseconds
    if (typeof onOptimisticUpdate === 'function') {
      onOptimisticUpdate(optimisticMovies);
    }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vip_catalog_optimistic_update', {
          detail: { type: 'movies', table: tableCheck.table, items: optimisticMovies }
        }));
      }
    } catch (e) {}

    showToast(`⚡ Rearranged ${orderedList.length} movies! Updating database...`);
    onClose();

    // 3. Parallel D1 update in background (~300ms)
    movieApi.arrangeMovieIds(
      tableCheck.table,
      orderedList
    ).then((res) => {
      showToast(`🎬 Successfully updated ${res.count} movie rows in ${tableCheck.table}!`);
      if (typeof onSuccess === 'function') onSuccess();
    }).catch((err) => {
      console.error('Failed to arrange movies in D1:', err);
      showToast(`⚠️ Database arrange failed: ${err.message}. Refetching...`, 'error');
      if (typeof onSuccess === 'function') onSuccess();
    });
  };

  if (!isOpen) return null;

  const isPair = orderedList.length === 2;

  const getPosterUrl = (movie) => {
    if (!movie) return '';
    const img = movie.image || '';
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    return `/src/images/${movie.type}/${movie.year}/${img}`;
  };

  return (
    <div className="admin-modal-backdrop" onClick={!isExecuting ? onClose : undefined}>
      <div
        className="admin-modal"
        style={{ maxWidth: '820px', width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="admin-modal-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--admin-blue), var(--admin-purple))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '16px'
                }}
              >
                <i className={`fa-solid ${isPair ? 'fa-right-left' : 'fa-arrow-down-up-across-line'}`}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                  {isPair ? 'Swap Movie IDs & Sequence' : `Arrange ${orderedList.length} Movies in Order`}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--admin-text-muted)' }}>
                  Selected 1 by 1 ({orderedList.length} movies) • Table:{' '}
                  <span style={{ color: 'var(--admin-accent)', fontWeight: 700 }}>
                    {tableCheck.table || 'Multiple'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {!isExecuting && (
            <button className="admin-btn" style={{ padding: '6px 10px' }} onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="admin-modal-body" style={{ maxHeight: 'calc(80vh - 140px)', overflowY: 'auto' }}>
          {/* Table error banner */}
          {!tableCheck.isValid && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '16px',
                color: '#fca5a5',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '18px', flexShrink: 0 }}></i>
              <div>{tableCheck.error}</div>
            </div>
          )}

          {/* Operation Explanation Card */}
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#fff' }}>
                <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--admin-gold)' }}></i>
                <span>
                  {isPair
                    ? 'Both movies will exchange IDs. Movie #1 takes the earlier slot, Movie #2 takes the second slot.'
                    : `Movies are ordered 1 to ${orderedList.length}. Position #1 receives the earliest ID, position #${orderedList.length} receives the latest ID.`}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                Changes to apply:{' '}
                <strong style={{ color: changesCount > 0 ? 'var(--admin-gold)' : 'var(--admin-success)' }}>
                  {changesCount} ID{changesCount !== 1 ? 's' : ''}
                </strong>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--admin-text-dim)' }}>
              Ordered Movie Sequence ({orderedList.length})
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="admin-btn"
                style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={handleReverse}
                disabled={isExecuting || orderedList.length < 2}
                title="Reverse sequence order"
              >
                <i className="fa-solid fa-arrows-up-down"></i> {isPair ? 'Swap Order' : 'Reverse Order'}
              </button>
              <button
                type="button"
                className="admin-btn"
                style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={handleReset}
                disabled={isExecuting}
                title="Reset to initial clicked order"
              >
                <i className="fa-solid fa-rotate-left"></i> Reset
              </button>
            </div>
          </div>

          {/* Movie List Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {orderedList.map((movie, index) => {
              const currentId = movie.id;
              const targetId = targetIds[index] || currentId;
              const isChanged = currentId !== targetId;

              return (
                <div
                  key={movie.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: isChanged ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isChanged ? 'rgba(59, 130, 246, 0.3)' : 'var(--admin-border)'}`,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Sequence Count Badge (1, 2, 3...) */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--admin-gold), #ea580c)',
                      color: '#000',
                      fontWeight: 900,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Poster Thumbnail */}
                  <img
                    src={getPosterUrl(movie)}
                    alt={movie.title}
                    style={{
                      width: '40px',
                      height: '56px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      background: '#111',
                      flexShrink: 0
                    }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />

                  {/* Title & Metadata */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: '#fff',
                        fontSize: '14px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={movie.title}
                    >
                      {movie.title}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>
                        {movie.year || ''} • {movie.language || 'Tamil'}
                      </span>

                      {/* ID Transition Badge */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(0, 0, 0, 0.4)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontFamily: 'monospace'
                        }}
                      >
                        <span style={{ color: isChanged ? 'var(--admin-text-dim)' : 'var(--admin-accent)', textDecoration: isChanged ? 'line-through' : 'none' }}>
                          {currentId}
                        </span>
                        {isChanged && (
                          <>
                            <i className="fa-solid fa-arrow-right" style={{ color: 'var(--admin-gold)', fontSize: '9px' }}></i>
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                              {targetId}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Up / Down Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      className="admin-btn"
                      style={{ padding: '6px 9px', fontSize: '11px' }}
                      disabled={index === 0 || isExecuting}
                      onClick={() => moveUp(index)}
                      title="Move up in sequence"
                    >
                      <i className="fa-solid fa-chevron-up"></i>
                    </button>
                    <button
                      type="button"
                      className="admin-btn"
                      style={{ padding: '6px 9px', fontSize: '11px' }}
                      disabled={index === orderedList.length - 1 || isExecuting}
                      onClick={() => moveDown(index)}
                      title="Move down in sequence"
                    >
                      <i className="fa-solid fa-chevron-down"></i>
                    </button>
                    <button
                      type="button"
                      className="admin-btn danger"
                      style={{ padding: '6px 8px', fontSize: '11px' }}
                      disabled={isExecuting || orderedList.length <= 2}
                      onClick={() => handleRemoveItem(movie.id)}
                      title="Remove from arrange list"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Bar (Visible during execution) */}
          {isExecuting && (
            <div
              style={{
                marginTop: '20px',
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(10, 14, 26, 0.95)',
                border: '1px solid var(--admin-blue)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--admin-accent)' }}></i>
                  {progressStep || 'Processing movie ID updates...'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--admin-accent)' }}>
                  {progressPercent}%
                </span>
              </div>

              <div
                style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--admin-blue), var(--admin-gold))',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              <div style={{ fontSize: '11px', color: 'var(--admin-text-dim)', marginTop: '8px', textAlign: 'center' }}>
                Please keep this window open while Cloudflare D1 database and website caches are updated safely.
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--admin-danger)',
                borderRadius: '10px',
                color: '#fca5a5',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <i className="fa-solid fa-circle-exclamation"></i>
              <div>{error}</div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="admin-modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--admin-text-muted)' }}>
            {changesCount > 0
              ? `${changesCount} ID${changesCount !== 1 ? 's' : ''} will change in D1 database`
              : 'No ID changes needed'}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="admin-btn"
              onClick={onClose}
              disabled={isExecuting}
            >
              Cancel
            </button>

            <button
              type="button"
              className="admin-btn primary"
              disabled={isExecuting || !tableCheck.isValid || changesCount === 0 || orderedList.length < 2}
              onClick={handleExecute}
              style={{ minWidth: '150px', justifyContent: 'center' }}
            >
              {isExecuting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Applying...
                </>
              ) : isPair ? (
                <>
                  <i className="fa-solid fa-right-left"></i> Confirm Swap IDs
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check-double"></i> Apply Arranged IDs
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
