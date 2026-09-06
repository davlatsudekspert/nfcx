/** Number/date formatting helpers - Uzbek locale conventions matching the web app.
 *
 * Every function here is defensive by contract: production UI must never show
 * `NaN`, `undefined`, `null` or `[object Object]`, so anything unparseable
 * degrades to a readable placeholder instead of leaking through to the screen.
 */

/* ru-RU's thousands separator renders as U+00A0 (non-breaking space) on
 * Hermes/ICU, not a comma. Built via String.fromCharCode (not a literal
 * character typed in source) so the separator codepoints are unambiguous. */
const NBSP = String.fromCharCode(160);
const NARROW_NBSP = String.fromCharCode(8239);
const THOUSANDS_SEPARATORS_RE = new RegExp('[,' + NBSP + NARROW_NBSP + ']', 'g');

/** Coerces anything the backend might send (number, numeric string, null,
 * NaN, Infinity) into a finite number, or null when it isn't one. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function formatSom(amount: unknown): string {
  const n = toFiniteNumber(amount);
  if (n == null) return '—';
  return Math.round(n).toLocaleString('ru-RU').replace(THOUSANDS_SEPARATORS_RE, ' ') + " so'm";
}

export function formatCount(value: unknown): string {
  const n = toFiniteNumber(value);
  if (n == null) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

/** Parses an ISO timestamp (or epoch ms) into epoch ms, or null when the
 * value is missing/malformed — the single guard every countdown and date
 * label goes through, so a bad `endsAt` can never render as `NaN:NaN:NaN`. */
export function parseTimestampMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function timeAgo(timestampMs: unknown): string {
  const ts = parseTimestampMs(timestampMs);
  if (ts == null) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return 'hozirgina';
  const min = 60000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return 'hozirgina';
  if (diff < hour) return Math.floor(diff / min) + ' daqiqa oldin';
  if (diff < day) return Math.floor(diff / hour) + ' soat oldin';
  return Math.floor(diff / day) + ' kun oldin';
}

/** Absolute date/time in the device's own timezone (the backend sends UTC
 * ISO strings; `toLocaleString` converts, so a user in UZT sees UZT). */
export function formatDateTime(value: unknown): string {
  const ms = parseTimestampMs(value);
  if (ms == null) return '—';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type CountdownState =
  /** A real, future deadline — `text` is HH:MM:SS (or D kun HH:MM when far out). */
  | { kind: 'running'; text: string; remainingMs: number }
  /** The deadline has passed. */
  | { kind: 'ended'; text: string }
  /** The backend sent no deadline, or one that cannot be parsed. */
  | { kind: 'unknown'; text: string };

/**
 * Countdown against a server timestamp (`endsAt`). See android/docs/02-API_MAP.md
 * section 2.4 - computed against device time, matching (and flagging, not
 * silently improving on) the web app's own behavior.
 *
 * Returns a discriminated state rather than a bare string so callers can style
 * "ended" and "unknown" differently — and so a malformed `endsAt` surfaces as
 * an honest "Vaqt noma'lum" instead of `NaN:NaN:NaN`.
 */
export function countdownState(endsAt: unknown, nowMs: number = Date.now()): CountdownState {
  const end = parseTimestampMs(endsAt);
  if (end == null) return { kind: 'unknown', text: "Vaqt noma'lum" };
  const remaining = end - nowMs;
  if (remaining <= 0) return { kind: 'ended', text: 'Tugagan' };
  return { kind: 'running', text: formatRemaining(remaining), remainingMs: remaining };
}

function formatRemaining(remainingMs: number): string {
  const totalSec = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days} kun ${pad(h)}:${pad(m)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Back-compat string form. Never returns NaN — an unparseable input yields
 * a placeholder, and a passed deadline yields 00:00:00. */
export function formatCountdown(endsAtIso: unknown, nowMs: number = Date.now()): string {
  const state = countdownState(endsAtIso, nowMs);
  if (state.kind === 'running') return state.text;
  if (state.kind === 'ended') return '00:00:00';
  return "Vaqt noma'lum";
}

/** Renders any backend value as safe display text — never `undefined`,
 * `null`, `NaN` or `[object Object]`. */
export function safeText(value: unknown, fallback = '—'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value.trim() === '' ? fallback : value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === 'boolean') return value ? 'Ha' : "Yo'q";
  return fallback;
}
