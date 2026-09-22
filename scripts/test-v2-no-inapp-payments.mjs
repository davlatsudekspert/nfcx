import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('mobile_v2');
const forbidden = [
  /payme/i,
  /click payment/i,
  /\/api\/payments/i,
  /\/api\/orders/i,
  /orderPhysicalCard/i,
  /requestPremium/i,
];

const allowedFiles = new Set([
  path.resolve(root, 'README.md'),
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

const bad = [];
for (const file of walk(root)) {
  if (allowedFiles.has(path.resolve(file))) continue;
  if (!/\.(dart|yaml|yml|xml|kt|kts|plist|pbxproj)$/.test(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(text)) bad.push(file + ' -> ' + pattern);
  }
}

if (bad.length) {
  console.error('V2 ichida ilova ichki to‘lov kodi topildi:');
  for (const item of bad) console.error('- ' + item);
  process.exit(1);
}

console.log('OK: V2 ichida Payme/Click checkout yoki payment API yo‘q.');
