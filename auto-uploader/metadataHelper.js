/**
 * Metadata Enrichment Helper for Movies & Series
 * Clean title extraction & Wikipedia fallback
 */

function cleanMovieTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\(\d{4}\)/gi, '') // remove (2026), (2025), etc.
    .replace(/\b(2024|2025|2026)\b/gi, '') // remove standalone years
    .replace(/\((original|dvd|hdrip|bdrip|tamil|telugu|dubbed|proper|web-series|season\s*\d+|s0\d+|hq|hdts)\)/gi, '')
    .replace(/tamil\s*dubbed\s*web\s*series/gi, '')
    .replace(/tamil\s*dubbed\s*movie/gi, '')
    .replace(/tamil\s*dubbed\s*movies/gi, '')
    .replace(/tamil\s*dubbed/gi, '')
    .replace(/tamil\s*web\s*series/gi, '')
    .replace(/tamil\s*movie/gi, '')
    .replace(/tamil\s*movies/gi, '')
    .replace(/web\s*series/gi, '')
    .replace(/download/gi, '')
    .replace(/\[\+\]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWikiInfo(cleanTitle) {
  try {
    if (!cleanTitle) return null;

    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanTitle + ' film')}&format=json`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'VIPMoviesEngine/2.0 (contact@akatsuki-pvt-ltd.com)' }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const hits = data.query?.search;
    if (!hits || hits.length === 0) return null;

    const top = hits[0];
    const snippet = (top.snippet || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(top.title)}&format=json`;
    const extRes = await fetch(extractUrl, {
      headers: { 'User-Agent': 'VIPMoviesEngine/2.0' }
    });

    let fullExtract = snippet;
    if (extRes.ok) {
      const extData = await extRes.json();
      const pages = extData.query?.pages || {};
      const firstPage = Object.values(pages)[0];
      if (firstPage && firstPage.extract) {
        fullExtract = firstPage.extract.slice(0, 500).trim();
      }
    }

    let director = '';
    let starring = '';
    let genres = 'Action, Thriller';

    const dirMatch = fullExtract.match(/(?:directed by|directed and written by|creator(?:s)?|created by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    if (dirMatch) director = dirMatch[1].trim();

    const starMatch = fullExtract.match(/(?:starring|stars|featuring)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)*)/i);
    if (starMatch) starring = starMatch[1].trim();

    if (/comedy/i.test(fullExtract)) genres = 'Comedy, Drama';
    else if (/horror/i.test(fullExtract)) genres = 'Horror, Mystery';
    else if (/sci-fi|science fiction/i.test(fullExtract)) genres = 'Sci-Fi, Adventure';
    else if (/romance|romantic/i.test(fullExtract)) genres = 'Romance, Drama';
    else if (/crime|gangster/i.test(fullExtract)) genres = 'Crime, Thriller';
    else if (/animation|animated/i.test(fullExtract)) genres = 'Animation, Adventure';

    return {
      story: fullExtract,
      director,
      starring,
      category: genres
    };
  } catch (err) {
    return null;
  }
}

function formatDate(addedDateStr) {
  if (!addedDateStr) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const parts = addedDateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const yr = parts[2];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (!isNaN(day) && monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${monthNames[monthIdx]} ${yr}`;
    }
  }
  return addedDateStr;
}

async function buildMetadata({ title, year = '2026', category = 'hollywood', language = 'Tamil', isSeries = false, downloadPageInfo = {} }) {
  const cleanTitle = cleanMovieTitle(title);
  const wiki = await fetchWikiInfo(cleanTitle);

  const releaseDate = formatDate(downloadPageInfo.addedDate);
  const duration = downloadPageInfo.duration || (isSeries ? '1 Season' : '01:45:00 min');

  const genres = wiki?.category || (isSeries ? 'Drama, Mystery' : 'Action, Thriller');
  const director = wiki?.director || (isSeries ? 'Executive Producers' : 'Director');
  const starring = wiki?.starring || `${cleanTitle} Cast`;
  const story = wiki?.story || `${cleanTitle} is a ${year} ${language} ${isSeries ? 'series' : 'movie'} full of suspense, drama, and entertainment. Available in high definition stream and download.`;

  const image = `${cleanTitle}.jpg`;

  return {
    cleanTitle,
    release: releaseDate,
    category: genres,
    duration,
    director,
    starring,
    story,
    image,
    created_at: new Date().toISOString().split('T')[0]
  };
}

module.exports = { cleanMovieTitle, buildMetadata, formatDate };
