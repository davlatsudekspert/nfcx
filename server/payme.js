// Payme Merchant API integratsiyasi — barcha real to'lovlar shu orqali:
// vizitka xaridi, jismoniy karta, auksion, Premium profil, Premium obuna.
//
// Kerakli env'lar (Railway Variables):
//   PAYME_MERCHANT_ID  - Payme Business kabinetidan (Cassa ID)
//   PAYME_KEY          - kabinetdagi test/ishlab chiqarish kaliti
//
// Kabinetda "Callback URL": https://<domen>/api/pay/payme
//
// Rasmiy protokol: JSON-RPC 2.0, Basic auth (login: "Paycom", parol: PAYME_KEY).
// Metodlar: CheckPerformTransaction, CreateTransaction, PerformTransaction,
// CancelTransaction, CheckTransaction, GetStatement.
// Hujjat: https://developer.help.paycom.uz/

import {
  getWebOrder, getWebOrderByPaymeId, setWebOrderPaymeId,
  finalizePaidWebOrder, cancelPendingWebOrder,
} from './db.js';
import crypto from 'crypto';

const MERCHANT_ID = process.env.PAYME_MERCHANT_ID || '';
const KEY = process.env.PAYME_KEY || '';

export function paymeEnabled() {
  return Boolean(MERCHANT_ID && KEY);
}

// Checkout havolasi: base64({m, ac.order_id, a}) formatida.
export function paymeCheckoutLink(orderId, amountSom) {
  if (!MERCHANT_ID || !orderId) return '';
  const tiyin = Math.round(Number(amountSom) * 100);
  const params = `m=${MERCHANT_ID};ac.order_id=${orderId};a=${tiyin}`;
  const b64 = Buffer.from(params, 'utf8').toString('base64');
  return `https://checkout.paycom.uz/${b64}`;
}

function safeEqual(a, b) {
  try {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function verifyPaymeAuth(req) {
  if (!KEY) return false;
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
  const login = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  return login === 'Paycom' && safeEqual(pass, KEY);
}

// Payme xatolik kodlari (rasmiy hujjatga mos).
const ERR = {
  INVALID_AMOUNT: -31001,
  ACCOUNT_NOT_FOUND: -31050,
  CANT_DO_OPERATION: -31008,
  TRANSACTION_NOT_FOUND: -31003,
  CANT_CANCEL: -31007,
  SYSTEM: -32400,
};

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message: { ru: message, uz: message, en: message } } };
}
function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

// PerformTransaction state: 1 = yaratilgan, 2 = to'langan, -1/-2 = bekor qilingan.
export async function handlePaymeRequest(body) {
  const { method, params, id } = body || {};
  const orderId = Number(params?.account?.order_id);

  try {
    switch (method) {
      case 'CheckPerformTransaction': {
        if (!orderId) return rpcError(id, ERR.ACCOUNT_NOT_FOUND, "Buyurtma topilmadi");
        const order = await getWebOrder(orderId);
        if (!order || order.status !== 'pending') return rpcError(id, ERR.ACCOUNT_NOT_FOUND, "Buyurtma topilmadi yoki allaqachon yopilgan");
        const expected = Math.round(Number(order.price) * 100);
        if (Number(params.amount) !== expected) return rpcError(id, ERR.INVALID_AMOUNT, "Summa mos emas");
        return rpcResult(id, { allow: true });
      }

      case 'CreateTransaction': {
        if (!orderId) return rpcError(id, ERR.ACCOUNT_NOT_FOUND, "Buyurtma topilmadi");
        const order = await getWebOrder(orderId);
        if (!order) return rpcError(id, ERR.ACCOUNT_NOT_FOUND, "Buyurtma topilmadi");

        // Idempotentlik: bu Payme tranzaksiyasi bilan avval yaratilgan bo'lsa — o'sha javobni qaytaramiz.
        const existing = await getWebOrderByPaymeId(params.id);
        if (existing) {
          return rpcResult(id, {
            create_time: new Date(existing.createdAt).getTime(),
            transaction: String(existing.id),
            state: existing.status === 'paid' ? 2 : existing.status === 'cancelled' ? -1 : 1,
          });
        }
        if (order.status !== 'pending') return rpcError(id, ERR.CANT_DO_OPERATION, "Buyurtma band emas");
        const expected = Math.round(Number(order.price) * 100);
        if (Number(params.amount) !== expected) return rpcError(id, ERR.INVALID_AMOUNT, "Summa mos emas");

        await setWebOrderPaymeId(order.id, params.id);
        return rpcResult(id, {
          create_time: Date.now(),
          transaction: String(order.id),
          state: 1,
        });
      }

      case 'PerformTransaction': {
        const order = await getWebOrderByPaymeId(params.id);
        if (!order) return rpcError(id, ERR.TRANSACTION_NOT_FOUND, "Tranzaksiya topilmadi");
        if (order.status === 'paid') {
          return rpcResult(id, { transaction: String(order.id), perform_time: Date.now(), state: 2 });
        }
        if (order.status !== 'pending') return rpcError(id, ERR.CANT_DO_OPERATION, "Amalni bajarib bo'lmaydi");
        // Buyurtma turiga (kind) qarab to'g'ri mantiq bajariladi: karta
        // yaratish, auksionni yakunlash, Premium faollashtirish yoki
        // obuna to'lovini hisoblash — hammasi shu bitta joyda.
        await finalizePaidWebOrder(order.id);
        return rpcResult(id, {
          transaction: String(order.id),
          perform_time: Date.now(),
          state: 2,
        });
      }

      case 'CancelTransaction': {
        const order = await getWebOrderByPaymeId(params.id);
        if (!order) return rpcError(id, ERR.TRANSACTION_NOT_FOUND, "Tranzaksiya topilmadi");
        const wasPaid = order.status === 'paid';
        if (!wasPaid) await cancelPendingWebOrder(order.id);
        // Agar allaqachon 'paid' bo'lgan bo'lsa (masalan karta yaratilgan,
        // auksion yakunlangan) — bu yerda avtomatik "orqaga qaytarish"
        // qilinmaydi, chunki bog'liq holatlar (karta egasi, auksion
        // natijasi) allaqachon boshqa foydalanuvchilarga ta'sir qilgan
        // bo'lishi mumkin. Bunday holatni admin qo'lda ko'rib chiqadi.
        return rpcResult(id, {
          transaction: String(order.id),
          cancel_time: Date.now(),
          state: wasPaid ? -2 : -1,
        });
      }

      case 'CheckTransaction': {
        const order = await getWebOrderByPaymeId(params.id);
        if (!order) return rpcError(id, ERR.TRANSACTION_NOT_FOUND, "Tranzaksiya topilmadi");
        return rpcResult(id, {
          create_time: new Date(order.createdAt).getTime(),
          perform_time: order.status === 'paid' ? new Date(order.createdAt).getTime() : 0,
          cancel_time: order.status === 'cancelled' ? Date.now() : 0,
          transaction: String(order.id),
          state: order.status === 'paid' ? 2 : order.status === 'cancelled' ? -1 : 1,
          reason: null,
        });
      }

      case 'GetStatement': {
        return rpcResult(id, { transactions: [] });
      }

      default:
        return rpcError(id, -32601, 'Metod topilmadi');
    }
  } catch (err) {
    console.error('[payme]', method, err.message);
    return rpcError(id, ERR.SYSTEM, 'Tizim xatoligi');
  }
}
