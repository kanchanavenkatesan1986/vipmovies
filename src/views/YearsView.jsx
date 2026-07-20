import React from 'react';

export default function YearsView() {
  const baseYear = 2022;
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= baseYear; y--) {
    years.push(String(y));
  }

  const handleYearClick = (type, year) => {
    history.pushState(null, '', `/list?type=${type}&year=${year}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <>
      {/* Tamil Movie Collections */}
      <h2 className="category-heading">Tamil Movie Collections</h2>
      <div className="years-grid">
        {years.map(yr => (
          <div
            key={`tamil-${yr}`}
            className="year-card"
            onClick={() => handleYearClick('tamil', yr)}
          >
            <i className="fa-solid fa-calendar-days"></i>
            <span>{yr} Tamil Movies</span>
          </div>
        ))}
      </div>

      {/* Hollywood Movie Collections */}
      <h2 className="category-heading">Hollywood Movie Collections</h2>
      <div className="years-grid">
        {years.map(yr => (
          <div
            key={`hollywood-${yr}`}
            className="year-card"
            onClick={() => handleYearClick('hollywood', yr)}
          >
            <i className="fa-solid fa-film"></i>
            <span>{yr} Hollywood Movies</span>
          </div>
        ))}
      </div>
    </>
  );
}
