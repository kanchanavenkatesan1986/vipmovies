import React, { useCallback, useMemo } from 'react';
import { useApp } from '../AppContext';
import AdvancedVideoPlayer from '../components/player/AdvancedVideoPlayer';
import './PlayerView.css';

export default function PlayerView({ movieId, initialQuality = 'auto' }) {
  const { movies, favorites, toggleFavorite } = useApp();

  const movie = useMemo(() => {
    if (!movies || movies.length === 0 || !movieId) return null;
    const norm = String(movieId).trim();
    return movies.find(m => String(m.id || m.movieId).trim() === norm);
  }, [movies, movieId]);

  const relatedMovies = useMemo(() => {
    if (!movie || !movies) return [];
    return movies
      .filter(m =>
        String(m.id || m.movieId) !== String(movie.id || movie.movieId) &&
        (m.type === movie.type || m.category === movie.category)
      )
      .slice(0, 6);
  }, [movie, movies]);

  const nextMovie = relatedMovies.length > 0 ? relatedMovies[0] : null;

  const handleGoBack = useCallback(() => {
    if (movie) {
      const id = movie.id || movie.movieId;
      window.history.pushState(null, '', `/watch?reward=${encodeURIComponent(id)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.pushState(null, '', '/home');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [movie]);

  const handlePlayNext = useCallback(() => {
    if (!nextMovie) return;
    const nextId = nextMovie.id || nextMovie.movieId;
    window.history.pushState(
      null, '',
      `/player?reward=${encodeURIComponent(nextId)}&quality=${encodeURIComponent(initialQuality || 'auto')}`
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [nextMovie, initialQuality]);

  if (!movieId || !movie) {
    return (
      <div className="vip-player-page-view">
        <div className="vip-player-notfound">
          <i className="fa-solid fa-circle-exclamation"></i>
          <p>
            Movie not found.{' '}
            <a
              href="/home"
              onClick={e => {
                e.preventDefault();
                window.history.pushState(null, '', '/home');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            >
              Go to Home
            </a>
          </p>
        </div>
      </div>
    );
  }

  const isFavorite = favorites?.some(fav => String(fav.movieId) === String(movie.id));

  return (
    <div className="vip-player-page-view">
      {/* ── 1. IN-PAGE 16:9 ADVANCED PLAYER ── */}
      <AdvancedVideoPlayer
        movie={movie}
        initialQuality={initialQuality}
        nextMovie={nextMovie}
        onPlayNextMovie={handlePlayNext}
        onBack={handleGoBack}
        autoPlay={true}
        pageMode={false}
      />

      {/* ── 2. MOVIE DETAILS CARD BELOW PLAYER ── */}
      <div className="vip-player-details-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 className="movie-title">{movie.title}</h1>
            <div className="vip-movie-tags">
              <span className="badge">{movie.year || '2026'}</span>
              <span className="badge gold">{movie.type ? movie.type.toUpperCase() : 'TAMIL'}</span>
              {movie.category && <span className="badge">{movie.category}</span>}
              {movie.language && <span className="badge">{movie.language}</span>}
            </div>
          </div>

          <button
            type="button"
            className={`btn-fav-watch${isFavorite ? ' active' : ''}`}
            onClick={() => toggleFavorite && toggleFavorite(movie)}
            style={{ width: 'auto', padding: '8px 16px' }}
          >
            <i className={isFavorite ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}></i>
            <span>{isFavorite ? 'Saved' : 'Favorite'}</span>
          </button>
        </div>

        {movie.story && (
          <div className="story-container" style={{ margin: '14px 0 0 0', padding: 0 }}>
            <p className="story-text" style={{ fontSize: '13.5px', color: 'var(--text-secondary, #94a3b8)', lineHeight: '1.6' }}>
              {movie.story}
            </p>
          </div>
        )}
      </div>

      {/* ── 3. RELATED RECOMMENDATIONS ── */}
      {relatedMovies.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <h3 className="quality-header" style={{ marginBottom: '14px' }}>
            <i className="fa-solid fa-fire" style={{ color: 'var(--accent)', marginRight: '8px' }}></i>
            Related Movies
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
            {relatedMovies.map((rel) => {
              const relId = rel.id || rel.movieId;
              const imgUrl = rel.image?.startsWith('http')
                ? rel.image
                : `/src/images/${(rel.type || 'tamil').toLowerCase()}/${rel.year || '2026'}/${rel.image}`;

              return (
                <a
                  key={relId}
                  href={`/player?reward=${encodeURIComponent(relId)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState(null, '', `/player?reward=${encodeURIComponent(relId)}`);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="movie-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}>
                    <img
                      src={imgUrl}
                      alt={rel.title}
                      loading="lazy"
                      style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }}
                    />
                    <span className="badge-quality" style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '9px' }}>HD</span>
                  </div>
                  <h4 style={{ margin: '6px 0 2px', fontSize: '12.5px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {rel.title}
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim, #94a3b8)' }}>{rel.year || '2026'}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
