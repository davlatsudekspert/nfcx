import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PremiumEmptyState } from './PremiumEmptyState';
import { PremiumCard } from './PremiumCard';
import { ApiError } from '../../api/client';
import { space } from '../tokens';

export interface PremiumQueryStateProps {
  /** react-query flags, passed straight through. */
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  /** True when the request succeeded but produced nothing to show. */
  isEmpty?: boolean;
  onRetry?: () => void;
  /** Called when the failure is an expired/absent session, so the screen can
   * route the user to Login instead of showing a dead error card. */
  onUnauthorized?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ComponentProps<typeof PremiumEmptyState>['icon'];
  emptyCtaLabel?: string;
  onPressEmptyCta?: () => void;
  /** How many skeleton rows to show while loading. */
  skeletonRows?: number;
  skeletonHeight?: number;
  children?: React.ReactNode;
}

/**
 * The one place loading / error / offline / session-expired / empty are
 * rendered, so every data screen in the app behaves identically (brief §20)
 * and no screen can accidentally ship a blank dead view or a raw backend
 * error string.
 *
 * Renders `children` only once the data is actually there.
 */
export function PremiumQueryState({
  isLoading = false,
  isError = false,
  error,
  isEmpty = false,
  onRetry,
  onUnauthorized,
  emptyTitle = "Ma'lumot yo'q",
  emptyDescription,
  emptyIcon = 'inbox',
  emptyCtaLabel,
  onPressEmptyCta,
  skeletonRows = 3,
  skeletonHeight = 96,
  children,
}: PremiumQueryStateProps) {
  if (isLoading) {
    return (
      <View style={styles.skeletonWrap}>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <PremiumCard key={i} loading style={{ height: skeletonHeight }} />
        ))}
      </View>
    );
  }

  if (isError) {
    const view = describeError(error);
    if (view.kind === 'unauthorized' && onUnauthorized) {
      return (
        <PremiumEmptyState
          icon="log-in"
          title={view.title}
          description={view.description}
          ctaLabel="Kirish"
          onPressCta={onUnauthorized}
        />
      );
    }
    return (
      <PremiumEmptyState
        icon={view.icon}
        title={view.title}
        description={view.description}
        ctaLabel={onRetry ? 'Qayta urinish' : undefined}
        onPressCta={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <PremiumEmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        ctaLabel={emptyCtaLabel}
        onPressCta={onPressEmptyCta}
      />
    );
  }

  return <>{children}</>;
}

type ErrorView = {
  kind: 'offline' | 'unauthorized' | 'server' | 'generic';
  icon: React.ComponentProps<typeof PremiumEmptyState>['icon'];
  title: string;
  description: string;
};

/**
 * Maps any thrown value to user-facing copy. `ApiError.message` is already
 * Uzbek copy from `ERROR_COPY` (src/api/types.ts) — raw technical strings,
 * stack traces and `[object Object]` never reach the UI.
 */
export function describeError(error: unknown): ErrorView {
  if (error instanceof ApiError) {
    if (error.code === 'network_error' || error.status === 0) {
      return {
        kind: 'offline',
        icon: 'wifi-off',
        title: 'Internet aloqasi yo‘q',
        description: 'Ulanishni tekshiring va qayta urining.',
      };
    }
    if (error.status === 401 || error.code === 'unauthorized') {
      return {
        kind: 'unauthorized',
        icon: 'log-in',
        title: 'Sessiya tugadi',
        description: 'Davom etish uchun qaytadan kiring.',
      };
    }
    if (error.status >= 500) {
      return {
        kind: 'server',
        icon: 'alert-triangle',
        title: 'Xizmat vaqtincha mavjud emas',
        description: error.message,
      };
    }
    return { kind: 'generic', icon: 'alert-circle', title: 'Xatolik', description: error.message };
  }
  return {
    kind: 'generic',
    icon: 'alert-circle',
    title: 'Xatolik yuz berdi',
    description: 'Qayta urinib ko‘ring.',
  };
}

const styles = StyleSheet.create({
  skeletonWrap: { gap: space.md },
});
