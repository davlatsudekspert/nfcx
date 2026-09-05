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

export interface DraftPurchaseProfile {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

export type IdStackParamList = {
  IdSearch: undefined;
  PurchaseStep1: { code: string };
  PurchaseStep2: { code: string; profile: DraftPurchaseProfile };
  PurchaseStep3: { code: string; orderId: number; price: number; payLink: string | null };
  PurchaseResult: { code: string; orderId: number };
};

export type AuctionStackParamList = {
  AuctionList: undefined;
  AuctionDetail: { auctionId: number };
  AuctionPayment: { auctionId: number };
};

export interface DraftCompanyProfile {
  companyId: string;
  displayName: string;
  category: string;
  subcategory?: string;
  city: string;
  phone: string;
  description: string;
  address?: string;
  telegram?: string;
  whatsapp?: string;
  website?: string;
  logoUrl?: string;
  coverUrl?: string;
}

export type CompanyStackParamList = {
  CompanyHome: undefined;
  CompanyCreate1: undefined;
  CompanyCreate2: { draft: DraftCompanyProfile };
  CompanyCreate3: { draft: DraftCompanyProfile };
  CompanyCreate4: { draft: DraftCompanyProfile };
  CompanyCreate5: { draft: DraftCompanyProfile };
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
