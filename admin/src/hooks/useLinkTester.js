import { useState, useCallback } from 'react';

export function useLinkTester() {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState({});

  const testSingleUrl = useCallback(async (url, key = 'url') => {
    if (!url || !url.startsWith('http')) {
      return {
        url,
        status: 'Broken',
        statusCode: 400,
        responseTime: 0,
        contentType: 'Invalid URL',
        working: false,
        error: 'Invalid URL format'
      };
    }

    const startTime = performance.now();
    try {
      // Use HEAD request to test link latency without fetching full video payload
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors', // standard cross-origin test fallback
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      return {
        url,
        status: 'Working',
        statusCode: response.status || 200,
        responseTime: `${duration}ms`,
        contentType: response.headers.get('content-type') || 'video/mp4',
        fileSize: response.headers.get('content-length') ? `${(parseInt(response.headers.get('content-length')) / (1024 * 1024)).toFixed(1)} MB` : 'Stream',
        working: true
      };
    } catch (err) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      return {
        url,
        status: 'Broken',
        statusCode: err.name === 'AbortError' ? 408 : 504,
        responseTime: `${duration}ms`,
        contentType: 'Unknown / Blocked',
        working: false,
        error: err.name === 'AbortError' ? 'Timeout' : 'Network Error'
      };
    }
  }, []);

  const testMovieLinks = useCallback(async (movie) => {
    setTesting(true);
    const results = {};

    const qualities = [
      { name: 'Poster Image', url: movie.image },
      { name: '360P Stream', url: movie.p360 },
      { name: '720P Stream', url: movie.p720 },
      { name: '1080P Stream', url: movie.p1080 }
    ];

    for (const item of qualities) {
      results[item.name] = await testSingleUrl(item.url, item.name);
    }

    setTestResults(results);
    setTesting(false);
    return results;
  }, [testSingleUrl]);

  return {
    testing,
    testResults,
    testSingleUrl,
    testMovieLinks
  };
}
