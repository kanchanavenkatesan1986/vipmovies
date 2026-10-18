import React, { useState, useEffect, useMemo } from 'react';
import { movieApi } from '../../services/movieApi';
import { VALID_TABLES, dbToDisplayType } from '../../utils/tableMapper';

export default function MoviePickerModal({
  isOpen,
  onClose,
  onSelectMovie,
  title = 'Select Movie to Feature on Homepage Slider'
}) {
  const [loading, setLoading] = useState(false);
  const [movies, setMovies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');

  // Load movies from local cache or API when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    const fetchMovies = async () => {
      // 1. Try to get movies from window.MovieRepository or window.CacheManager first for instant display
      if (window.MovieRepository && typeof window.MovieRepository.getAll === 'function') {
        const repoMovies = window.MovieRepository.getAll();
        if (Array.isArray(repoMovies) && repoMovies.length > 0) {
          if (active) setMovies(repoMovies);
          return;
        }
      }

      setLoading(true);
      try {
        // Fetch primary tables (tamil_2026, hollywood_2026, tamil_2025, etc.)
        const tablesToFetch = VALID_TABLES.filter(t => t !== 'slider');
        let combined = [];
        for (const tbl of tablesToFetch.slice(0, 4)) {
          try {
            const list = await movieApi.getMovies(tbl, false);
            if (Array.isArray(list)) combined = combined.concat(list);
          } catch (e) {}
        }
        if (active && combined.length > 0) {
          setMovies(combined);
        }
      } catch (err) {
        console.error('Failed to load movies for picker:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchMovies();

    return () => {
      active = false;
    };
  }, [isOpen]);

  // Filtered movies list based on search and filters
  const filteredMovies = useMemo(() => {
    if (!movies || movies.length === 0) return [];
    const query = searchQuery.trim().toLowerCase();

    return movies.filter(m => {
      if (!m || !m.title) return false;

      // Search match
      if (query) {
        const titleMatch = (m.title || '').toLowerCase().includes(query);
        const idMatch = String(m.id || '').toLowerCase().includes(query);
        const starMatch = (m.starring || '').toLowerCase().includes(query);
        const dirMatch = (m.director || '').toLowerCase().includes(query);
        if (!titleMatch && !idMatch && !starMatch && !dirMatch) return false;
      }

      // Category filter
      if (selectedCategory !== 'all') {
        const mType = String(m.type || '').toLowerCase();
        if (selectedCategory === 'tamil' && !mType.includes('tamil')) return false;
        if (selectedCategory === 'hollywood' && !mType.includes('hollywood')) return false;
      }

      // Year filter
      if (selectedYear !== 'all') {
        if (String(m.year || '') !== selectedYear) return false;
      }

      return true;
    }).slice(0, 80); // Cap at 80 items for fast rendering
  }, [movies, searchQuery, selectedCategory, selectedYear]);

  if (!isOpen) return null;

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div
        className="admin-modal"
        style={{ maxWidth: '880px', width: '96%', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="admin-modal-header" style={{ alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '18px'
              }}
            >
              <i className="fa-solid fa-clapperboard"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                {title}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--admin-text-muted)' }}>
                Pick any movie from catalogue to feature on homepage hero slider
              </p>
            </div>
          </div>

          <button className="admin-btn" style={{ padding: '6px 10px' }} onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div className="admin-modal-body" style={{ maxHeight: 'calc(80vh - 150px)', overflowY: 'auto' }}>
          {/* Informational Alert */}
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12.5px',
              color: '#d1fae5'
            }}
          >
            <i className="fa-solid fa-shield-halved" style={{ color: '#10b981', fontSize: '16px' }}></i>
            <div>
              <strong>Safe Slider Link Feature:</strong> Selecting a movie only creates a new slider ID (#...) entry in the slider table. The original movie detail page and its D1 database row will <strong>NOT</strong> be modified!
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
              <i
                className="fa-solid fa-magnifying-glass"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }}
              />
              <input
                type="text"
                className="admin-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Search movie by title, actor, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            <select
              className="admin-select"
              style={{ width: '130px' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="tamil">Tamil</option>
              <option value="hollywood">Hollywood</option>
            </select>

            <select
              className="admin-select"
              style={{ width: '110px' }}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="all">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          {/* Movie Results List */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '10px' }}></i>
              <div>Loading movie catalogue...</div>
            </div>
          ) : filteredMovies.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
              {filteredMovies.map((movie) => {
                const targetUrl = `https://vip-movies.pages.dev/watch?reward=${movie.id}`;
                return (
                  <div
                    key={movie.id}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--admin-border)',
                      transition: 'all 0.2s ease',
                      alignItems: 'center'
                    }}
                  >
                    {/* Poster Thumbnail */}
                    <img
                      src={movie.image}
                      alt={movie.title}
                      style={{
                        width: '55px',
                        height: '75px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        background: '#000',
                        border: '1px solid var(--admin-border)',
                        flexShrink: 0
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />

                    {/* Movie Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '13.5px',
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={movie.title}
                      >
                        {movie.title}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--admin-gold)', fontWeight: 700 }}>
                          {movie.year || '2026'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>•</span>
                        <span style={{ fontSize: '11px', color: 'var(--admin-accent)' }}>
                          {dbToDisplayType(movie.type)}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: '10.5px',
                          color: 'var(--admin-text-dim)',
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: '2px'
                        }}
                      >
                        ID: #{movie.id}
                      </div>

                      <button
                        type="button"
                        className="admin-btn primary"
                        style={{
                          marginTop: '6px',
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#fff',
                          fontWeight: 700,
                          width: '100%',
                          justifyContent: 'center'
                        }}
                        onClick={() => {
                          onSelectMovie({
                            ...movie,
                            targetUrl
                          });
                          onClose();
                        }}
                      >
                        <i className="fa-solid fa-plus"></i> Select for Slider
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
              <i className="fa-solid fa-film" style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.5 }}></i>
              <div>No movies found matching "{searchQuery}"</div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="admin-modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
            Showing {filteredMovies.length} movies • Click any movie to auto-fill slider details
          </div>
          <button type="button" className="admin-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
