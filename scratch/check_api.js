const https = require('https');
const zlib = require('zlib');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            console.log(`URL: ${url}`);
            console.log('Headers:', res.headers);
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                console.log('Buffer prefix (hex):', buffer.slice(0, 20).toString('hex'));
                const encoding = res.headers['content-encoding'];
                if (encoding === 'gzip' || (buffer[0] === 0x1f && buffer[1] === 0x8b)) {
                    zlib.gunzip(buffer, (err, decoded) => {
                        if (err) reject(err);
                        else resolve(JSON.parse(decoded.toString()));
                    });
                } else if (encoding === 'deflate') {
                    zlib.inflate(buffer, (err, decoded) => {
                        if (err) reject(err);
                        else resolve(JSON.parse(decoded.toString()));
                    });
                } else {
                    try {
                        resolve(JSON.parse(buffer.toString()));
                    } catch(e) {
                        reject(new Error(`Failed to parse JSON, first 100 chars: ${buffer.toString('utf8').substring(0, 100)}. Error: ${e.message}`));
                    }
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log('Fetching /api/version...');
        const versionData = await fetchJson('https://api-movies.akatsuki-pvt-ltd.workers.dev/api/version');
        console.log('Version Data:', versionData);

        console.log('Fetching /api/app...');
        const appData = await fetchJson('https://api-movies.akatsuki-pvt-ltd.workers.dev/api/app');
        console.log('App Data Keys:', Object.keys(appData));
        if (appData.movies) console.log('Movies Array Length:', appData.movies.length);
        if (appData.slider) console.log('Slider Array Length:', appData.slider.length);
    } catch (err) {
        console.error('Error fetching API:', err);
    }
}

run();
