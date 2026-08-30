import React, { useCallback, useMemo } from 'react';
import { useApp } from '../AppContext';
import AdvancedVideoPlayer from '../components/player/AdvancedVideoPlayer';
import './PlayerView.css';

export default function PlayerView({ movieId, initialQuality = 'auto' }) {
  const { movies } = useApp();

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
      .slice(0, 4);
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
      <div className="vip-player-isolated-wrapper">
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

  return (
    <div className="vip-player-isolated-wrapper">
      <AdvancedVideoPlayer
        movie={movie}
        initialQuality={initialQuality}
        nextMovie={nextMovie}
        onPlayNextMovie={handlePlayNext}
        onBack={handleGoBack}
        autoPlay={true}
        pageMode={true}
      />
    </div>
  );
}
