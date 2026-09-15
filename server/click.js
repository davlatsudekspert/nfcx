// Click Shop API: Prepare va Complete callback'lari.
// Click kabinetida Prepare URL va Complete URL alohida ko'rsatiladi:
// https://<domain>/api/pay/click/prepare va /api/pay/click/complete.

import crypto from 'crypto';
import {
  cancelPendingWebOrder,
  finalizePaidWebOrder,
  getWebOrder,
  getWebOrderByClickPrepareId,
  getWebOrderByClickTransactionId,
  setWebOrderClickPrepared,
} from './db.js';

const SERVICE_ID = process.env.CLICK_SERVICE_ID || '';
const MERCHANT_ID = process.env.CLICK_MERCHANT_ID || '';
const SECRET_KEY = process.env.CLICK_SECRET_KEY || '';
const RETURN_URL = process.env.PAYMENT_RETURN_URL || '';

export function clickEnabled() {
  return Boolean(SERVICE_ID && MERCHANT_ID && SECRET_KEY);
}

export function clickCheckoutLink(orderId, amountSom) {
  if (!clickEnabled() || !orderId) return '';
  const query = new URLSearchParams({
    service_id: SERVICE_ID,
    merchant_id: MERCHANT_ID,
    amount: Number(amountSom).toFixed(2),
    transaction_param: String(orderId),
  });
  if (RETURN_URL) query.set('return_url', RETURN_URL);
  return `https://my.click.uz/services/pay?${query.toString()}`;
}

function response(body, error = 0, errorNote = '') {
  return {
    click_trans_id: String(body?.click_trans_id || ''),
    merchant_trans_id: String(body?.merchant_trans_id || ''),
    merchant_prepare_id: body?.merchant_prepare_id == null ? null : Number(body.merchant_prepare_id),
    merchant_confirm_id: body?.merchant_prepare_id == null ? null : Number(body.merchant_prepare_id),
    error,
    error_note: errorNote,
  };
}

function validOrderId(value) {
  return /^[1-9]\d*$/.test(String(value || '')) ? Number(value) : 0;
}

function sameAmount(actual, expected) {
  return Number.isFinite(Number(actual))
    && Math.round(Number(actual) * 100) === Math.round(Number(expected) * 100);
}

function secureEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function signature(body, complete) {
  const fields = [
    body.click_trans_id,
    body.service_id,
    SECRET_KEY,
    body.merchant_trans_id,
  ];
  if (complete) fields.push(body.merchant_prepare_id);
  fields.push(body.amount, body.action, body.sign_time);
  return crypto.createHash('md5').update(fields.map((v) => String(v ?? '')).join('')).digest('hex');
}

function validate(body, action) {
  if (!clickEnabled()) return { error: -8, note: 'Click o‘chirilgan' };
  if (!body || String(body.action) !== String(action)) return { error: -3, note: 'Noto‘g‘ri action' };
  if (String(body.service_id) !== SERVICE_ID) return { error: -8, note: 'Service ID mos emas' };
  if (!body.click_trans_id || !body.merchant_trans_id || !body.amount || !body.sign_time || !body.sign_string) {
    return { error: -8, note: 'So‘rov maydonlari to‘liq emas' };
  }
  if (!secureEqual(signature(body, action === 1), body.sign_string)) {
    return { error: -1, note: 'Imzo noto‘g‘ri' };
  }
  return null;
}

export async function handleClickPrepare(body) {
  const invalid = validate(body, 0);
  if (invalid) return response(body, invalid.error, invalid.note);
  const orderId = validOrderId(body.merchant_trans_id);
  if (!orderId) return response(body, -5, 'Buyurtma topilmadi');
  const order = await getWebOrder(orderId);
  if (!order || order.paymentProvider !== 'click') return response(body, -5, 'Buyurtma topilmadi');
  if (order.status === 'paid') return response(body, -4, 'Buyurtma avval to‘langan');
  if (order.status !== 'pending') return response(body, -9, 'Buyurtma bekor qilingan');
  if (!sameAmount(body.amount, order.price)) return response(body, -2, 'Summa mos emas');

  const duplicate = await getWebOrderByClickTransactionId(String(body.click_trans_id));
  if (duplicate && duplicate.id !== order.id) return response(body, -8, 'Click tranzaksiyasi boshqa buyurtmaga tegishli');
  if (order.clickTransactionId && order.clickTransactionId !== String(body.click_trans_id)) {
    return response(body, -8, 'Buyurtma boshqa Click tranzaksiyasiga biriktirilgan');
  }

  // Click prepare ID sifatida ichki buyurtma ID ishlatiladi: barqaror,
  // 32-bit integer va retry qilinganda ham o'zgarmaydi.
  const prepared = await setWebOrderClickPrepared(order.id, {
    clickPrepareId: order.clickPrepareId || order.id,
    clickTransactionId: String(body.click_trans_id),
    clickPaydocId: body.click_paydoc_id,
  });
  if (!prepared) return response(body, -7, 'Buyurtmani tayyorlab bo‘lmadi');
  return response({ ...body, merchant_prepare_id: prepared.clickPrepareId }, 0, 'Success');
}

export async function handleClickComplete(body) {
  const invalid = validate(body, 1);
  if (invalid) return response(body, invalid.error, invalid.note);
  const prepareId = validOrderId(body.merchant_prepare_id);
  if (!prepareId) return response(body, -6, 'Prepare topilmadi');
  const order = await getWebOrderByClickPrepareId(prepareId);
  if (!order || order.paymentProvider !== 'click' || String(order.id) !== String(body.merchant_trans_id)) {
    return response(body, -6, 'Prepare topilmadi');
  }
  if (order.status === 'paid') return response(body, -4, 'Buyurtma avval to‘langan');
  if (order.status !== 'pending') return response(body, -9, 'Buyurtma bekor qilingan');
  if (!sameAmount(body.amount, order.price)) return response(body, -2, 'Summa mos emas');
  if (order.clickTransactionId !== String(body.click_trans_id)) return response(body, -8, 'Click tranzaksiyasi mos emas');

  if (Number(body.error) < 0) {
    await cancelPendingWebOrder(order.id);
    return response(body, -9, 'To‘lov bekor qilingan');
  }
  await finalizePaidWebOrder(order.id);
  return response(body, 0, 'Success');
}
