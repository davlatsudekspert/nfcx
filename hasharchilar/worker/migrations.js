// Durable Object rejimi uchun migratsiyalar: migrations/*.sql matn moduli sifatida bundle'ga kiradi
// (wrangler.jsonc → rules: **/*.sql = Text). D1 rejimida esa `wrangler d1 migrations apply` ishlatiladi.
// Yangi migrations/NNNN_*.sql qo'shilsa — shu ro'yxatga ham qo'shing (tests/storage.test.mjs tekshiradi).
import m0001 from '../migrations/0001_init.sql';

/** Tartib muhim: nomi bo'yicha o'sish (D1 dagi kabi). */
export const MIGRATIONS = [{ name: '0001_init.sql', sql: m0001 }];
