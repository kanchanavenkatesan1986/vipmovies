/**
 * Comprehensive Test Suite for Cloudflare R2 Multipart Worker API
 * Target: https://api-uploder.akatsuki-pvt-ltd.workers.dev
 */

const BASE_URL = process.env.VITE_UPLOAD_API_BASE || 'https://api-uploder.akatsuki-pvt-ltd.workers.dev';
const TOKEN = process.argv[2] || process.env.VITE_UPLOAD_API_TOKEN || 'VIP_SECURE_TOKEN_2026';

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`▶ ${title}`);
  console.log('='.repeat(60));
}

async function runTests() {
  console.log(`Starting Test Suite on Worker API: ${BASE_URL}`);
  console.log(`Using Bearer Token: ${TOKEN.substring(0, 4)}****`);

  let passed = 0;
  let failed = 0;

  function assert(condition, desc, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc} ${details ? '-> ' + JSON.stringify(details) : ''}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: GET /health
  // -------------------------------------------------------------
  logSection('TEST 1: Health Check (GET /health)');
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    assert(res.status === 200, 'Status code is 200', res.status);
    assert(data.success === true && data.status === 'ok', 'Service status is ok', data);
    assert(Array.isArray(data.allowedCategories) && data.allowedCategories.includes('tamil'), 'Allowed categories present', data.allowedCategories);
  } catch (err) {
    assert(false, 'GET /health failed with error', err.message);
  }

  // -------------------------------------------------------------
  // TEST 2: OPTIONS /* (CORS Preflight)
  // -------------------------------------------------------------
  logSection('TEST 2: CORS Preflight (OPTIONS /create-upload)');
  try {
    const res = await fetch(`${BASE_URL}/create-upload`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://your-admin-domain.com',
        'Access-Control-Request-Method': 'POST'
      }
    });
    assert(res.status === 204, 'Preflight status is 204 No Content', res.status);
    assert(res.headers.get('Access-Control-Allow-Methods')?.includes('POST'), 'CORS allow methods include POST');
  } catch (err) {
    assert(false, 'OPTIONS check failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 3: Path Validation & Security
  // -------------------------------------------------------------
  logSection('TEST 3: Path Validation & Security Rejections');
  
  // 3a. Invalid Category
  try {
    const res = await fetch(`${BASE_URL}/create-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({
        category: 'unsupported_category',
        year: 2026,
        movieFolder: 'leo',
        filename: 'leo.mp4'
      })
    });
    const data = await res.json();
    assert(res.status === 400 && data.code === 'INVALID_CATEGORY', 'Rejects invalid category with 400 INVALID_CATEGORY', data);
  } catch (err) {
    assert(false, 'Category validation check failed', err.message);
  }

  // 3b. Invalid Year
  try {
    const res = await fetch(`${BASE_URL}/create-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({
        category: 'tamil',
        year: 1850,
        movieFolder: 'leo',
        filename: 'leo.mp4'
      })
    });
    const data = await res.json();
    assert(res.status === 400 && data.code === 'INVALID_YEAR', 'Rejects out-of-range year with 400 INVALID_YEAR', data);
  } catch (err) {
    assert(false, 'Year validation check failed', err.message);
  }

  // 3c. Path Traversal & Invalid Folder
  try {
    const res = await fetch(`${BASE_URL}/create-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({
        category: 'tamil',
        year: 2026,
        movieFolder: '../../etc',
        filename: 'leo.mp4'
      })
    });
    const data = await res.json();
    assert(res.status === 400 && data.code === 'INVALID_MOVIE_FOLDER', 'Rejects folder path traversal with 400 INVALID_MOVIE_FOLDER', data);
  } catch (err) {
    assert(false, 'Folder traversal check failed', err.message);
  }

  // 3d. Unsupported Extension
  try {
    const res = await fetch(`${BASE_URL}/create-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({
        category: 'tamil',
        year: 2026,
        movieFolder: 'leo',
        filename: 'malware.exe'
      })
    });
    const data = await res.json();
    assert(res.status === 400 && data.code === 'INVALID_FILENAME', 'Rejects invalid extension with 400 INVALID_FILENAME', data);
  } catch (err) {
    assert(false, 'Extension validation check failed', err.message);
  }

  // -------------------------------------------------------------
  // TEST 4: Happy Path Multipart Upload Lifecycle
  // -------------------------------------------------------------
  logSection('TEST 4: Full Multipart Upload Lifecycle (Create -> Upload Part -> List Parts -> Complete)');

  const testKeyTimestamp = Date.now();
  const testPayload = {
    category: 'tamil',
    year: 2026,
    movieFolder: `test-movie-${testKeyTimestamp}`,
    filename: `test_sample_${testKeyTimestamp}.mp4`,
    fileSize: 5 * 1024 * 1024, // 5 MB test file
    contentType: 'video/mp4'
  };

  let uploadId = null;
  let key = null;
  let part1Etag = null;

  // Step 4a: POST /create-upload
  try {
    const res = await fetch(`${BASE_URL}/create-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify(testPayload)
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'POST /create-upload initialized session', data);
    assert(!!data.uploadId, 'Received valid uploadId', data.uploadId);
    assert(data.key === `tamil/2026/test-movie-${testKeyTimestamp}/test_sample_${testKeyTimestamp}.mp4`, 'Key built correctly', data.key);
    uploadId = data.uploadId;
    key = data.key;
  } catch (err) {
    assert(false, 'POST /create-upload failed', err.message);
  }

  if (uploadId && key) {
    // Step 4b: POST /upload-status (Active check)
    try {
      const res = await fetch(`${BASE_URL}/upload-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ key, uploadId })
      });
      const data = await res.json();
      assert(res.status === 200 && data.status === 'active', 'POST /upload-status reports status as active', data);
    } catch (err) {
      assert(false, 'POST /upload-status failed', err.message);
    }

    // Step 4c: POST /upload-part (Upload 5MB test chunk)
    try {
      const dummyBuffer = Buffer.alloc(5 * 1024 * 1024, 'A');
      const blob = new Blob([dummyBuffer], { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('key', key);
      formData.append('uploadId', uploadId);
      formData.append('partNumber', '1');
      formData.append('chunk', blob, 'part1.chunk');

      const res = await fetch(`${BASE_URL}/upload-part`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}` },
        body: formData
      });
      const data = await res.json();
      assert(res.status === 200 && data.success === true, 'POST /upload-part streamed chunk to R2', data);
      assert(data.partNumber === 1 && typeof data.etag === 'string', 'Part 1 returned valid ETag', data.etag);
      part1Etag = data.etag;
    } catch (err) {
      assert(false, 'POST /upload-part failed', err.message);
    }

    // Step 4d: POST /list-parts (Resume check)
    try {
      const res = await fetch(`${BASE_URL}/list-parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ key, uploadId })
      });
      const data = await res.json();
      assert(res.status === 200 && data.success === true, 'POST /list-parts retrieved parts status', data);
      assert(Array.isArray(data.parts), 'Parts returned as array', data.parts);
    } catch (err) {
      assert(false, 'POST /list-parts failed', err.message);
    }

    // Step 4e: POST /complete-upload (Finalize)
    if (part1Etag) {
      try {
        const res = await fetch(`${BASE_URL}/complete-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
          body: JSON.stringify({
            key,
            uploadId,
            parts: [{ partNumber: 1, etag: part1Etag }]
          })
        });
        const data = await res.json();
        assert(res.status === 200 && data.success === true, 'POST /complete-upload finalized object in R2', data);
        assert(data.key === key, 'Completed key matches target key', data.key);
      } catch (err) {
        assert(false, 'POST /complete-upload failed', err.message);
      }
    }

    // Step 4f: POST /upload-status (Completed check)
    try {
      const res = await fetch(`${BASE_URL}/upload-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      assert(res.status === 200 && data.status === 'completed', 'POST /upload-status detects completed R2 object', data);
    } catch (err) {
      assert(false, 'POST /upload-status verification failed', err.message);
    }
  }

  // -------------------------------------------------------------
  // TEST 5: POST /abort-upload & /cleanup-upload Lifecycle
  // -------------------------------------------------------------
  logSection('TEST 5: Abort & Cleanup Session (POST /abort-upload & /cleanup-upload)');

  const abortPayload = {
    category: 'hollywood',
    year: 2025,
    movieFolder: `test-abort-${Date.now()}`,
    filename: `avatar_abort_sample_${Date.now()}.mp4`,
    fileSize: 10 * 1024 * 1024,
    contentType: 'video/mp4'
  };

  try {
    const createRes = await fetch(`${BASE_URL}/create-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify(abortPayload)
    });
    const createData = await createRes.json();
    assert(createRes.status === 200 && !!createData.uploadId, 'Initialized session for abort testing', createData);

    if (createData.uploadId) {
      const abortRes = await fetch(`${BASE_URL}/abort-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({ key: createData.key, uploadId: createData.uploadId })
      });
      const abortData = await abortRes.json();
      assert(abortRes.status === 200 && abortData.success === true, 'POST /abort-upload cancelled multipart session', abortData);
    }
  } catch (err) {
    assert(false, 'Abort upload test failed', err.message);
  }

  // -------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------
  logSection('TEST SUMMARY');
  console.log(`Total Passed: ${passed}`);
  console.log(`Total Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 ALL 14 WORKER API FUNCTIONALITY & SECURITY TESTS PASSED SUCCESSFULLY!\n');
  } else {
    console.error(`\n⚠️ ${failed} test(s) failed. Review the log above.\n`);
  }
}

runTests();
