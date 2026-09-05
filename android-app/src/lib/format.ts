/** Number/date formatting helpers - Uzbek locale conventions matching the web app. */

/* ru-RU's thousands separator renders as U+00A0 (non-breaking space) on
 * Hermes/ICU, not a comma. Built via String.fromCharCode (not a literal
 * character typed in source) so the separator codepoints are unambiguous. */
const NBSP = String.fromCharCode(160);
const NARROW_NBSP = String.fromCharCode(8239);
const THOUSANDS_SEPARATORS_RE = new RegExp('[,' + NBSP + NARROW_NBSP + ']', 'g');

export function formatSom(amount: number | null | undefined): string {
  if (amount == null) return 'N/A';
  return Math.round(amount).toLocaleString('ru-RU').replace(THOUSANDS_SEPARATORS_RE, ' ') + " so'm";
}

export function formatCount(n: number | null | undefined): string {
  if (n == null) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

export function timeAgo(timestampMs: number): string {
  const diff = Date.now() - timestampMs;
  const min = 60000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return 'hozirgina';
  if (diff < hour) return Math.floor(diff / min) + ' daqiqa oldin';
  if (diff < day) return Math.floor(diff / hour) + ' soat oldin';
  return Math.floor(diff / day) + ' kun oldin';
}

/* Countdown against a server timestamp (`endsAt`). See android/docs/02-API_MAP.md
 * section 2.4 - this is intentionally computed against device time, matching
 * (and flagging, not silently improving on) the web app's own behavior. */
export function formatCountdown(endsAtIso: string, nowMs: number = Date.now()): string {
  const end = new Date(endsAtIso).getTime();
  const remaining = Math.max(0, end - nowMs);
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return pad(h) + ':' + pad(m) + ':' + pad(s);
}
