import assert from 'node:assert/strict';
import { parseTagUrl } from '../tagUrl.ts';

let pass = 0;
const ok = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };

console.log('haqiqiy karta shakli:');

ok('kod yo\'lda + token ?t= da', () => {
  assert.deepEqual(parseTagUrl('https://nfcstore.uz/ABC123?t=a1b2c3d4'),
    { kind: 'card', code: 'ABC123', token: 'a1b2c3d4' });
});

ok('8 xonali avtomatik ID', () => {
  assert.deepEqual(parseTagUrl('https://nfcstore.uz/12345678?t=xyz98765'),
    { kind: 'card', code: '12345678', token: 'xyz98765' });
});

ok('faqat harfli maxsus nom', () => {
  assert.deepEqual(parseTagUrl('https://nfcstore.uz/nfcstore'),
    { kind: 'card', code: 'NFCSTORE', token: null });
});

ok('sxemasiz teg', () => {
  assert.deepEqual(parseTagUrl('nfcstore.uz/ABC123?t=tok12345'),
    { kind: 'card', code: 'ABC123', token: 'tok12345' });
});

ok('kod kichik harfda -> katta harfga', () => {
  assert.equal(parseTagUrl('https://nfcstore.uz/abc123').code, 'ABC123');
});

console.log('kompaniya:');

ok('/c/<ID>', () => {
  assert.deepEqual(parseTagUrl('https://nfcstore.uz/c/NFCSTORE'),
    { kind: 'company', companyId: 'NFCSTORE', token: null });
});

ok('/kompaniyalar/<ID>', () => {
  assert.deepEqual(parseTagUrl('https://nfcstore.uz/kompaniyalar/greencoffee?t=tok12345'),
    { kind: 'company', companyId: 'greencoffee', token: 'tok12345' });
});

console.log('zaxira yo\'l (faqat token):');

ok('xom token', () => {
  assert.deepEqual(parseTagUrl('a1b2c3d4'), { kind: 'token', token: 'a1b2c3d4' });
});

ok('band sahifa + token -> token yo\'liga tushadi', () => {
  assert.deepEqual(parseTagUrl('https://nfcstore.uz/login?t=tok12345'),
    { kind: 'token', token: 'tok12345' });
});

console.log('tanilmagan:');

ok('bo\'sh matn', () => {
  assert.deepEqual(parseTagUrl(''), { kind: 'unknown' });
});

ok('band sahifa, tokensiz', () => {
  assert.deepEqual(parseTagUrl('https://nfcstore.uz/katalog'), { kind: 'unknown' });
});

ok('boshqa saytning URL\'i ham kod sifatida o\'qiladi (teg noto\'g\'ri yozilgan)', () => {
  // Yo'l shakli mos kelsa kod olinadi — domen tekshirilmaydi, chunki
  // egasining kartalari boshqa domenda ham bo'lishi mumkin.
  assert.deepEqual(parseTagUrl('https://example.com/ABC123'),
    { kind: 'card', code: 'ABC123', token: null });
});

ok('mos kelmaydigan yo\'l shakli', () => {
  assert.deepEqual(parseTagUrl('https://nfcstore.uz/ab'), { kind: 'unknown' });
});

ok('juda uzun yo\'l bo\'lagi', () => {
  assert.deepEqual(parseTagUrl('https://nfcstore.uz/abcdefghijklmnop'), { kind: 'unknown' });
});

console.log(`\n${pass} test o'tdi.`);
