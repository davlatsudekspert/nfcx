import * as SecureStore from 'expo-secure-store';

/**
 * API klienti.
 *
 * Sayt `credentials: 'same-origin'` bilan HttpOnly cookie ishlatadi
 * (src/lib/auth.jsx). Mobilda cookie ishonchsiz — platformalar orasida
 * cookie jar farq qiladi, WebView bilan bo'linadi va background'dan
 * qaytganda yo'qoladi. Shuning uchun biz TOKEN ishlatamiz.
 *
 * Backend tomoni QO'LLANGAN va production'da tasdiqlangan:
 *   1) getCurrentUser() cookie bo'lmasa `Authorization: Bearer <token>`
 *      dan o'qiydi (cookie birinchi ustuvorlikda);
 *   2) /api/auth/login va register javob tanasida `token` qaytaradi —
 *      faqat `X-Client: mobile` sarlavhasi bo'lganda, shuning uchun veb
 *      javobi o'zgarmaydi.
 * Batafsili: docs/BEARER-AUTH-DIFF.md.
 *
 * Shu sababli tokenni `Set-Cookie` dan ajratib oladigan zaxira yo'l
 * OLIB TASHLANDI: server token bermasa bu haqiqiy nosozlik va u jim
 * yashirilmasligi kerak — `login()` va `register()` ikkalasi ham
 * `no_session_token` bilan to'xtaydi.
 */

export const API_BASE = 'https://nfcstore.uz/api';

const TOKEN_KEY = 'nfcstore.session';

/** Xotiradagi nusxa — har so'rovda SecureStore'ni qayta o'qimaslik uchun. */
let cachedToken: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Keystore yozib bo'lmasa ham sessiya shu ishga tushishda ishlaydi
    // (xotiradagi nusxa bor) — faqat ilova qayta ochilganda login
    // so'raladi.
  }
}

/**
 * Server xatolari — worker.js har doim `{error: '...'}` qaytaradi
 * (masalan `bad_credentials`, `phone_taken`, `unauthorized`,
 * `too_many_requests`). Ba'zan `error` o'zbekcha TAYYOR MATN bo'ladi
 * (validatsiya xabarlari) — shuning uchun kod ham, matn ham saqlanadi.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Tarif cheklovi javoblarida keladi (`{error, feature, limit}`). */
  readonly feature?: string;
  readonly limit?: number;

  constructor(status: number, code: string, feature?: string, limit?: number) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.feature = feature;
    this.limit = limit;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === 'unauthorized';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Token qo'shilmaydi — ochiq endpoint (masalan /api/tap/:chipToken). */
  anonymous?: boolean;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false, signal } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    // Backend shu sarlavha bo'yicha javob tanasiga token qo'shadi —
    // veb uchun hech narsa o'zgarmasligi uchun.
    'X-Client': 'mobile',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (!anonymous) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch {
    // Tarmoq uzilishi — saytdagi errText() bilan bir xil tarzda
    // "aloqa yo'q" sifatida ko'rsatiladi.
    throw new ApiError(0, 'network_error');
  }

  const data = (await res.json().catch(() => null)) as
    | (Record<string, unknown> & { error?: string; feature?: string; limit?: number })
    | null;

  if (!res.ok) {
    const code = typeof data?.error === 'string' ? data.error : `api_error_${res.status}`;
    throw new ApiError(
      res.status,
      code,
      typeof data?.feature === 'string' ? data.feature : undefined,
      typeof data?.limit === 'number' ? data.limit : undefined,
    );
  }

  return data as T;
}

export type AuthedUser = {
  id: number;
  email: string;
  phone: string | null;
  isPremium: boolean;
  trialExpiresAt?: string | null;
  premiumExpiresAt?: string | null;
  tgLinked?: boolean;
};

/** POST /api/auth/login — `{email | login, password}` ikkalasini ham qabul qiladi. */
export async function login(loginOrEmail: string, password: string): Promise<AuthedUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Client': 'mobile' },
    body: JSON.stringify({ login: loginOrEmail, password }),
  });
  const data = (await res.json().catch(() => null)) as
    | { user?: AuthedUser; token?: string; error?: string }
    | null;

  if (!res.ok) {
    throw new ApiError(res.status, typeof data?.error === 'string' ? data.error : `api_error_${res.status}`);
  }

  if (!data?.token) {
    // Sessiya serverda ochildi, lekin token bizga yetib kelmadi —
    // keyingi so'rov 401 bo'lardi. Jim qolib "kirdik" deb ko'rsatishdan
    // ko'ra aniq aytish yaxshi: bu backend nosozligi.
    throw new ApiError(500, 'no_session_token');
  }
  await setToken(data.token);
  if (!data.user) throw new ApiError(500, 'bad_login_response');
  return data.user;
}

/**
 * POST /api/auth/register — TEKSHIRILGAN hozirgi oqim
 * (hosting/api/auth.js, 2026-09): BIR QADAM, Telegram OTP YO'Q.
 *
 *   phone       majburiy  +?\d{9,15}
 *   password    majburiy  >= 6 belgi
 *   tosAccepted majburiy  true bo'lishi shart
 *   email       IXTIYORIY (bo'sh bo'lsa server ichki manzil yasaydi)
 *   promoCode   ixtiyoriy
 *
 * Yon effekt: server darhol bepul shaxsiy ID yaratadi (createFreeAutoId).
 */
export async function register(input: {
  phone: string;
  password: string;
  tosAccepted: true;
  email?: string;
  promoCode?: string;
}): Promise<AuthedUser> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Client': 'mobile' },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => null)) as
    | { user?: AuthedUser; token?: string; error?: string }
    | null;

  if (!res.ok) {
    throw new ApiError(res.status, typeof data?.error === 'string' ? data.error : `api_error_${res.status}`);
  }
  // Login bilan bir xil qat'iylik: ilgari bu yerda token yo'q bo'lsa jim
  // o'tib ketilardi va odam "ro'yxatdan o'tdim, lekin kirmaganman"
  // holatida qolardi.
  if (!data?.token) {
    throw new ApiError(500, 'no_session_token');
  }
  await setToken(data.token);
  if (!data.user) throw new ApiError(500, 'bad_register_response');
  return data.user;
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {
    // Server tokenni o'chirib bo'lmasa ham mahalliy tokenni tashlaymiz:
    // odam "chiqdim" deb o'ylab, aslida kirib turgan bo'lmasin.
  });
  await setToken(null);
}
