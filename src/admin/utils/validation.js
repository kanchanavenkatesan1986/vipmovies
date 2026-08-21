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

  // Validate URL format for video sources if provided
  const isValidUrl = (url) => {
    if (!url || !url.trim()) return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  if (data.p360 && !isValidUrl(data.p360)) {
    errors.p360 = 'Invalid URL format for 360p link.';
  }
  if (data.p720 && !isValidUrl(data.p720)) {
    errors.p720 = 'Invalid URL format for 720p link.';
  }
  if (data.p1080 && !isValidUrl(data.p1080)) {
    errors.p1080 = 'Invalid URL format for 1080p link.';
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
