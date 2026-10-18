import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../AppContext';

export default function HomeView() {
  const { movies, slider, openMoviePreview } = useApp();
  const [slideIndex, setSlideIndex] = useState(0);

  // Helper to extract numeric ID suffix (e.g. tamil-2026-1 => 1)
  const getMovieNumericOrder = (id) => {
    if (!id) return 0;
    if (typeof window !== 'undefined' && typeof window.getMovieNumber === 'function') {
      const num = window.getMovieNumber(id);
      if (!isNaN(num) && num !== 0) return num;
    }
    const parts = String(id).split(/[-_]/);
    const last = parseInt(parts[parts.length - 1], 10);
    return isNaN(last) ? 0 : last;
  };

  // Slider items strictly sorted by ID ascending
  const sortedSlider = useMemo(() => {
    if (!slider || slider.length === 0) return [];
    return [...slider].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  }, [slider]);

  const [isPaused, setIsPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  // Helper to extract rich slide metadata (matching movie catalog or parsing title)
  const getSlideMeta = (item) => {
    if (!item) return {};
    const title = item.title || '';

    // Check if there is a matching movie in our catalog
    let matchedMovie = null;
    if (movies && movies.length > 0) {
      const normTitle = title.toLowerCase().replace(/[\(\)\[\]]/g, '').trim();
      matchedMovie = movies.find(m => {
        if (!m) return false;
        if (item.url && (item.url.includes(String(m.id)) || item.url.includes(encodeURIComponent(m.id)))) return true;
        const mTitle = (m.title || '').toLowerCase().trim();
        return mTitle && (normTitle.includes(mTitle) || mTitle.includes(normTitle));
      });
    }

    // Extract year: from matchedMovie, or 4 consecutive digits in title (e.g. 2024, 2025, 2026), or default
    let year = matchedMovie?.year;
    if (!year) {
      const match = title.match(/\b(19\d\d|20\d\d)\b/);
      if (match) year = match[1];
    }
    if (!year) year = '2026';

    const displayTitle = title || matchedMovie?.title || 'Featured Premiere';
    const category = matchedMovie?.category || (matchedMovie?.type ? `${matchedMovie.type.toUpperCase()}` : 'Blockbuster');
    const quality = matchedMovie?.quality || '4K UHD';

    // Image fallback resolution: if jeetwinnews or broken, fallback to TMDB working banner
    let imageUrl = item.image || '';
    if (!imageUrl || imageUrl.includes('jeetwinnews.com')) {
      imageUrl = 'https://image.tmdb.org/t/p/original/14QbnygCuTO0vl7CAFmPf1fgZfV.jpg';
    }

    return {
      title: displayTitle,
      year,
      category,
      quality,
      image: imageUrl,
      matchedMovie,
      url: item.url || (matchedMovie ? `/watch?reward=${matchedMovie.id}` : '#')
    };
  };

  // Next / Prev slide handlers with manual wrap-around
  const handleNext = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!sortedSlider || sortedSlider.length === 0) return;
    setSlideIndex((prev) => (prev + 1) % sortedSlider.length);
  };

  const handlePrev = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!sortedSlider || sortedSlider.length === 0) return;
    setSlideIndex((prev) => (prev - 1 + sortedSlider.length) % sortedSlider.length);
  };

  // Slider autoplay transition (4.5s), pauses on hover
  useEffect(() => {
    if (!sortedSlider || sortedSlider.length <= 1 || isPaused) return;
    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % sortedSlider.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [sortedSlider, isPaused, slideIndex]);

  // Touch swipe support for mobile
  const handleTouchStart = (e) => {
    if (e.touches && e.touches[0]) {
      setTouchStartX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null || !e.changedTouches || !e.changedTouches[0]) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    setTouchStartX(null);
  };

  const handleSlideActionClick = (e, meta) => {
    e.preventDefault();
    e.stopPropagation();
    if (meta.matchedMovie && typeof openMoviePreview === 'function') {
      openMoviePreview(meta.matchedMovie);
      return;
    }
    if (meta.url && meta.url !== '#') {
      if (meta.url.startsWith('http://') || meta.url.startsWith('https://')) {
        window.open(meta.url, '_blank', 'noopener,noreferrer');
      } else {
        window.history.pushState(null, '', meta.url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
  };


  // Filter Tamil movies for 2026 and status active, sorted by ID order ascending
  const tamilMovies = useMemo(() => {
    return (movies || [])
      .filter(m => String(m.type).toLowerCase() === 'tamil' && String(m.year) === '2026' && String(m.status).toLowerCase() === 'active')
      .sort((a, b) => getMovieNumericOrder(a.id) - getMovieNumericOrder(b.id))
      .slice(0, 10);
  }, [movies]);

  // Filter Hollywood movies for 2026 and status active, sorted by ID order ascending
  const hollywoodMovies = useMemo(() => {
    return (movies || [])
      .filter(m => String(m.type).toLowerCase() === 'hollywood' && String(m.year) === '2026' && String(m.status).toLowerCase() === 'active')
      .sort((a, b) => getMovieNumericOrder(a.id) - getMovieNumericOrder(b.id))
      .slice(0, 10);
  }, [movies]);

  const getImageUrl = (movie) => {
    if (!movie) return '';
    const img = movie.image || '';
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    const type = (movie.type || '').toLowerCase();
    const year = movie.year || '';
    if (img && type && year) return `/src/images/${type}/${year}/${img}`;
    return img;
  };

  const handleFilterClick = (type, year) => {
    window.history.pushState(null, '', `/list?type=${type}&year=${year}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <>
      {/* Premium Cinematic Slider */}
      {sortedSlider && sortedSlider.length > 0 && (
        <div
          id="slider"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Autoplay Countdown Progress Bar */}
          <div className="slider-progress-track">
            <div
              key={slideIndex}
              className={`slider-progress-bar ${isPaused ? 'paused' : ''}`}
            ></div>
          </div>

          {/* Left Arrow Button (Manual Left Click) */}
          {sortedSlider.length > 1 && (
            <button
              type="button"
              className="slider-arrow slider-arrow-left"
              onClick={handlePrev}
              aria-label="Previous slide"
              title="Previous slide"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
          )}

          {/* Right Arrow Button (Manual Right Click) */}
          {sortedSlider.length > 1 && (
            <button
              type="button"
              className="slider-arrow slider-arrow-right"
              onClick={handleNext}
              aria-label="Next slide"
              title="Next slide"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          )}

          {/* Slides Container */}
          <div id="slidesContainer">
            {sortedSlider.map((item, i) => {
              const meta = getSlideMeta(item);
              const isActive = i === slideIndex;

              return (
                <div
                  key={item.id || i}
                  className={`slides ${isActive ? 'active' : ''}`}
                >
                  <a
                    href={meta.url}
                    onClick={(e) => {
                      if (meta.matchedMovie && typeof openMoviePreview === 'function') {
                        e.preventDefault();
                        openMoviePreview(meta.matchedMovie);
                      }
                    }}
                  >
                    <img
                      className="imggg"
                      src={meta.image || item.image}
                      alt={meta.title}
                      referrerPolicy="no-referrer"
                      loading="eager"
                      onError={(e) => {
                        if (e.target.src !== 'https://image.tmdb.org/t/p/original/14QbnygCuTO0vl7CAFmPf1fgZfV.jpg') {
                          e.target.src = 'https://image.tmdb.org/t/p/original/14QbnygCuTO0vl7CAFmPf1fgZfV.jpg';
                        }
                      }}
                    />

                    {/* Bottom Black Shadow Overlay */}
                    <div className="slider-shadow-overlay"></div>

                    {/* Content Area: Title, then Watch + Year Badge inline */}
                    <div className="slider-content">
                      <h2 className="slider-title">{meta.title}</h2>
                      <div className="slider-actions">
                        <button
                          type="button"
                          className="slider-btn-play"
                          onClick={(e) => handleSlideActionClick(e, meta)}
                        >
                          <i className="fa-solid fa-play"></i> Watch
                        </button>
                        {meta.year && (
                          <span className="slider-year-badge">
                            <i className="fa-solid fa-calendar-days"></i> {meta.year}
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                </div>
              );
            })}
          </div>

          {/* Glassmorphic Dot Indicators */}
          <div id="dot">
            {sortedSlider.map((_, i) => (
              <span
                key={i}
                className={`dot ${i === slideIndex ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSlideIndex(i);
                }}
                title={`Go to slide ${i + 1}`}
              ></span>
            ))}
          </div>
        </div>
      )}

      {/* Years Collection */}
      <div className="info">
        <h1 className="info-head">Years Collection</h1>
        <h1 className="info-all" onClick={() => { window.history.pushState(null, '', '/years'); window.dispatchEvent(new PopStateEvent('popstate')); }}>
          View All <i className="fa-solid fa-chevron-right" style={{ fontSize: '11px' }}></i>
        </h1>
      </div>
      <div className="chips-scroll">
        <a className="chip-btn" onClick={() => handleFilterClick('tamil', '2026')}>
          <i className="fa-solid fa-calendar-days"></i> 2026 Tamil
        </a>
        <a className="chip-btn" onClick={() => handleFilterClick('tamil', '2025')}>
          <i className="fa-solid fa-calendar-days"></i> 2025 Tamil
        </a>
        <a className="chip-btn" onClick={() => handleFilterClick('tamil', '2024')}>
          <i className="fa-solid fa-calendar-days"></i> 2024 Tamil
        </a>
        <a className="chip-btn" onClick={() => handleFilterClick('hollywood', '2026')}>
          <i className="fa-solid fa-film"></i> 2026 Hollywood
        </a>
        <a className="chip-btn" onClick={() => handleFilterClick('hollywood', '2025')}>
          <i className="fa-solid fa-film"></i> 2025 Hollywood
        </a>
        <a className="chip-btn" onClick={() => handleFilterClick('hollywood', '2024')}>
          <i className="fa-solid fa-film"></i> 2024 Hollywood
        </a>
      </div>

      {/* Tamil Movies */}
      <div className="info">
        <h1 className="info-head">Tamil Movies</h1>
        <h1 className="info-all" onClick={() => handleFilterClick('tamil', '2026')}>
          View All <i className="fa-solid fa-chevron-right" style={{ fontSize: '11px' }}></i>
        </h1>
      </div>
      <div className="movie-scroll" id="tamilMovies">
        {tamilMovies.map((movie) => (
          <a key={movie.id} href={`/watch?reward=${movie.id}`} onClick={(e) => { e.preventDefault(); openMoviePreview(movie); }} className="movie-card-link">
            <div className="movie-card">
              <div className="movie-card-img-wrapper">
                <img 
                  className="movie-card-img" 
                  src={getImageUrl(movie)} 
                  alt={movie.title} 
                  loading="lazy"
                />
                {movie.year && (
                  <span className="movie-card-year-badge">
                    {movie.year}
                  </span>
                )}
                <div className="movie-card-overlay">
                  <div className="movie-card-play-btn">
                    <i className="fa-solid fa-play"></i>
                  </div>
                </div>
              </div>
              <h1 className="movie-card-title">{movie.title}</h1>
            </div>
          </a>
        ))}
        {tamilMovies.length > 0 && (
          <div className="view-all-card" onClick={() => handleFilterClick('tamil', '2026')}>
            <div className="view-all-icon"><i className="fa-solid fa-arrow-right"></i></div>
            <div className="view-all-text">View All</div>
          </div>
        )}
      </div>

      {/* Hollywood Movies */}
      <div className="info">
        <h1 className="info-head">Hollywood Movies</h1>
        <h1 className="info-all" onClick={() => handleFilterClick('hollywood', '2026')}>
          View All <i className="fa-solid fa-chevron-right" style={{ fontSize: '11px' }}></i>
        </h1>
      </div>
      <div className="movie-scroll" id="hollywoodMovies">
        {hollywoodMovies.map((movie) => (
          <a key={movie.id} href={`/watch?reward=${movie.id}`} onClick={(e) => { e.preventDefault(); openMoviePreview(movie); }} className="movie-card-link">
            <div className="movie-card">
              <div className="movie-card-img-wrapper">
                <img 
                  className="movie-card-img" 
                  src={getImageUrl(movie)} 
                  alt={movie.title} 
                  loading="lazy"
                />
                {movie.year && (
                  <span className="movie-card-year-badge">
                    {movie.year}
                  </span>
                )}
                <div className="movie-card-overlay">
                  <div className="movie-card-play-btn">
                    <i className="fa-solid fa-play"></i>
                  </div>
                </div>
              </div>
              <h1 className="movie-card-title">{movie.title}</h1>
            </div>
          </a>
        ))}
        {hollywoodMovies.length > 0 && (
          <div className="view-all-card" onClick={() => handleFilterClick('hollywood', '2026')}>
            <div className="view-all-icon"><i className="fa-solid fa-arrow-right"></i></div>
            <div className="view-all-text">View All</div>
          </div>
        )}
      </div>
    </>
  );
}
