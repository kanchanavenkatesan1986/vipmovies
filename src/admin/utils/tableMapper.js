// Strict mapping between type & year and D1 table names
export const VALID_TABLES = [
  'tamil_2024',
  'tamil_2025',
  'tamil_2026',
  'hollywood_2024',
  'hollywood_2025',
  'hollywood_2026',
  'slider'
];

export const displayToDbType = (displayType) => {
  if (!displayType) return 'tamil';
  const norm = String(displayType).trim().toLowerCase();
  if (norm === 'hollywood') return 'hollywood';
  return 'tamil';
};

export const dbToDisplayType = (dbType) => {
  if (!dbType) return 'Tamil';
  const norm = String(dbType).trim().toLowerCase();
  if (norm === 'hollywood') return 'Hollywood';
  return 'Tamil';
};

export const getMovieTable = (type, year) => {
  const normType = displayToDbType(type);
  const normYear = String(year || '2026').trim();

  const tableName = `${normType}_${normYear}`;

  if (VALID_TABLES.includes(tableName)) {
    return tableName;
  }

  // Default fallback
  return 'tamil_2026';
};
