import React, { useState, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { KeyboardShortcutsModal } from '../common/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { getLocalMovies, getRecycleBin } from '../../api/moviesApi';
import { useNavigate } from 'react-router-dom';

export function AdminLayout({ children, onNewMovie }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  // Compute counts from local store for sidebar badges
  const allMovies = getLocalMovies();
  const bin = getRecycleBin();
  const movieCounts = {
    total: allMovies.length,
    tamil: allMovies.filter(m => m.language?.toLowerCase() === 'tamil').length,
    hollywood: allMovies.filter(m => m.type?.toLowerCase() === 'hollywood').length,
    comingSoon: allMovies.filter(m => m.status?.toLowerCase() === 'coming soon').length,
    trash: bin.length,
    broken: 0
  };

  useKeyboardShortcuts({
    onNewMovie,
    onSearch: () => searchRef.current?.focus(),
    onShowHelp: () => setShortcutsOpen(v => !v),
    onEscape: () => setShortcutsOpen(false)
  });

  return (
    <div className="flex min-h-screen bg-[#0b0b0b]">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        movieCounts={movieCounts}
      />

      {/* Mobile overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Main Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <Header
          onNewMovie={onNewMovie}
          onToggleShortcuts={() => setShortcutsOpen(v => !v)}
          searchRef={searchRef}
        />
        <main className="flex-1 p-5 overflow-x-hidden">
          {children}
        </main>
      </div>

      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
