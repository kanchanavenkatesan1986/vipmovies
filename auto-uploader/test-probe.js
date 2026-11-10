const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const testUrl = 'https://download.isaidub.dad/download.php?url=https://s09.dubshare.one/isaiDub.io_-_Moana_2026_Original_360p_HD.mp4';
  console.log('Testing download.isaidub.dad...');

  let downloadUrl = null;
  page.on('download', async (download) => {
    console.log('Download triggered! URL:', download.url());
    console.log('Filename:', download.suggestedFilename());
    downloadUrl = download.url();
  });

  page.on('response', (response) => {
    if (response.url().includes('dubshare') || response.url().includes('download.php') || response.status() >= 300) {
      console.log('HTTP', response.status(), response.url(), 'Headers:', response.headers()['content-type'], response.headers()['location']);
    }
  });

  try {
    await page.goto(testUrl, { timeout: 20000, waitUntil: 'domcontentloaded' });
  } catch (e) {
    console.log('Page goto error/timeout:', e.message);
  }

  await page.waitForTimeout(5000);
  await browser.close();
})().catch(console.error);

