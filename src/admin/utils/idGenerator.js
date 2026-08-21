import { displayToDbType } from './tableMapper';

export function generateNextMovieId(type, year, existingMovies = []) {
  const normType = displayToDbType(type);
  const normYear = String(year || '2026').trim();
  const prefix = `${normType}-${normYear}-`;

  let maxNum = 0;

  if (Array.isArray(existingMovies)) {
    existingMovies.forEach(movie => {
      const id = String(movie.id || '').trim();
      if (id.startsWith(prefix)) {
        const seqStr = id.replace(prefix, '');
        const num = parseInt(seqStr, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      } else {
        // Fallback check for any numeric ending
        const parts = id.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });
  }

  const nextNum = maxNum + 1;
  const seqPadded = String(nextNum).padStart(5, '0');
  const candidateId = `${prefix}${seqPadded}`;

  // Duplicate check
  const exists = existingMovies.some(m => String(m.id).trim() === candidateId);
  if (exists) {
    const fallbackSeq = String(maxNum + 2).padStart(5, '0');
    return `${prefix}${fallbackSeq}`;
  }

  return candidateId;
}
