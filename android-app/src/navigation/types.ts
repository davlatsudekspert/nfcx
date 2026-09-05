import type { NavigatorScreenParams } from '@react-navigation/native';

/** Param lists for every stack — kept in one file so screens and the linking
 * config never drift. Matches the 29-screen inventory in
 * android/docs/04-SCREEN_MAP.md §4.1. */

export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  PublicProfile: { code: string; initialTab?: 'menu' | 'products' | 'services' | 'promotions' };
};

export type IdStackParamList = {
  IdSearch: undefined;
  PurchaseStep1: { code: string };
  PurchaseStep2: { code: string };
  PurchaseStep3: { code: string; orderId: number; price: number; payLink: string | null };
  PurchaseResult: { code: string; orderId: number };
};

export type AuctionStackParamList = {
  AuctionList: undefined;
  AuctionDetail: { auctionId: number };
  AuctionPayment: { auctionId: number };
};

export type CompanyStackParamList = {
  CompanyHome: undefined;
  CompanyCreate1: undefined;
  CompanyCreate2: { companyId: string };
  CompanyCreate3: { companyId: string };
  CompanyCreate4: { companyId: string };
  CompanyCreate5: { companyId: string };
  CompanyDashboard: { companyId: string };
  CatalogList: { companyId: string };
  PublicCompany: { companyId: string };
};

export type ProfileStackParamList = {
  MyProfile: undefined;
  ProfileEdit: undefined;
  Settings: undefined;
  Notifications: undefined;
  NfcRead: undefined;
};

/**
 * Each tab's param type is `NavigatorScreenParams<...>` (not `undefined`) so
 * cross-tab navigation — e.g. Home's notification bell jumping straight to
 * `ProfileTab > Notifications` — is fully type-checked, with no `as never`
 * escape hatches anywhere in the app.
 */
export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  IdTab: NavigatorScreenParams<IdStackParamList>;
  AuctionTab: NavigatorScreenParams<AuctionStackParamList>;
  CompanyTab: NavigatorScreenParams<CompanyStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  AuthFlow: undefined;
  MainTabs: undefined;
};
