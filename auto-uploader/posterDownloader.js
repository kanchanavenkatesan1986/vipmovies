const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = path.resolve(__dirname, '..');

/**
 * Downloads poster and saves locally to both workspace and auto-uploader posters dir
 */
async function downloadAndSavePoster(posterUrl, category, year, cleanTitle) {
  const safeFilename = `${cleanTitle.replace(/[\\/:*?"<>|]/g, '')}.jpg`;

  // Local storage directories
  const localDir1 = path.join(WORKSPACE_ROOT, category.toLowerCase(), String(year));
  const localDir2 = path.join(__dirname, 'posters', category.toLowerCase(), String(year));

  try {
    if (!fs.existsSync(localDir1)) fs.mkdirSync(localDir1, { recursive: true });
    if (!fs.existsSync(localDir2)) fs.mkdirSync(localDir2, { recursive: true });

    const filePath1 = path.join(localDir1, safeFilename);
    const filePath2 = path.join(localDir2, safeFilename);

    if (fs.existsSync(filePath1) && fs.statSync(filePath1).size > 1000) {
      return safeFilename;
    }

    if (!posterUrl || !posterUrl.startsWith('http')) {
      // Create a fallback placeholder image or return filename
      return safeFilename;
    }

    const res = await fetch(posterUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) return safeFilename;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 500) {
      fs.writeFileSync(filePath1, buffer);
      fs.writeFileSync(filePath2, buffer);
      console.log(`[POSTER SAVED] ${category}/${year}/${safeFilename} (${buffer.length} bytes)`);
    }

    return safeFilename;
  } catch (err) {
    console.warn(`[POSTER WARN] Failed to save poster for ${cleanTitle}:`, err.message);
    return safeFilename;
  }
}

module.exports = { downloadAndSavePoster };

