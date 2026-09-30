import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker, { appDownloadTarget } from '../hosting/worker.js';
const apk = 'https://downloads.example.org/NFCSTORE.apk';
for (const path of ['/app', '/app/', '/app?campaign=card']) {
  for (const method of ['GET', 'HEAD']) {
    const res = await worker.fetch(new Request(`https://nfcstore.uz${path}`, { method }), { APP_DOWNLOAD_URL: apk }, {});
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), apk);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
}
const play = 'https://play.google.com/store/apps/details?id=uz.nfcstore.nova';
assert.equal(appDownloadTarget({ APP_DOWNLOAD_URL: play }), play);
for (const target of ['', '[APK_HAVOLASI]', 'http://example.org/app.apk', 'https://nfcstore.uz/app', 'https://www.nfcstore.uz/app/']) {
  const res = await worker.fetch(new Request('https://nfcstore.uz/app'), { APP_DOWNLOAD_URL: target }, {});
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('location'), null);
}
const qr = await worker.fetch(new Request('https://nfcstore.uz/qr-1'), {}, {});
assert.equal(qr.status, 302);
assert.equal(qr.headers.get('location'), '/nfc-stiker?utm_source=stiker&utm_medium=qr&utm_campaign=qr-1#avto');
const lib = await import('../src/lib/appDownload.js');
assert.equal(lib.APP_APK_URL, '/app');
assert.equal(lib.PLAY_STORE_URL, '/app');
assert.equal(lib.APP_PAGE_PATH, '/ilova-yuklash');
for (const path of ['src/lib/appDownload.js', 'mobile/RELEASE.md']) assert.ok(!fs.readFileSync(path, 'utf8').includes('github.com/davlatsudekspert/nfcx/releases'));
console.log('PASS: APK/Play target, GET/HEAD 302, no-store, missing/invalid target, QR unchanged, stable links');
