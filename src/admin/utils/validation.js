export function validateMovieData(data) {
  const errors = {};

  if (!data.title || !String(data.title).trim()) {
    errors.title = 'Title is required.';
  }

  if (!data.type) {
    errors.type = 'Movie Type (Tamil/Hollywood) is required.';
  }

  if (!data.year || !['2024', '2025', '2026'].includes(String(data.year).trim())) {
    errors.year = 'Year must be 2024, 2025, or 2026.';
  }

  if (!data.category || !String(data.category).trim()) {
    errors.category = 'Category is required.';
  }

  if (!data.language || !String(data.language).trim()) {
    errors.language = 'Language is required.';
  }

  // Validate URL format or relative storage path for video sources if provided
  const isValidUrlOrPath = (val) => {
    if (!val || typeof val !== 'string' || !val.trim() || val.trim() === '#') return true;
    const s = val.trim();
    if (/^https?:\/\//i.test(s)) {
      try {
        new URL(s);
        return true;
      } catch {
        return false;
      }
    }
    // Relative storage path: e.g. "hollywood/2026/slug/file.mp4"
    return !/[<>:"|*]/.test(s) && s.length >= 3;
  };

  const isSeries = data.contentType === 'series';

  if (!isSeries) {
    if (data.p360 && !isValidUrlOrPath(data.p360)) {
      errors.p360 = 'Invalid URL or storage path format for 360p link.';
    }
    if (data.p720 && !isValidUrlOrPath(data.p720)) {
      errors.p720 = 'Invalid URL or storage path format for 720p link.';
    }
    if (data.p1080 && !isValidUrlOrPath(data.p1080)) {
      errors.p1080 = 'Invalid URL or storage path format for 1080p link.';
    }
  } else {
    // For series, episodes can be checked
    if (Array.isArray(data.episodes)) {
      data.episodes.forEach((ep, idx) => {
        if (ep.clickurl && !isValidUrlOrPath(ep.clickurl)) {
          errors.episodes = `Invalid URL or storage path format in Episode #${ep.episodeNumber || idx + 1}`;
        }
      });
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateSlideData(data) {
  const errors = {};

  if (!data.title || !String(data.title).trim()) {
    errors.title = 'Slide title is required.';
  }

  if (!data.image || !String(data.image).trim()) {
    errors.image = 'Slide image URL is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
