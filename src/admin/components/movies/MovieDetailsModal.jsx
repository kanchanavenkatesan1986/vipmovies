import React from 'react';
import { dbToDisplayType } from '../../utils/tableMapper';

function getPosterUrl(movie) {
  if (!movie) return '';
  const img = movie.image || '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const type = (movie.type || '').toLowerCase();
  const year = movie.year || '';
  if (img && type && year) return `/src/images/${type}/${year}/${img}`;
  return img;
}

export default function MovieDetailsModal({ isOpen, movie, onEdit, onClose }) {
  if (!isOpen || !movie) return null;

  const isComingSoon = String(movie.status || '').toLowerCase() === 'coming soon';
  const posterUrl = getPosterUrl(movie);

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="admin-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`admin-badge ${isComingSoon ? 'comingsoon' : 'active'}`}>
              {isComingSoon ? 'Coming Soon' : 'Active'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontFamily: 'monospace' }}>
              {movie.id}
            </span>
          </div>
          <button className="admin-btn" style={{ padding: '4px 8px' }} onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <div className="admin-modal-body" style={{ gap: '20px' }}>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            {/* Poster */}
            <div style={{ width: '130px', height: '190px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--admin-border)', flexShrink: 0, background: '#12151e' }}>
              <img
                src={posterUrl}
                alt={movie.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            {/* Title & Key Meta */}
            <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: 0, lineHeight: '1.3' }}>
                {movie.title}
              </h2>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span className="admin-badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                  {dbToDisplayType(movie.type)}
                </span>
                <span className="admin-badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                  {movie.year || '2026'}
                </span>
                <span className="admin-badge" style={{ background: 'rgba(255,197,24,0.15)', color: 'var(--admin-warning)' }}>
                  {movie.language || 'Tamil'}
                </span>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                <div><strong>Category:</strong> {movie.category || '-'}</div>
                <div><strong>Release:</strong> {movie.release || '-'}</div>
                <div><strong>Duration:</strong> {movie.duration || '-'}</div>
                <div><strong>Director:</strong> {movie.director || '-'}</div>
              </div>
            </div>
          </div>

          {/* Starring */}
          {movie.starring && (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
              <strong style={{ fontSize: '12px', color: 'var(--admin-text-muted)', textTransform: 'uppercase' }}>Starring:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#fff' }}>{movie.starring}</p>
            </div>
          )}

          {/* Storyline */}
          {movie.story && (
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid var(--admin-border)' }}>
              <strong style={{ fontSize: '12px', color: 'var(--admin-text-muted)', textTransform: 'uppercase' }}>Storyline:</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--admin-text-main)', lineHeight: '1.5' }}>{movie.story}</p>
            </div>
          )}

          {/* Video Quality Links */}
          <div style={{ background: 'rgba(139, 92, 246, 0.08)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
            <strong style={{ fontSize: '12px', color: 'var(--admin-purple)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
              <i className="fa-solid fa-link"></i> Video Sources:
            </strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div><strong>360p (SD):</strong> {movie.p360 ? <a href={movie.p360} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--admin-purple)' }}>{movie.p360}</a> : <span style={{ color: 'var(--admin-text-dim)' }}>Not Available</span>}</div>
              <div><strong>720p (HD):</strong> {movie.p720 ? <a href={movie.p720} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--admin-purple)' }}>{movie.p720}</a> : <span style={{ color: 'var(--admin-text-dim)' }}>Not Available</span>}</div>
              <div><strong>1080p (Full HD):</strong> {movie.p1080 ? <a href={movie.p1080} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--admin-purple)' }}>{movie.p1080}</a> : <span style={{ color: 'var(--admin-text-dim)' }}>Not Available</span>}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="admin-modal-footer">
          <button className="admin-btn" onClick={onClose}>
            Close
          </button>
          <button className="admin-btn primary" onClick={() => { onClose(); onEdit(movie); }}>
            <i className="fa-solid fa-pen-to-square"></i> Edit Movie
          </button>
        </div>

      </div>
    </div>
  );
}
