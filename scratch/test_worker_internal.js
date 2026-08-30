/**
 * Unit and Functional Test for worker.js using Mock R2 Bucket
 */

import worker from '../worker.js';

// In-memory Mock R2 Bucket
class MockR2MultipartUpload {
  constructor(key, uploadId, bucket) {
    this.key = key;
    this.uploadId = uploadId;
    this.bucket = bucket;
    this.partsMap = new Map();
  }

  async uploadPart(partNumber, value) {
    // Read stream to compute size
    const reader = value.getReader();
    let bytes = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      bytes += chunk.length;
    }
    const etag = `"etag_part_${partNumber}_${Date.now()}"`;
    const part = { partNumber, etag, size: bytes };
    this.partsMap.set(partNumber, part);
    return part;
  }

  async complete(parts) {
    let totalSize = 0;
    for (const p of parts) {
      const stored = this.partsMap.get(p.partNumber);
      totalSize += (stored ? stored.size : 1024 * 1024);
    }
    const obj = {
      key: this.key,
      size: totalSize,
      httpEtag: `"final_etag_${Date.now()}"`,
      etag: `"final_etag_${Date.now()}"`,
      uploaded: new Date().toISOString()
    };
    this.bucket.objects.set(this.key, obj);
    this.bucket.activeUploads.delete(this.uploadId);
    return obj;
  }

  async abort() {
    this.partsMap.clear();
    this.bucket.activeUploads.delete(this.uploadId);
  }

  async parts() {
    return {
      parts: Array.from(this.partsMap.values()).sort((a, b) => a.partNumber - b.partNumber),
      isTruncated: false
    };
  }
}

class MockR2Bucket {
  constructor() {
    this.objects = new Map();
    this.activeUploads = new Map(); // uploadId -> MockR2MultipartUpload
  }

  async head(key) {
    return this.objects.get(key) || null;
  }

