import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';

export default function HomeView() {
  const { movies, slider } = useApp();
  const [slideIndex, setSlideIndex] = useState(0);

  // Slider autoplay transition
  useEffect(() => {
    if (!slider || slider.length === 0) return;
    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slider.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [slider]);

  // Filter Tamil movies for 2026 and status active
  const tamilMovies = movies
    .filter(m => String(m.type).toLowerCase() === 'tamil' && String(m.year) === '2026' && String(m.status).toLowerCase() === 'active')
    .slice(0, 10);

  // Filter Hollywood movies for 2026 and status active
  const hollywoodMovies = movies
    .filter(m => String(m.type).toLowerCase() === 'hollywood' && String(m.year) === '2026' && String(m.status).toLowerCase() === 'active')
    .slice(0, 10);

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
    window.location.hash = `#/list?type=${type}&year=${year}`;
  };

  return (
    <>
      {/* Slider */}
      {slider && slider.length > 0 && (
        <div id="slider">
          <div id="slidesContainer">
            {slider.map((item, i) => (
              <a 
                key={item.id || i} 
                href={item.url}
              >
                <div className="slides" style={{ display: i === slideIndex ? 'block' : 'none' }}>
                  <img className="imggg" src={item.image} alt="Slide" />
                </div>
              </a>
            ))}
          </div>
          <div id="dot">
            {slider.map((_, i) => (
              <span 
                key={i} 
                className={`dot ${i === slideIndex ? 'active' : ''}`}
                onClick={() => setSlideIndex(i)}
              ></span>
            ))}
          </div>
        </div>
      )}

      {/* Years Collection */}
      <div className="info">
        <h1 className="info-head">Years Collection</h1>
        <h1 className="info-all" onClick={() => window.location.hash = '#/years'}>
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
          <a key={movie.id} href={`#/watch?reward=${movie.id}`} className="movie-card-link">
            <div className="movie-card">
              <div className="movie-card-img-wrapper">
                <img 
                  className="movie-card-img" 
                  src={getImageUrl(movie)} 
                  alt={movie.title} 
                  loading="lazy"
                />
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
          <a key={movie.id} href={`#/watch?reward=${movie.id}`} className="movie-card-link">
            <div className="movie-card">
              <div className="movie-card-img-wrapper">
                <img 
                  className="movie-card-img" 
                  src={getImageUrl(movie)} 
                  alt={movie.title} 
                  loading="lazy"
                />
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
