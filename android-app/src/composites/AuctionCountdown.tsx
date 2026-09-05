import React, { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';
import { formatCountdown } from '../lib/format';
import { color, type as typeTokens } from '../design-system/tokens';

export interface AuctionCountdownProps {
  endsAt: string;
  style?: TextStyle;
}

/**
 * Ticks once a second against the server-provided `endsAt` timestamp. See
 * android/docs/02-API_MAP.md §2.4's honest caveat: this is computed against
 * *device* time (no server-time-offset endpoint exists anywhere in the
 * backend) — matching, not silently "fixing", the web app's own behavior.
 *
 * `now` is tracked as state (rather than calling `Date.now()` directly in
 * the render body) so every value the render reads is a plain prop/state
 * snapshot — no impure calls during render.
 */
export function AuctionCountdown({ endsAt, style }: AuctionCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ended = new Date(endsAt).getTime() <= now;

  return (
    <Text style={[typeTokens.mono, { color: ended ? color.textTertiary : color.gold }, style]}>
      {ended ? 'Tugagan' : formatCountdown(endsAt, now)}
    </Text>
  );
}
