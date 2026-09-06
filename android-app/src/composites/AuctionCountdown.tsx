import React, { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';
import { countdownState } from '../lib/format';
import { color, type as typeTokens } from '../design-system/tokens';

export interface AuctionCountdownProps {
  endsAt: unknown;
  style?: TextStyle;
  /** Marks the countdown as urgent (red) under this many ms remaining. */
  urgentUnderMs?: number;
}

const DEFAULT_URGENT_MS = 60 * 60 * 1000; // 1 hour

/**
 * Ticks once a second against the server-provided `endsAt` timestamp. See
 * android/docs/02-API_MAP.md §2.4's honest caveat: this is computed against
 * *device* time (no server-time-offset endpoint exists anywhere in the
 * backend) — matching, not silently "fixing", the web app's own behavior.
 *
 * A missing or malformed `endsAt` renders "Vaqt noma'lum", never `NaN:NaN:NaN`
 * — `countdownState` is the single guard (src/lib/format.ts). The interval
 * also stops once the deadline is reached or known-unparseable, so an ended
 * auction list isn't re-rendering every second forever.
 */
export function AuctionCountdown({ endsAt, style, urgentUnderMs = DEFAULT_URGENT_MS }: AuctionCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const state = countdownState(endsAt, now);

  const live = state.kind === 'running';
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const tone =
    state.kind === 'running'
      ? state.remainingMs <= urgentUnderMs
        ? color.live
        : color.gold
      : color.textTertiary;

  return <Text style={[typeTokens.mono, { color: tone }, style]}>{state.text}</Text>;
}
