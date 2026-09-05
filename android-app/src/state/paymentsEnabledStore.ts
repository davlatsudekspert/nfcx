/**
 * Global "are payments live" flag — the single source of truth every
 * payment CTA in the app reads from. NEVER hard-code true/false in a
 * component; see android/docs/01-AUDIT.md §1.6 item 2 and
 * 02-API_MAP.md §2.7. Polled at app start and on foreground.
 */
import { create } from 'zustand';
import { contentApi } from '../api/content';

interface PaymentsEnabledState {
  status: 'unknown' | 'enabled' | 'disabled';
  refresh: () => Promise<void>;
}

export const usePaymentsEnabledStore = create<PaymentsEnabledState>((set) => ({
  status: 'unknown',
  refresh: async () => {
    try {
      const { enabled } = await contentApi.paymentsEnabled();
      set({ status: enabled ? 'enabled' : 'disabled' });
    } catch {
      // Fail closed — if we can't confirm payments are live, treat every
      // CTA as disabled rather than risk showing an active-looking button
      // that will just 503.
      set({ status: 'disabled' });
    }
  },
}));
