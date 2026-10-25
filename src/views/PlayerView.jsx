import React, { useCallback, useMemo } from 'react';
import { useApp } from '../AppContext';
import AdvancedVideoPlayer from '../components/player/AdvancedVideoPlayer';
import './PlayerView.css';

function getMediaImageUrl(parentMovie, itemImage = '') {
  const img = itemImage || parentMovie?.image || '';
  if (!img) return '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const type = (parentMovie?.type || '').toLowerCase();
  const year = parentMovie?.year || '';
  if (img && type && year) return `/src/images/${type}/${year}/${img}`;
  return img;
}

export default function PlayerView({ movieId, episodeId, initialQuality = 'auto', initialTime = 0, rewardGranted = false }) {
  const { movies } = useApp();

  const baseRecord = useMemo(() => {
    if (!movies || movies.length === 0 || !movieId) return null;
    const norm = String(movieId).trim();
    return movies.find(m => String(m.id || m.movieId).trim() === norm) || null;
  }, [movies, movieId]);

  // Check if base record is a series
  const isSeries = useMemo(() => {
    if (!baseRecord) return false;
    return (
      baseRecord.contentType === 'series' ||
      (Array.isArray(baseRecord.episodes) && baseRecord.episodes.length > 0) ||
      (typeof baseRecord.episodes === 'string' && baseRecord.episodes.trim().startsWith('['))
    );
  }, [baseRecord]);

  // Safely parse episodes array
  const episodesList = useMemo(() => {
    if (!baseRecord || !isSeries) return [];
    if (Array.isArray(baseRecord.episodes)) return baseRecord.episodes;
    if (typeof baseRecord.episodes === 'string') {
      try {
        return JSON.parse(baseRecord.episodes);
      } catch {
        return [];
      }
    }
    return [];
  }, [baseRecord, isSeries]);

  // Identify active episode (if series)
  const currentEpisode = useMemo(() => {
    if (!isSeries || episodesList.length === 0) return null;
    if (episodeId) {
      const match = episodesList.find(e => String(e.episodeId).trim() === String(episodeId).trim());
      if (match) return match;
    }
    return episodesList[0];
  }, [isSeries, episodesList, episodeId]);

  // Identify next episode (for seamless autoplay)
  const nextEpisode = useMemo(() => {
    if (!isSeries || !currentEpisode || episodesList.length === 0) return null;
    const idx = episodesList.findIndex(e => String(e.episodeId).trim() === String(currentEpisode.episodeId).trim());
    if (idx !== -1 && idx < episodesList.length - 1) {
      return episodesList[idx + 1];
    }
    return null;
  }, [isSeries, currentEpisode, episodesList]);

  // Player compatible movie object
  const movie = useMemo(() => {
    if (!baseRecord) return null;
    if (isSeries && currentEpisode) {
      return {
        ...baseRecord,
        id: `${baseRecord.id}_${currentEpisode.episodeId}`,
        seriesId: baseRecord.id,
        episodeId: currentEpisode.episodeId,
        title: `${baseRecord.title} - S${currentEpisode.seasonNumber || 1}E${currentEpisode.episodeNumber}: ${currentEpisode.title}`,
        image: getMediaImageUrl(baseRecord, currentEpisode.image),
        videoUrl: currentEpisode.clickurl || '',
        p360: currentEpisode.clickurl || '',
        p720: currentEpisode.clickurl || '',
        p1080: currentEpisode.clickurl || '',
        duration: currentEpisode.duration || baseRecord.duration || '',
        seasonNumber: currentEpisode.seasonNumber,
        episodeNumber: currentEpisode.episodeNumber,
        isSeriesEpisode: true
      };
    }
    return baseRecord;
  }, [baseRecord, isSeries, currentEpisode]);

  // Fallback related movies if not series
  const relatedMovies = useMemo(() => {
    if (!baseRecord || !movies || isSeries) return [];
    return movies
      .filter(m =>
        String(m.id || m.movieId) !== String(baseRecord.id || baseRecord.movieId) &&
        (m.type === baseRecord.type || m.category === baseRecord.category)
      )
      .slice(0, 4);
  }, [baseRecord, movies, isSeries]);

  // Next movie object (Next Episode if series, else related movie)
  const nextMovie = useMemo(() => {
    if (isSeries && nextEpisode && baseRecord) {
      return {
        id: `${baseRecord.id}_${nextEpisode.episodeId}`,
        seriesId: baseRecord.id,
        episodeId: nextEpisode.episodeId,
        title: `${baseRecord.title} - S${nextEpisode.seasonNumber || 1}E${nextEpisode.episodeNumber}: ${nextEpisode.title}`,
        videoUrl: nextEpisode.clickurl || '',
        p360: nextEpisode.clickurl || '',
        p720: nextEpisode.clickurl || '',
        p1080: nextEpisode.clickurl || '',
        isSeriesEpisode: true
      };
    }
    return relatedMovies.length > 0 ? relatedMovies[0] : null;
  }, [isSeries, nextEpisode, baseRecord, relatedMovies]);

  const handleGoBack = useCallback(() => {
    if (baseRecord) {
      const id = baseRecord.id || baseRecord.movieId;
      const returnUrl = isSeries
        ? `/watch-series.html?id=${encodeURIComponent(id)}`
        : `/watch-movie.html?id=${encodeURIComponent(id)}`;
      window.history.pushState(null, '', returnUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.pushState(null, '', '/home');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [baseRecord, isSeries]);

  const handlePlayNext = useCallback(() => {
    if (isSeries && nextEpisode && baseRecord) {
      const sId = baseRecord.id || baseRecord.movieId;
      // Use ?id= — next episode navigation never re-triggers ad
      window.history.pushState(
        null, '',
        `/player?id=${encodeURIComponent(sId)}&ep=${encodeURIComponent(nextEpisode.episodeId)}&quality=${encodeURIComponent(initialQuality || 'auto')}`
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    if (!nextMovie) return;
    const nextId = nextMovie.id || nextMovie.movieId;
    // Use ?id= — related movie navigation never re-triggers ad
    window.history.pushState(
      null, '',
      `/player?id=${encodeURIComponent(nextId)}&quality=${encodeURIComponent(initialQuality || 'auto')}`
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [isSeries, nextEpisode, baseRecord, nextMovie, initialQuality]);

  if (!movieId || !baseRecord || !movie) {
    return (
      <div className="vip-player-isolated-wrapper">
        <div className="vip-player-notfound">
          <i className="fa-solid fa-circle-exclamation"></i>
          <p>
            {isSeries ? 'Series or episode not found.' : 'Movie not found.'}{' '}
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
        initialTime={initialTime}
        rewardGranted={rewardGranted}
        nextMovie={nextMovie}
        onPlayNextMovie={handlePlayNext}
        onBack={handleGoBack}
        autoPlay={true}
        pageMode={true}
      />
    </div>
  );
}
