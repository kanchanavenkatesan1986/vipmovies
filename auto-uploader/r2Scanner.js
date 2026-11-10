/**
 * R2 Storage Scanner & Link Resolver
 * Directly scans Cloudflare R2 bucket folders to extract exact video files,
 * resolution qualities (360p/720p/1080p), and series episode chains.
 */

const MEDIA_BASE = 'https://api-download.akatsuki-pvt-ltd.workers.dev';

function generateEpisodeId(seasonNum, epNum) {
  const sStr = String(seasonNum || 1).padStart(2, '0');
  const eStr = String(epNum || 1).padStart(3, '0');
  const rand = Math.random().toString(36).substring(2, 6);
  return `ep-s${sStr}e${eStr}-${rand}`;
}

/**
 * Scan a single folder in R2 and extract video sources
 * @param {R2Client} r2 
 * @param {string} folderPrefix e.g. "hollywood/2026/run-away/"
 * @param {string} urlMode 'path' (relative file path only) or 'cdn' (full URL)
 * @param {boolean} isSeries 
 * @param {string} folderSlug
 */
async function inspectR2Folder(r2, folderPrefix, urlMode = 'path', isSeries = false, folderSlug = '') {
  try {
    const cleanPrefix = folderPrefix.endsWith('/') ? folderPrefix : `${folderPrefix}/`;
    const res = await r2.listObjects(cleanPrefix);
    if (!res || !res.objects) return null;

    const videoObjects = res.objects.filter(o => o.isVideo || (o.extension && o.extension.toLowerCase() === '.mp4'));
    if (videoObjects.length === 0) return null;

    const getUrl = (key) => urlMode === 'cdn' ? `${MEDIA_BASE}/${key}` : key;

    if (isSeries || videoObjects.some(v => /s\d+\s*e\d+|epi?\s*\d+/i.test(v.filename))) {
      // Process as Series
      const episodes = videoObjects.map((obj, idx) => {
        const epMatch = obj.filename.match(/(?:epi?|e)\s*(\d+)/i) || [null, idx + 1];
        const epNum = parseInt(epMatch[1], 10) || (idx + 1);

        const seasonMatch = obj.filename.match(/(?:season|s)\s*(\d+)/i) || [null, 1];
        const seasonNum = parseInt(seasonMatch[1], 10) || 1;

        return {
          episodeId: generateEpisodeId(seasonNum, epNum),
          seasonNumber: seasonNum,
          episodeNumber: epNum,
          title: `Episode ${epNum}`,
          image: folderSlug ? `${folderSlug}/${epNum}.webp` : `${epNum}.webp`,
          duration: '45m',
          clickurl: getUrl(obj.key),
          rawKey: obj.key,
          filename: obj.filename,
          sizeFormatted: obj.sizeFormatted
        };
      }).sort((a, b) => {
        if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
        return a.episodeNumber - b.episodeNumber;
      });

      return {
        isSeries: true,
        count: episodes.length,
        episodes,
        sources: { p360: '', p720: '', p1080: '' }
      };
    } else {
      // Process as Movie
      const sources = { p360: '', p720: '', p1080: '' };
      const rawKeys = { p360: '', p720: '', p1080: '' };

      videoObjects.forEach(v => {
        const fn = v.filename.toLowerCase();
        if (fn.includes('360p') || fn.includes('480p') || fn.includes('360')) {
          sources.p360 = getUrl(v.key);
          rawKeys.p360 = v.key;
        } else if (fn.includes('720p') || fn.includes('720')) {
          sources.p720 = getUrl(v.key);
          rawKeys.p720 = v.key;
        } else if (fn.includes('1080p') || fn.includes('1080')) {
          sources.p1080 = getUrl(v.key);
          rawKeys.p1080 = v.key;
        } else if (!sources.p720) {
          sources.p720 = getUrl(v.key);
          rawKeys.p720 = v.key;
        }
      });

      return {
        isSeries: false,
        count: videoObjects.length,
        episodes: [],
        sources,
        rawKeys
      };
    }
  } catch (err) {
    console.warn(`[r2Scanner] Error inspecting ${folderPrefix}:`, err.message);
    return null;
  }
}

module.exports = { inspectR2Folder, generateEpisodeId, MEDIA_BASE };
