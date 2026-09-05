import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PremiumHeader, type PremiumHeaderAction } from '../../design-system/components/PremiumHeader';
import { color, space } from '../../design-system/tokens';

export interface ScreenWithHeaderProps {
  title?: string;
  onBack?: () => void;
  actions?: PremiumHeaderAction[];
  scroll?: boolean;
  children: React.ReactNode;
}

/** Header + body in a single safe-area/scroll container — avoids nesting
 * two ScreenContainers (and therefore two SafeAreaViews) on screens that
 * need both chrome and scrollable content. */
export function ScreenWithHeader({ title, onBack, actions, scroll = true, children }: ScreenWithHeaderProps) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <PremiumHeader title={title} onBack={onBack} actions={actions} />
      <Body style={styles.flex} contentContainerStyle={scroll ? styles.padded : undefined}>
        {!scroll ? <View style={styles.padded}>{children}</View> : children}
      </Body>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  padded: { padding: space.lg, flexGrow: 1 },
});
