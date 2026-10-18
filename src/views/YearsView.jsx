import React from 'react';

export default function YearsView() {
  const baseYear = 2022;
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= baseYear; y--) {
    years.push(String(y));
  }

  const handleYearClick = (type, year) => {
    window.history.pushState(null, '', `/list?type=${type}&year=${year}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <>
      {/* Page Hero */}
      <div className="page-hero years-hero">
        <h1><i className="fa-solid fa-calendar-days"></i> Movie Collections</h1>
        <p>Explore Tamil & Hollywood blockbusters by release year</p>
      </div>

      {/* Tamil Movie Collections */}
      <h2 className="category-heading">
        <i className="fa-solid fa-film"></i> Tamil Movie Collections
      </h2>
      <div className="years-grid">
        {years.map(yr => (
          <div
            key={`tamil-${yr}`}
            className="year-card tamil-card"
            onClick={() => handleYearClick('tamil', yr)}
          >
            <div className="year-card-icon">
              <i className="fa-solid fa-calendar-days"></i>
            </div>
            <div className="year-card-content">
              <span className="year-card-title">{yr} Tamil Movies</span>
              <span className="year-card-sub">Browse {yr} Releases</span>
            </div>
            <div className="year-card-arrow">
              <i className="fa-solid fa-arrow-right"></i>
            </div>
          </div>
        ))}
      </div>

      {/* Hollywood Movie Collections */}
      <h2 className="category-heading">
        <i className="fa-solid fa-clapperboard"></i> Hollywood Movie Collections
      </h2>
      <div className="years-grid">
        {years.map(yr => (
          <div
            key={`hollywood-${yr}`}
            className="year-card hollywood-card"
            onClick={() => handleYearClick('hollywood', yr)}
          >
            <div className="year-card-icon">
              <i className="fa-solid fa-film"></i>
            </div>
            <div className="year-card-content">
              <span className="year-card-title">{yr} Hollywood Movies</span>
              <span className="year-card-sub">Browse {yr} Releases</span>
            </div>
            <div className="year-card-arrow">
              <i className="fa-solid fa-arrow-right"></i>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
