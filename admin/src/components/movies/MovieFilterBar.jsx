import React from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';

export function MovieFilterBar({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  movies = [],
  onClearAll
}) {
  const hasActiveFilters = searchQuery || Object.values(filters).some(v => v);

  // Derive unique values from movie data
  const languages = [...new Set(movies.map(m => m.language).filter(Boolean))].sort();
  const years = [...new Set(movies.map(m => String(m.year)).filter(Boolean))].sort((a, b) => b - a);
  const statuses = [...new Set(movies.map(m => m.status).filter(Boolean))].sort();
  const types = [...new Set(movies.map(m => m.type).filter(Boolean))].sort();

  const FilterSelect = ({ id, label, value, options, onChange }) => (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-zinc-900/70 border rounded-xl pl-3 pr-8 py-2 text-sm focus:outline-none transition-all appearance-none cursor-pointer ${
          value
            ? 'border-red-600/60 text-zinc-200 bg-red-950/20'
            : 'border-zinc-800/70 text-zinc-500'
        }`}
      >
        <option value="">{label}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
    </div>
  );

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="flex-1 min-w-52 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search title, director, actor, ID…"
          className="w-full bg-zinc-900/70 border border-zinc-800/70 text-zinc-200 placeholder-zinc-600 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-red-600/70 focus:bg-zinc-900 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Dropdowns */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-zinc-500 shrink-0" />
        <FilterSelect
          id="filter-language"
          label="Language"
          value={filters.language}
          options={languages}
          onChange={(v) => onFilterChange({ ...filters, language: v })}
        />
        <FilterSelect
          id="filter-year"
          label="Year"
          value={filters.year}
          options={years}
          onChange={(v) => onFilterChange({ ...filters, year: v })}
        />
        <FilterSelect
          id="filter-status"
          label="Status"
          value={filters.status}
          options={statuses}
          onChange={(v) => onFilterChange({ ...filters, status: v })}
        />
        <FilterSelect
          id="filter-type"
          label="Type"
          value={filters.type}
          options={types}
          onChange={(v) => onFilterChange({ ...filters, type: v })}
        />

        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-xl border border-red-800/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
