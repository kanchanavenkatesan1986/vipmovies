import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/layout/AdminLayout';
import { cacheManager } from '../services/cacheManager';
import { VALID_TABLES, dbToDisplayType } from '../utils/tableMapper';
import MovieFormModal from '../components/movies/MovieFormModal';
import SlideFormModal from '../components/slides/SlideFormModal';
import { movieApi } from '../services/movieApi';
import { slideApi } from '../services/slideApi';
import { showToast } from '../components/common/ToastContainer';

export default function DashboardPage({ navigateTo }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMovies: 0,
    tamilMovies: 0,
    hollywoodMovies: 0,
    totalSlides: 0
  });

  const [recentMovies, setRecentMovies] = useState([]);
  const [isMovieModalOpen, setIsMovieModalOpen] = useState(false);
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDashboardData = async (force = false) => {
    setLoading(true);
    try {
      let tCount = 0;
      let hCount = 0;
      let allFetchedMovies = [];

      // Fetch all 6 movie tables
      for (const table of VALID_TABLES) {
        if (table === 'slider') continue;
        try {
          const records = await cacheManager.getTable(table, force);
          const count = records.length;
          if (table.startsWith('tamil_')) {
            tCount += count;
          } else if (table.startsWith('hollywood_')) {
            hCount += count;
          }
          allFetchedMovies = allFetchedMovies.concat(records);
        } catch (e) {
          console.error(`Failed to load table ${table}:`, e);
        }
      }

      // Fetch slides table
      let sCount = 0;
      try {
        const slides = await cacheManager.getTable('slider', force);
        sCount = slides.length;
      } catch (e) {
        console.error('Failed to load slider table:', e);
      }

      setStats({
        totalMovies: tCount + hCount,
        tamilMovies: tCount,
        hollywoodMovies: hCount,
        totalSlides: sCount
      });

      // Sort recent movies by date / ID
      const sorted = [...allFetchedMovies].sort((a, b) => {
        const dateA = a.created_at || '';
        const dateB = b.created_at || '';
        return dateB.localeCompare(dateA);
      }).slice(0, 8);

      setRecentMovies(sorted);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(false);
  }, []);

  const handleCreateMovie = async (movieData, targetTable) => {
    setActionLoading(true);
    try {
      await movieApi.createMovie(targetTable, movieData);
      showToast(`🎬 Movie "${movieData.title}" created successfully in ${targetTable}!`);
      setIsMovieModalOpen(false);
      fetchDashboardData(false);
    } catch (err) {
      showToast(err.message || 'Failed to create movie', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSlide = async (slideData) => {
    setActionLoading(true);
    try {
      await slideApi.createSlide(slideData);
      showToast('🖼️ Slide created successfully!');
      setIsSlideModalOpen(false);
      fetchDashboardData(false);
    } catch (err) {
      showToast(err.message || 'Failed to create slide', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout
      currentRoute="dashboard"
      navigateTo={navigateTo}
      pageTitle="CMS Dashboard"
      breadcrumb="Dashboard"
      onRefresh={() => fetchDashboardData(true)}
    >
      {/* Top Banner Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#fff', margin: 0 }}>Overview & Analytics</h1>
          <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '4px 0 0 0' }}>
            Real-time movie counts and catalog management
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="admin-btn primary" onClick={() => setIsMovieModalOpen(true)}>
            <i className="fa-solid fa-circle-plus"></i> Add Movie
          </button>
          <button className="admin-btn" onClick={() => setIsSlideModalOpen(true)}>
            <i className="fa-solid fa-images"></i> Add Slide
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon">
            <i className="fa-solid fa-film"></i>
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Movies</span>
            <span className="admin-stat-number">{loading ? '...' : stats.totalMovies}</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon red">
            <i className="fa-solid fa-globe"></i>
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Tamil Movies</span>
            <span className="admin-stat-number">{loading ? '...' : stats.tamilMovies}</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <i className="fa-solid fa-clapperboard"></i>
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Hollywood Movies</span>
            <span className="admin-stat-number">{loading ? '...' : stats.hollywoodMovies}</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <i className="fa-solid fa-images"></i>
          </div>
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Slides</span>
            <span className="admin-stat-number">{loading ? '...' : stats.totalSlides}</span>
          </div>
        </div>
      </div>

      {/* Recently Created Movies Section */}
      <div className="admin-glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--admin-accent)', fontSize: '18px' }}></i>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#fff', margin: 0 }}>Recently Added Movies</h3>
          </div>
          <button className="admin-btn" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => navigateTo('admin/movies')}>
            View All Movies <i className="fa-solid fa-chevron-right" style={{ fontSize: '10px' }}></i>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '12px' }}></i>
            <p>Loading API Database records...</p>
          </div>
        ) : recentMovies.length > 0 ? (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Poster</th>
                  <th>Movie ID</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {recentMovies.map(movie => {
                  const isComingSoon = String(movie.status || '').toLowerCase() === 'coming soon';
                  const posterUrl = movie.image?.startsWith('http')
                    ? movie.image
                    : `/src/images/${movie.type}/${movie.year}/${movie.image}`;

                  return (
                    <tr key={movie.id}>
                      <td>
                        <img
                          src={posterUrl}
                          alt={movie.title}
                          className="admin-poster-thumb"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--admin-accent)' }}>
                        {movie.id}
                      </td>
                      <td style={{ fontWeight: 700, color: '#fff' }}>
                        {movie.title}
                      </td>
                      <td>{dbToDisplayType(movie.type)}</td>
                      <td>{movie.year || '-'}</td>
                      <td>
                        <span className={`admin-badge ${isComingSoon ? 'comingsoon' : 'active'}`}>
                          {isComingSoon ? 'Coming Soon' : 'Active'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--admin-text-dim)' }}>{movie.created_at || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
            No movie records found.
          </div>
        )}
      </div>

      {/* Add Movie Modal */}
      <MovieFormModal
        isOpen={isMovieModalOpen}
        mode="create"
        onSave={handleCreateMovie}
        onCancel={() => setIsMovieModalOpen(false)}
        loading={actionLoading}
      />

      {/* Add Slide Modal */}
      <SlideFormModal
        isOpen={isSlideModalOpen}
        mode="create"
        onSave={handleCreateSlide}
        onCancel={() => setIsSlideModalOpen(false)}
        loading={actionLoading}
      />

    </AdminLayout>
  );
}
