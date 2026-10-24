import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../AppContext';
import { fetchExactVideoSize, probeVideoDuration, parseSizeFromUrl, getDownloadUrl } from '../utils/mediaUtils';

function getSeriesImageUrl(series, episodeImage = '') {
  const img = episodeImage || (series ? series.image : '') || '';
  if (!img) return '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const type = (series?.type || '').toLowerCase();
  const year = series?.year || '';
  if (img && type && year) return `/src/images/${type}/${year}/${img}`;
  return img;
}

/**
 * Individual Episode Row with dynamic size & duration probing,
 * enlarged visible thumbnail, separate player navigation, and target="_blank" download.
 */
function EpisodeRow({ ep, series, onPlay }) {
  const [exactSize, setExactSize] = useState(() => parseSizeFromUrl(ep.clickurl));
  const [exactDuration, setExactDuration] = useState(() => ep.duration || '');

  useEffect(() => {
    let isMounted = true;
    const url = ep.clickurl;
    if (!url || !url.startsWith('http')) return;

    // Probe exact video size from Cloudflare R2 CDN Worker (Content-Length / Range header)
    fetchExactVideoSize(url).then((size) => {
      if (isMounted && size) setExactSize(size);
    });

    // Probe exact duration from video metadata if not manually set
    if (!ep.duration || ep.duration.trim() === '') {
      probeVideoDuration(url, ep.duration).then((dur) => {
        if (isMounted && dur) setExactDuration(dur);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [ep.clickurl, ep.duration]);

  const hasClickUrl = Boolean(ep.clickurl && ep.clickurl.trim() && ep.clickurl !== '#');
  const epImgSrc = getSeriesImageUrl(series, ep.image);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        borderRadius: '14px',
        padding: '14px 18px',
        gap: '16px',
        flexWrap: 'wrap',
        transition: 'all 0.25s ease',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)'
      }}
    >
      {/* Left: Enlarged Thumbnail & Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 280px', minWidth: 0 }}>
        
        {/* Enlarged Thumbnail Container (135px × 80px 16:9 widescreen) */}
        <div
          onClick={() => hasClickUrl && onPlay(ep)}
          style={{
            position: 'relative',
            width: '135px',
            height: '80px',
            borderRadius: '10px',
            overflow: 'hidden',
            background: '#101016',
            flexShrink: 0,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            cursor: hasClickUrl ? 'pointer' : 'default',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
          }}
        >
          {epImgSrc ? (
            <img
              src={epImgSrc}
              alt={ep.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '22px'
              }}
            >
              <i className="fa-solid fa-film"></i>
            </div>
          )}

          {/* Episode Number Badge */}
          <span
            style={{
              position: 'absolute',
              bottom: '5px',
              left: '5px',
              background: 'rgba(0, 0, 0, 0.82)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'var(--accent, #ffd700)',
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: '0.4px'
            }}
          >
            EP {ep.episodeNumber}
          </span>
        </div>

        {/* Title & Metadata Badges */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h4
            style={{
              margin: '0 0 6px 0',
              fontSize: '15px',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.35,
              wordBreak: 'break-word'
            }}
          >
            {ep.title}
          </h4>

          {/* Metadata Badges (Season, Duration, Size, Quality) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600 }}>
              S{ep.seasonNumber || 1} • Ep {ep.episodeNumber}
            </span>

            {/* Exact Duration Badge */}
            {(exactDuration || ep.duration) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                <i className="fa-regular fa-clock" style={{ fontSize: '11px', color: 'var(--accent, #ffd700)' }}></i>
                <span>{exactDuration || ep.duration}</span>
              </span>
            )}

            {/* Exact Video Size from Cloudflare R2 CDN */}
            {exactSize && (
              <span
                className="quality-size-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(255, 215, 0, 0.12)',
                  border: '1px solid rgba(255, 215, 0, 0.28)',
                  color: '#ffd700',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                <i className="fa-solid fa-hard-drive"></i> {exactSize}
              </span>
            )}

            {/* Quality Tag */}
            <span
              style={{
                background: 'rgba(0, 230, 118, 0.12)',
                border: '1px solid rgba(0, 230, 118, 0.25)',
                color: '#00e676',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 800
              }}
            >
              1080p FHD
            </span>
          </div>
        </div>

      </div>

      {/* Right: Action Buttons (Play & Download target="_blank") */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {hasClickUrl ? (
          <>
            {/* Play Button -> Separate Player Page */}
            <button
              type="button"
              className="quality-btn-play p720"
              title={`Play Episode ${ep.episodeNumber} in Player`}
              onClick={() => onPlay(ep)}
              style={{
                border: 'none',
                padding: '9px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              <i className="fa-solid fa-play"></i>
              <span>Play</span>
            </button>

            {/* Download Button -> target="_blank" forces direct download via ?download=1 */}
            <a
              className="quality-btn-down p720"
              href={getDownloadUrl(ep.clickurl)}
              target="_blank"
              rel="noopener noreferrer"
              title={`Download Episode ${ep.episodeNumber}`}
              style={{
                textDecoration: 'none',
                padding: '9px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              <i className="fa-solid fa-download"></i>
              <span>Download</span>
            </a>
          </>
        ) : (
          <span
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              padding: '6px 12px',
              borderRadius: '6px'
            }}
          >
            Unavailable
          </span>
        )}
      </div>

    </div>
  );
}

export default function WatchSeriesView({ seriesId }) {
  const { movies, favorites, toggleFavorite, recordHistory } = useApp();

  // Find parent series record
  const series = useMemo(() => {
    if (!seriesId || !movies || movies.length === 0) return null;
    const cleanId = String(seriesId).trim();
    return movies.find(m => String(m.id || m.movieId).trim() === cleanId) || null;
  }, [seriesId, movies]);

  // If record is actually a movie, redirect to watch-movie.html
  useEffect(() => {
    if (series && series.contentType === 'movie' && (!series.episodes || series.episodes.length === 0)) {
      const id = series.id || series.movieId;
      window.history.replaceState(null, '', `/watch-movie.html?id=${encodeURIComponent(id)}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [series]);

  // Parse episodes array safely
  const episodes = useMemo(() => {
    if (!series) return [];
    if (Array.isArray(series.episodes)) return series.episodes;
    if (typeof series.episodes === 'string') {
      try {
        return JSON.parse(series.episodes);
      } catch {
        return [];
      }
    }
    return [];
  }, [series]);

  // Detect available seasons
  const seasons = useMemo(() => {
    const sSet = new Set(episodes.map(e => Number(e.seasonNumber) || 1));
    sSet.add(1);
    return Array.from(sSet).sort((a, b) => a - b);
  }, [episodes]);

  const [selectedSeason, setSelectedSeason] = useState(1);

  // Filter episodes by selected season
  const seasonEpisodes = useMemo(() => {
    return episodes
      .filter(e => (Number(e.seasonNumber) || 1) === selectedSeason)
      .sort((a, b) => (Number(a.episodeNumber) || 0) - (Number(b.episodeNumber) || 0));
  }, [episodes, selectedSeason]);

  // Record history on open
  useEffect(() => {
    if (series) {
      recordHistory(series);
    }
  }, [series, recordHistory]);

  if (!seriesId) {
    return (
      <div className="not-box">
        <i className="fa-solid fa-circle-exclamation"></i>
        <p className="note">
          No series selected. Go back to <a href="/home" onClick={(e) => { e.preventDefault(); window.history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }} style={{ color: 'var(--accent)' }}>Home</a>.
        </p>
      </div>
    );
  }

  if (!series) {
    return (
      <div className="not-box">
        <i className="fa-solid fa-circle-exclamation"></i>
        <p className="note">
          Series not found. Go back to <a href="/home" onClick={(e) => { e.preventDefault(); window.history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }} style={{ color: 'var(--accent)' }}>Home</a>.
        </p>
      </div>
    );
  }

  const isFavorite = favorites.some(fav => String(fav.movieId) === String(series.id));
  const isComingSoon = series.status && series.status.toLowerCase() === 'coming soon';

  const handleFavoriteClick = () => toggleFavorite(series);

  const handleShareClick = () => {
    const message =
      `VIP Movies - Watch Free Tamil & Hollywood Series 🎬\n\n` +
      `Watch ${series.title} (${series.year}) on VIP Movies!\n\n` +
      `Play Store:\nhttps://play.google.com/store/apps/details?id=com.vipmovies.tvkmovies`;
    if (navigator.share) {
      navigator.share({ text: message }).catch(() => {});
    } else {
      window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank");
    }
  };

  /**
   * Navigate to separate player page with native ad trigger (?reward= query)
   * Supports Android WebView interception (shouldOverrideUrlLoading) and SPA routing.
   */
  const handlePlayEpisode = (episode, quality = 'auto') => {
    const sId = series.id || series.movieId;
    const epId = episode?.episodeId;
    const playerUrl = `/player?reward=${encodeURIComponent(sId)}&ep=${encodeURIComponent(epId)}&quality=${encodeURIComponent(quality)}`;

    const isAndroid = typeof window !== 'undefined' && (
      window.Android !== undefined ||
      window.androidBridge !== undefined ||
      window.location.search.includes('source=app') ||
      (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('wv'))
    );

    if (isAndroid) {
      window.location.href = playerUrl;
    } else {
      window.history.pushState(null, '', playerUrl);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const posterSrc = getSeriesImageUrl(series);

  return (
    <>
      {/* Coming Soon Overlay */}
      {isComingSoon && (
        <div className="coming-soon-overlay">
          <div className="coming-soon-box">
            <i className="fa-solid fa-lock" style={{ fontSize: '48px', color: 'var(--accent)', marginBottom: '16px' }}></i>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Coming Soon</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              This series is not yet available for streaming.
            </p>
            <a href="/home" onClick={(e) => { e.preventDefault(); window.history.pushState(null, '', '/home'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="cs-home-btn">
              <i className="fa-solid fa-house"></i> Back to Home
            </a>
          </div>
        </div>
      )}

      <div style={isComingSoon ? { opacity: 0.5, filter: 'grayscale(40%)', pointerEvents: 'none', userSelect: 'none' } : {}}>

        {/* ── TOP BAR: WhatsApp share (left) + Favorite button (right) ── */}
        <div className="watch-topbar">
          <button className="btn-whatsapp-share" onClick={handleShareClick}>
            <i className="fa-brands fa-whatsapp"></i> Share on WhatsApp
          </button>

          <button
            id="favBtn"
            className={`btn-fav-watch${isFavorite ? ' active' : ''}`}
            onClick={handleFavoriteClick}
          >
            <i className={isFavorite ? 'fa-solid fa-heart' : 'fa-regular fa-heart'} id="favIcon"></i>
            <span id="favLabel">{isFavorite ? 'Saved' : 'Favorite'}</span>
          </button>
        </div>

        {/* ── POSTER: centered and big ── */}
        <div className="watch-poster-wrap">
          <img
            id="image"
            className="watch-poster"
            src={posterSrc}
            alt={series.title}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>

        {/* ── TITLE & FORMAT BADGE ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 className="movie-title" id="title" style={{ margin: 0 }}>{series.title}</h1>
          <span style={{
            background: 'rgba(229, 9, 20, 0.18)',
            color: 'var(--accent)',
            border: '1px solid rgba(229, 9, 20, 0.4)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <i className="fa-solid fa-tv"></i> SERIES
          </span>
        </div>

        {/* ── META GRID ── */}
        <div className="meta-grid">
          <div className="meta-item">
            <span className="meta-label"><i className="fa-solid fa-language"></i> Language:</span>
            <span id="language"> {series.language || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label"><i className="fa-regular fa-calendar-days"></i> Release:</span>
            <span id="release"> {series.release || '-'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label"><i className="fa-solid fa-list-ol"></i> Total Episodes:</span>
            <span> {episodes.length} Episodes</span>
          </div>
          <div className="meta-item">
            <span className="meta-label"><i className="fa-solid fa-clapperboard"></i> Director:</span>
            <span id="director"> {series.director || '-'}</span>
          </div>
        </div>

        {/* Starring full-width */}
        <div className="meta-item meta-item-full">
          <span className="meta-label"><i className="fa-solid fa-users"></i> Starring:</span>
          <span id="starring"> {series.starring || '-'}</span>
        </div>

        {/* ── STORYLINE ── */}
        <div className="story-container">
          <h3 className="story-title"><i className="fa-solid fa-book-open"></i> Storyline / Overview</h3>
          <p className="story-text" id="story">{series.story || 'No description available for this series.'}</p>
        </div>

        {/* ── EPISODES PLAYLIST SECTION ── */}
        <div className="quality-box" style={{ marginTop: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <h3 className="quality-header" style={{ margin: 0 }}>
              <i className="fa-solid fa-list-ul"></i> Episodes &amp; Seasons ({episodes.length})
            </h3>

            {/* Season Selector Tabs */}
            {seasons.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                {seasons.map(s => {
                  const sCount = episodes.filter(e => (Number(e.seasonNumber) || 1) === s).length;
                  const isCur = selectedSeason === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSeason(s)}
                      style={{
                        background: isCur ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                        color: isCur ? '#000' : '#fff',
                        border: '1px solid ' + (isCur ? 'var(--accent)' : 'rgba(255,255,255,0.1)'),
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Season {s}
                      <span style={{ fontSize: '10px', opacity: 0.8 }}>({sCount})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Empty Episodes Message */}
          {seasonEpisodes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              <i className="fa-solid fa-tv" style={{ fontSize: '32px', color: 'var(--text-secondary)', marginBottom: '10px' }}></i>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                No episodes currently available for Season {selectedSeason}. Check back soon!
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {seasonEpisodes.map((ep) => (
                <EpisodeRow
                  key={ep.episodeId}
                  ep={ep}
                  series={series}
                  onPlay={handlePlayEpisode}
                />
              ))}
            </div>
          )}

        </div>

      </div>
    </>
  );
}
