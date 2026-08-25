// Paynet Merchant integratsiyasi: to'lov havolasi + webhook (avtomatik "band" qilish).
//
// Kerakli env'lar (Railway Variables):
//   PAYNET_MERCHANT_ID      - partner.paynet.uz kabinetidan
//   PAYNET_WEBHOOK_LOGIN    - kabinetdagi kallback login
//   PAYNET_WEBHOOK_PASSWORD - kabinetdagi kallback parol
//
// Kabinetda Callback URL: https://<domen>/api/pay/paynet/webhook

import crypto from 'crypto';

const MERCHANT_ID = process.env.PAYNET_MERCHANT_ID || '';
const WEBHOOK_LOGIN = process.env.PAYNET_WEBHOOK_LOGIN || '';
const WEBHOOK_PASSWORD = process.env.PAYNET_WEBHOOK_PASSWORD || '';

export function paynetEnabled() {
  return Boolean(MERCHANT_ID && WEBHOOK_LOGIN && WEBHOOK_PASSWORD);
}

// Mijozga yuboriladigan to'lov havolasi (summa tiyinda = so'm x 100).
export function paynetLink(orderId, priceSom) {
  if (!MERCHANT_ID || !orderId) return '';
  const tiyin = Math.round(Number(priceSom) * 100);
  return `https://app.paynet.uz/?m=${encodeURIComponent(MERCHANT_ID)}&c=${encodeURIComponent(orderId)}&a=${tiyin}`;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// Paynet kallback'lari Basic auth bilan keladi.
export function verifyPaynetAuth(req) {
  if (!WEBHOOK_LOGIN || !WEBHOOK_PASSWORD) return false;
  const header = String(req.headers.authorization || '');
  const [scheme, b64] = header.split(' ');
  if (scheme !== 'Basic' || !b64) return false;
  let decoded;
  try {
    decoded = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return false;
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return false;
  return (
    safeEqual(decoded.slice(0, sep), WEBHOOK_LOGIN) &&
    safeEqual(decoded.slice(sep + 1), WEBHOOK_PASSWORD)
  );
}

// Paynet turli shakllarda yuborishi mumkin — moslashuvchan o'qiymiz:
//   { c, a, status } | { order_id, amount, event } | { params: { account: { order_id }, ... } }
// Muhim holatlar: successfully_payment / cancelled_payment
//
// "c" (account) maydoni ikki xil buyurtmani anglatishi mumkin:
//   - faqat raqam (masalan "482")        -> Telegram bot buyurtmasi (bot_orders)
//   - "W" prefiksli (masalan "W17")      -> sayt orqali berilgan buyurtma (web_orders)
// Shuning uchun avval xom (raw) qiymatni olib, keyin turini aniqlaymiz.
export function parsePaynetCallback(body = {}) {
  const b = body || {};
  const raw = String(
    b.c ?? b.order_id ?? b.payment_id ??
    b.params?.account?.order_id ?? b.account?.order_id ??
    b.invoice?.account?.order_id ?? ''
  ).trim();

  let orderKind = 'bot';
  let orderId = 0;
  if (/^W\d+$/i.test(raw)) {
    orderKind = 'web';
    orderId = Number(raw.slice(1));
  } else {
    orderKind = 'bot';
    orderId = Number(raw) || 0;
  }

  const rawStatus = String(b.status ?? b.event ?? b.type ?? b.state ?? '').toLowerCase();
  let status = 'unknown';
  if (rawStatus.includes('success')) status = 'paid';
  else if (rawStatus.includes('cancel') || rawStatus.includes('fail') || rawStatus.includes('reject')) {
    status = 'cancelled';
  }

  const rawAmount = Number(b.a ?? b.amount ?? b.params?.amount ?? 0);
  const amountSom = rawAmount > 10000 ? Math.round(rawAmount / 100) : rawAmount;

  return { orderKind, orderId, status, amountSom };
}