  async createMultipartUpload(key, options = {}) {
    const uploadId = `mp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const upload = new MockR2MultipartUpload(key, uploadId, this);
    this.activeUploads.set(uploadId, upload);
    return { uploadId, key };
  }

  resumeMultipartUpload(key, uploadId) {
    let upload = this.activeUploads.get(uploadId);
    if (!upload) {
      upload = new MockR2MultipartUpload(key, uploadId, this);
      this.activeUploads.set(uploadId, upload);
    }
    return upload;
  }
}

async function runTests() {
  console.log('=' .repeat(60));
  console.log('▶ TESTING WORKER.JS INTERNAL ROUTING, R2 ENGINE & SECURITY');
  console.log('='.repeat(60));

  const env = {
    MY_BUCKET: new MockR2Bucket(),
    UPLOAD_API_TOKEN: 'VIP_SECURE_TOKEN_2026'
  };

  let passed = 0;
  let failed = 0;

  function assert(cond, desc) {
    if (cond) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. GET /health
  {
    const req = new Request('https://test.local/health', { method: 'GET' });
    const res = await worker.fetch(req, env);
    const data = await res.json();
    assert(res.status === 200 && data.status === 'ok', 'GET /health returns 200 and ok');
  }

  // 2. OPTIONS Preflight
  {
    const req = new Request('https://test.local/create-upload', {
      method: 'OPTIONS',
      headers: { 'Origin': 'http://localhost:5173' }
    });
    const res = await worker.fetch(req, env);
    assert(res.status === 204, 'OPTIONS /* returns 204 No Content');
    assert(res.headers.get('Access-Control-Allow-Origin') === 'http://localhost:5173', 'CORS origin dynamically reflected');
  }

  // 3. Auth Check
  {
    const reqNoAuth = new Request('https://test.local/create-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'tamil', year: 2026, movieFolder: 'leo', filename: 'leo.mp4' })
    });
    const resNoAuth = await worker.fetch(reqNoAuth, env);
    assert(resNoAuth.status === 401, 'Rejects request without Authorization header');

    const reqBadAuth = new Request('https://test.local/create-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer WRONG_TOKEN' },
      body: JSON.stringify({ category: 'tamil', year: 2026, movieFolder: 'leo', filename: 'leo.mp4' })
    });
    const resBadAuth = await worker.fetch(reqBadAuth, env);
    assert(resBadAuth.status === 401, 'Rejects request with invalid Bearer token');
  }

  // 4. Security & Path Validations
  {
    // Invalid Category
    const req1 = new Request('https://test.local/create-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({ category: 'hacked_cat', year: 2026, movieFolder: 'leo', filename: 'leo.mp4' })
    });
    const res1 = await worker.fetch(req1, env);
    const data1 = await res1.json();
    assert(res1.status === 400 && data1.code === 'INVALID_CATEGORY', 'Rejects unauthorized category with 400 INVALID_CATEGORY');

    // Invalid Year
    const req2 = new Request('https://test.local/create-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({ category: 'tamil', year: 1800, movieFolder: 'leo', filename: 'leo.mp4' })
    });
    const res2 = await worker.fetch(req2, env);
    const data2 = await res2.json();
    assert(res2.status === 400 && data2.code === 'INVALID_YEAR', 'Rejects out-of-range year with 400 INVALID_YEAR');

    // Path Traversal in movieFolder
    const req3 = new Request('https://test.local/create-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({ category: 'tamil', year: 2026, movieFolder: '../../bin', filename: 'leo.mp4' })
    });
    const res3 = await worker.fetch(req3, env);
    const data3 = await res3.json();
    assert(res3.status === 400 && data3.code === 'INVALID_MOVIE_FOLDER', 'Rejects movieFolder traversal with 400 INVALID_MOVIE_FOLDER');

    // Path Traversal in filename
    const req4 = new Request('https://test.local/create-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({ category: 'tamil', year: 2026, movieFolder: 'leo', filename: 'malware.exe' })
    });
    const res4 = await worker.fetch(req4, env);
    const data4 = await res4.json();
    assert(res4.status === 400 && data4.code === 'INVALID_FILENAME', 'Rejects non-movie extension (.exe) with 400 INVALID_FILENAME');
  }

  // 5. Full Lifecycle: Create -> Upload Part -> List Parts -> Status -> Complete
  let uploadId = null;
  let finalKey = null;
  let part1Etag = null;
  {
    // Step 5a: Create Upload
    const reqCreate = new Request('https://test.local/create-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({
        category: 'tamil',
        year: 2026,
        movieFolder: 'leo',
        filename: 'leo.mp4',
        fileSize: 5368709120,
        contentType: 'video/mp4'
      })
    });
    const resCreate = await worker.fetch(reqCreate, env);
    const dataCreate = await resCreate.json();
    assert(resCreate.status === 200 && dataCreate.success === true, 'POST /create-upload succeeds');
    assert(dataCreate.key === 'tamil/2026/leo/leo.mp4', 'Destination key is exactly tamil/2026/leo/leo.mp4');
    uploadId = dataCreate.uploadId;
    finalKey = dataCreate.key;

    // Step 5b: Upload Status (Active)
    const reqStatus1 = new Request('https://test.local/upload-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({ key: finalKey, uploadId })
    });
    const resStatus1 = await worker.fetch(reqStatus1, env);
    const dataStatus1 = await resStatus1.json();
    assert(resStatus1.status === 200 && dataStatus1.status === 'active', 'POST /upload-status returns active');

    // Step 5c: Upload Part 1
    const dummyBytes = new Uint8Array(5 * 1024 * 1024);
    const formData = new FormData();
    formData.append('key', finalKey);
    formData.append('uploadId', uploadId);
    formData.append('partNumber', '1');
    formData.append('chunk', new Blob([dummyBytes], { type: 'video/mp4' }), 'part1.chunk');

    const reqPart1 = new Request('https://test.local/upload-part', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: formData
    });
    const resPart1 = await worker.fetch(reqPart1, env);
    const dataPart1 = await resPart1.json();
    assert(resPart1.status === 200 && dataPart1.success === true, 'POST /upload-part part 1 succeeds');
    assert(dataPart1.partNumber === 1 && typeof dataPart1.etag === 'string', 'Part 1 returns valid etag');
    part1Etag = dataPart1.etag;

    // Step 5d: List Parts (Resume validation)
    const reqList = new Request('https://test.local/list-parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({ key: finalKey, uploadId })
    });
    const resList = await worker.fetch(reqList, env);
    const dataList = await resList.json();
    assert(resList.status === 200 && dataList.parts.length === 1, 'POST /list-parts lists 1 uploaded part');

    // Step 5e: Complete Upload
    const reqComp = new Request('https://test.local/complete-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({
        key: finalKey,
        uploadId,
        parts: [{ partNumber: 1, etag: part1Etag }]
      })
    });
    const resComp = await worker.fetch(reqComp, env);
    const dataComp = await resComp.json();
    assert(resComp.status === 200 && dataComp.success === true, 'POST /complete-upload finalizes object in R2');
    assert(dataComp.key === 'tamil/2026/leo/leo.mp4', 'Completed key matches');

    // Step 5f: Upload Status (Completed check)
    const reqStatus2 = new Request('https://test.local/upload-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({ key: finalKey })
    });
    const resStatus2 = await worker.fetch(reqStatus2, env);
    const dataStatus2 = await resStatus2.json();
    assert(resStatus2.status === 200 && dataStatus2.status === 'completed', 'POST /upload-status returns completed');
  }

  // 6. Duplicate Key Policy (Reject check)
  {
    const reqDup = new Request('https://test.local/create-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({
        category: 'tamil',
        year: 2026,
        movieFolder: 'leo',
        filename: 'leo.mp4'
      })
    });
    const resDup = await worker.fetch(reqDup, env);
    const dataDup = await resDup.json();
    assert(resDup.status === 409 && dataDup.code === 'DUPLICATE_KEY', 'Duplicate policy reject returns 409 DUPLICATE_KEY');
  }

  // 7. Abort Upload Lifecycle
  {
    const reqCreateAbort = new Request('https://test.local/create-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({
        category: 'hollywood',
        year: 2025,
        movieFolder: 'avatar',
        filename: 'avatar.mp4'
      })
    });
    const resCreateAbort = await worker.fetch(reqCreateAbort, env);
    const dataCreateAbort = await resCreateAbort.json();

    const reqAbort = new Request('https://test.local/abort-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer VIP_SECURE_TOKEN_2026' },
      body: JSON.stringify({
        key: dataCreateAbort.key,
        uploadId: dataCreateAbort.uploadId
      })
    });
    const resAbort = await worker.fetch(reqAbort, env);
    const dataAbort = await resAbort.json();
    assert(resAbort.status === 200 && dataAbort.success === true, 'POST /abort-upload cleans up staged upload');
  }

  console.log('='.repeat(60));
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  if (failed === 0) {
    console.log('🏆 ALL INTERNAL WORKER & R2 MULTIPART TESTS PASSED 100%!');
  }
}

runTests();
