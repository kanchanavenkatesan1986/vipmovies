import React, { useState, useEffect, useMemo } from 'react';
import { slideApi } from '../../services/slideApi';
import { showToast } from '../common/ToastContainer';
import { dispatchOptimisticUpdate } from '../../services/syncManager';

export default function ArrangeSlidesModal({
  isOpen,
  selectedSlides = [],
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
    if (isOpen && Array.isArray(selectedSlides)) {
      setOrderedList([...selectedSlides]);
      setError(null);
      setProgressStep('');
      setProgressPercent(0);
      setIsExecuting(false);
    }
  }, [isOpen, selectedSlides]);

  // Determine available target slot IDs (sorted in ascending numeric order)
  const targetIds = useMemo(() => {
    const ids = orderedList.map(s => Number(s.id));
    return [...ids].sort((a, b) => a - b);
  }, [orderedList]);

  // Count how many IDs will actually change
  const changesCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < orderedList.length; i++) {
      if (Number(orderedList[i].id) !== Number(targetIds[i])) {
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
    setOrderedList([...selectedSlides]);
  };

  const handleRemoveItem = (id) => {
    if (isExecuting) return;
    setOrderedList(prev => prev.filter(s => s.id !== id));
  };

  // Execute Arrange / Swap immediately with optimistic UI update in milliseconds
  const handleExecute = async () => {
    if (orderedList.length < 2) {
      setError('At least 2 slides are required to arrange or swap.');
      return;
    }
    if (changesCount === 0) {
      showToast('Slides are already in this exact order. No changes needed.', 'info');
      onClose();
      return;
    }

    // 1. Immediately compute new slide card objects with new target IDs assigned
    const optimisticSlides = orderedList.map((slide, index) => ({
      ...slide,
      id: Number(targetIds[index])
    }));

    // 2. Trigger instant UI update in milliseconds
    if (typeof onOptimisticUpdate === 'function') {
      onOptimisticUpdate(optimisticSlides);
    }

    dispatchOptimisticUpdate('slides', { items: optimisticSlides });

    showToast(`⚡ Rearranged ${orderedList.length} slides! Updating database...`);
    onClose();

    // 3. Parallel D1 database update in background (~300ms)
    slideApi.arrangeSlideIds(
      orderedList
    ).then((res) => {
      showToast(`🖼️ Successfully updated ${res.count} slide rows in database!`);
      if (typeof onSuccess === 'function') onSuccess();
    }).catch((err) => {
      console.error('Failed to arrange slides in D1:', err);
      showToast(`⚠️ Database arrange failed: ${err.message}. Refetching...`, 'error');
      if (typeof onSuccess === 'function') onSuccess();
    });
  };

  if (!isOpen) return null;

  const isPair = orderedList.length === 2;

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
                  background: 'linear-gradient(135deg, var(--admin-gold), #ea580c)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                <i className={`fa-solid ${isPair ? 'fa-right-left' : 'fa-arrow-down-up-across-line'}`}></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                  {isPair ? 'Swap Slide IDs & Sequence' : `Arrange ${orderedList.length} Slides in Order`}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--admin-text-muted)' }}>
                  Selected 1 by 1 ({orderedList.length} banners) • Controls hero slider display on homepage
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
          {/* Operation Explanation Card */}
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
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
                    ? 'Both slides will exchange IDs. Slide #1 will show earlier on the homepage carousel, Slide #2 later.'
                    : `Slides are ordered 1 to ${orderedList.length}. Position #1 receives the earliest ID, position #${orderedList.length} receives the latest ID.`}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                Changes to apply:{' '}
                <strong style={{ color: changesCount > 0 ? 'var(--admin-gold)' : 'var(--admin-success)' }}>
                  {changesCount} ID{changesCount !== 1 ? 's' : ''}
                </strong>
              </div>
            </div>
            <div style={{ fontSize: '11.5px', color: '#10b981', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-circle-check"></i>
              Both IDs and D1 database rows in slider are safely rearranged. Movie detail pages in the movie catalogue remain completely unchanged.
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
              Ordered Slide Sequence ({orderedList.length})
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

          {/* Slide List Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {orderedList.map((slide, index) => {
              const currentId = Number(slide.id);
              const targetId = targetIds[index] !== undefined ? targetIds[index] : currentId;
              const isChanged = currentId !== targetId;

              return (
                <div
                  key={slide.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: isChanged ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isChanged ? 'rgba(245, 158, 11, 0.35)' : 'var(--admin-border)'}`,
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

                  {/* Wide Banner Thumbnail */}
                  <img
                    src={slide.image}
                    alt={slide.title}
                    style={{
                      width: '110px',
                      height: '55px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      background: '#000',
                      border: '1px solid var(--admin-border)',
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
                      title={slide.title}
                    >
                      {slide.title}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>
                        Status: <strong style={{ color: '#10b981' }}>{slide.status || 'active'}</strong>
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
                          ID: #{currentId}
                        </span>
                        {isChanged && (
                          <>
                            <i className="fa-solid fa-arrow-right" style={{ color: 'var(--admin-gold)', fontSize: '9px' }}></i>
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                              New ID: #{targetId}
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
                      onClick={() => handleRemoveItem(slide.id)}
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
                border: '1px solid var(--admin-gold)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ color: 'var(--admin-gold)' }}></i>
                  {progressStep || 'Processing slide ID updates...'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--admin-gold)' }}>
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
                    background: 'linear-gradient(90deg, var(--admin-gold), #ea580c)',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              <div style={{ fontSize: '11px', color: 'var(--admin-text-dim)', marginTop: '8px', textAlign: 'center' }}>
                Please keep this window open while Cloudflare D1 database and homepage slider caches are updated safely.
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
              ? `${changesCount} slide ID${changesCount !== 1 ? 's' : ''} will change in D1 database`
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
              disabled={isExecuting || changesCount === 0 || orderedList.length < 2}
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
