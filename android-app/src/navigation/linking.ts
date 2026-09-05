import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Deep link / Android App Link mapping — mirrors the web app's routes
 * (src/App.jsx, src/lib/router.js). See android/docs/03-ARCHITECTURE.md §3.5.
 *
 * NOTE: the web app validates the catch-all `:code` segment against
 * `ROUTE_PROFILE_RE` (`/^(?:[A-Za-z]{3}[0-9]{3}|[0-9]{8}|[A-Za-z]{3,12})$/`)
 * and a RESERVED path set before treating it as a profile code. React
 * Navigation's static `path` matching here handles the common case (literal
 * segments like `auksion`, `company`, `c` are tried before the generic
 * `:code` fallback), but does not yet reproduce that exact regex — a custom
 * `getStateFromPath` implementing the same validation is a follow-up
 * refinement once Phase 9 (Personal Profile) needs airtight parity, not a
 * Phase 4 blocker.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://nfcstore.uz', 'nfcstore://'],
  config: {
    screens: {
      AuthFlow: { screens: { Login: 'login', Register: 'register' } },
      MainTabs: {
        screens: {
          HomeTab: {
            screens: {
              Home: '',
              PublicProfile: {
                path: ':code',
                parse: { code: (code: string) => code.toUpperCase() },
              },
            },
          },
          AuctionTab: {
            screens: {
              AuctionList: 'auksion',
              AuctionDetail: {
                path: 'auksion/:auctionId',
                parse: { auctionId: Number },
              },
            },
          },
          CompanyTab: {
            screens: {
              PublicCompany: {
                path: 'company/:companyId',
                parse: { companyId: (id: string) => id.toUpperCase() },
              },
            },
          },
        },
      },
    },
  },
};
