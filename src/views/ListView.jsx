import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';

const PAGE_SIZE = 20;

function getImageUrl(movie) {
  if (!movie) return '';
  const img = movie.image || '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  const type = (movie.type || '').toLowerCase();
  const year = movie.year || '';
  if (img && type && year) return `/src/images/${type}/${year}/${img}`;
  return img;
}

export default function ListView({ type = '', year = '' }) {
  const { movies } = useApp();
  const [page, setPage] = useState(1);

  const normType = type.toLowerCase().trim();
  const normYear = year.trim();

  // Filter movies matching type and year
  const filteredMovies = movies.filter(m => {
    const matchType = !normType || String(m.type).toLowerCase().trim() === normType;
    const matchYear = !normYear || String(m.year).trim() === normYear;
    return matchType && matchYear;
  });

  // Sort movies: active first, coming soon last
  const sortedMovies = [...filteredMovies].sort((a, b) => {
    const aComing = String(a.status || '').toLowerCase() === 'coming soon' ? 1 : 0;
    const bComing = String(b.status || '').toLowerCase() === 'coming soon' ? 1 : 0;
    return aComing - bComing;
  });

  const totalMovies = sortedMovies.length;
  const totalPages = Math.ceil(totalMovies / PAGE_SIZE);

  // Safe page correction
  const safePage = Math.min(page, Math.max(1, totalPages));

  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalMovies);
  const pageMovies = sortedMovies.slice(startIndex, endIndex);

  // Title calculation
  let pageTitle = "Movies Collection";
  if (normType && normYear) {
    pageTitle = `${normYear} ${normType.charAt(0).toUpperCase() + normType.slice(1)} Movies`;
  }

  const goToPage = (p) => {
    if (p >= 1 && p <= totalPages) {
      setPage(p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const range = 1;
    const numberBtns = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= safePage - range && i <= safePage + range)) {
        if (i === safePage) {
          numberBtns.push(
            <button key={i} className="pag-num-btn active">{i}</button>
          );
        } else {
          numberBtns.push(
            <button key={i} className="pag-num-btn" onClick={() => goToPage(i)}>{i}</button>
          );
        }
      } else if (i === safePage - range - 1 || i === safePage + range + 1) {
        numberBtns.push(
          <span key={`dots-${i}`} className="pag-dots">...</span>
        );
      }
    }

    return (
      <div className="pagination-bar">
        <button 
          className={`pag-btn prev-btn${safePage === 1 ? ' disabled' : ''}`}
          disabled={safePage === 1}
          onClick={() => goToPage(safePage - 1)}
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div className="pag-middle">
          <div className="pag-count">Showing {startIndex + 1} to {endIndex} of {totalMovies} Movies</div>
          <div className="pag-numbers">
            {numberBtns}
          </div>
        </div>
        <button 
          className={`pag-btn next-btn${safePage === totalPages ? ' disabled' : ''}`}
          disabled={safePage === totalPages}
          onClick={() => goToPage(safePage + 1)}
        >
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    );
  };

  return (
    <div className="list-view-container" style={{ width: '100%' }}>
      {/* Dynamic Category Title */}
      <div className="list-header">
        <span id="listTitle">{pageTitle}</span>
        <a href="#/home" className="list-back-btn">
          <i className="fa-solid fa-arrow-left"></i> Back to Home
        </a>
      </div>

      {/* Top Pagination */}
      {renderPagination()}

      {/* Movie Listing Grid */}
      {totalMovies > 0 ? (
        <div id="movieList" className="movies-grid">
          {pageMovies.map(movie => {
            const isComingSoon = String(movie.status || '').toLowerCase().trim() === 'coming soon';
            const displayType = (movie.type || type || '').toLowerCase();
            const normalizedDisplayType = displayType.charAt(0).toUpperCase() + displayType.slice(1);
            return (
              <a 
                key={movie.id} 
                href={`#/watch?reward=${movie.id}`} 
                className="list-card-link"
              >
                <div className={`list-card${isComingSoon ? ' coming-soon' : ''}`}>
                  <div className="list-card-img-wrapper">
                    <img 
                      className="list-card-img" 
                      src={getImageUrl(movie)} 
                      alt={movie.title} 
                      loading="lazy" 
                    />
                    {isComingSoon && <span className="coming-soon-badge">Coming Soon</span>}
                  </div>
                  <div className="list-card-details">
                    <div className="list-card-header">
                      <h3 className="list-card-title">{movie.title}</h3>
                      <span className="list-card-year">{movie.year || year}</span>
                    </div>
                    <p className="list-card-info">Release : {movie.release || '-'}</p>
                    <p className="list-card-info">Language : {movie.language || normalizedDisplayType}</p>
                    <div className="list-card-action">
                      {isComingSoon ? (
                        <><i className="fa-solid fa-lock"></i> Watch Ads - Unlock</>
                      ) : (
                        <>Watch Ads - Unlock <i className="fa-solid fa-arrow-right"></i></>
                      )}
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div id="comingSoon" className="not-box" style={{ display: 'flex' }}>
          <i className="fa-solid fa-hourglass-half" style={{ fontSize: '38px', color: 'var(--accent)', marginBottom: '16px' }}></i>
          <h1 className="note" style={{ lineHeight: '1.6' }}>Please Wait...<br />Coming Soon New Movies!</h1>
        </div>
      )}

      {/* Bottom Pagination */}
      {renderPagination()}
    </div>
  );
}
