/**
 * Live File Manager API Test Suite
 * Tests /list-objects, /create-folder, /object-details, /copy-object, /rename-object, /delete-object, /delete-folder
 */

const BASE_URL = process.env.VITE_UPLOAD_API_BASE || 'https://api-uploder.akatsuki-pvt-ltd.workers.dev';
const TOKEN = process.env.VITE_UPLOAD_API_TOKEN || 'VIP_SECURE_TOKEN_2026';

function assert(condition, testName, extra = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName} ->`, extra);
  }
}

async function runTests() {
  console.log(`\n============================================================`);
  console.log(`▶ TESTING LIVE FILE MANAGER API: ${BASE_URL}`);
  console.log(`============================================================\n`);

  const timestamp = Date.now();
  const testFolder = `tamil/2026/test-fm-${timestamp}/`;
  const testKey = `${testFolder}sample_${timestamp}.mp4`;

  // 1. Test POST /create-folder
  try {
    const res = await fetch(`${BASE_URL}/create-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ prefix: testFolder })
    });
    const data = await res.json();
    assert(res.status === 201 && data.success === true, 'POST /create-folder created folder marker', data);
  } catch (e) {
    assert(false, 'POST /create-folder failed', e.message);
  }

  // 2. Test POST /list-objects for root
  try {
    const res = await fetch(`${BASE_URL}/list-objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ prefix: '', delimiter: '/' })
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'POST /list-objects at root returns folders & objects', data);
    assert(Array.isArray(data.folders) && Array.isArray(data.objects), 'Folders and objects are arrays');
  } catch (e) {
    assert(false, 'POST /list-objects root failed', e.message);
  }

  // 3. Test POST /list-objects for specific folder
  try {
    const res = await fetch(`${BASE_URL}/list-objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ prefix: testFolder, delimiter: '/' })
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'POST /list-objects inside test folder returns items', data);
    assert(data.objects.some(o => o.key.includes('.keep')), 'Found .keep marker in test folder');
  } catch (e) {
    assert(false, 'POST /list-objects in test folder failed', e.message);
  }

  // 4. Test POST /copy-object (.keep marker to copy_keep)
  const copiedKey = `${testFolder}copied_keep.txt`;
  try {
    const res = await fetch(`${BASE_URL}/copy-object`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ sourceKey: `${testFolder}.keep`, destKey: copiedKey })
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'POST /copy-object copied object server-side', data);
  } catch (e) {
    assert(false, 'POST /copy-object failed', e.message);
  }

  // 5. Test POST /object-details
  try {
    const res = await fetch(`${BASE_URL}/object-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ key: copiedKey })
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'POST /object-details retrieved head metadata', data);
    assert(data.key === copiedKey, 'Object key matches');
  } catch (e) {
    assert(false, 'POST /object-details failed', e.message);
  }

  // 6. Test POST /rename-object
  const renamedKey = `${testFolder}renamed_keep.txt`;
  try {
    const res = await fetch(`${BASE_URL}/rename-object`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ oldKey: copiedKey, newKey: renamedKey })
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'POST /rename-object renamed object', data);
  } catch (e) {
    assert(false, 'POST /rename-object failed', e.message);
  }

  // 7. Test POST /delete-object
  try {
    const res = await fetch(`${BASE_URL}/delete-object`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ key: renamedKey })
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'POST /delete-object deleted object', data);
  } catch (e) {
    assert(false, 'POST /delete-object failed', e.message);
  }

  // 8. Test POST /delete-folder (cleanup test folder)
  try {
    const res = await fetch(`${BASE_URL}/delete-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ prefix: testFolder })
    });
    const data = await res.json();
    assert(res.status === 200 && data.success === true, 'POST /delete-folder purged test folder', data);
  } catch (e) {
    assert(false, 'POST /delete-folder failed', e.message);
  }

  console.log(`\n============================================================`);
  console.log(`🏆 ALL LIVE FILE MANAGER TESTS EXECUTED!`);
  console.log(`============================================================\n`);
}

runTests();
