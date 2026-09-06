import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CompanyScreen } from './CompanyScreen';
import { PremiumButton } from '../../design-system/components/PremiumButton';
import { color, radius, space, type as typeTokens } from '../../design-system/tokens';

export const TOTAL_STEPS = 5;

export const STEP_TITLE: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Company ID', subtitle: 'Kompaniyangizning qisqa nomi. Uzunligi tarifni belgilaydi.' },
  2: { title: "Biznes ma'lumotlari", subtitle: 'Mijoz sahifada ko‘radigan asosiy ma’lumotlar.' },
  3: { title: 'Brend', subtitle: 'Logotip va muqova — ikkalasi ham ixtiyoriy.' },
  4: { title: 'Aloqa kanallari', subtitle: 'Faqat siz kiritgan kanallar sahifada tugma bo‘lib chiqadi.' },
  5: { title: 'Tekshirib yuborish', subtitle: 'Hammasi joyidami? Yuborilgach ko‘rib chiqishga tushadi.' },
};

export interface CompanyStepShellProps {
  step: number;
  onBack?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** Optional second footer action (e.g. "O'tkazib yuborish" on optional steps). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  children: React.ReactNode;
}

/**
 * Shared chrome for the 5-step creation flow: one progress rail, one step
 * heading, one sticky footer. Every step looks and behaves identically, so
 * the flow reads as a guided sequence instead of five separate forms.
 *
 * Nothing is created server-side until Step 5 — going back is always free.
 */
export function CompanyStepShell({
  step,
  onBack,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel,
  onSecondary,
  children,
}: CompanyStepShellProps) {
  const heading = STEP_TITLE[step];

  return (
    <CompanyScreen
      title="Yangi kompaniya"
      onBack={onBack}
      footer={
        <>
          <PremiumButton
            label={primaryLabel}
            onPress={onPrimary}
            disabled={primaryDisabled}
            loading={primaryLoading}
          />
          {secondaryLabel && onSecondary ? (
            <PremiumButton label={secondaryLabel} variant="ghost" onPress={onSecondary} />
          ) : null}
        </>
      }
    >
      <View style={styles.progressBlock}>
        <View style={styles.segments}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.segment,
                i + 1 < step && styles.segmentDone,
                i + 1 === step && styles.segmentCurrent,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepCounter}>
          Qadam {step} / {TOTAL_STEPS}
        </Text>
      </View>

      {heading ? (
        <View style={styles.heading}>
          <Text style={styles.title}>{heading.title}</Text>
          <Text style={styles.subtitle}>{heading.subtitle}</Text>
        </View>
      ) : null}

      {children}
    </CompanyScreen>
  );
}

const styles = StyleSheet.create({
  progressBlock: { gap: space.sm },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: color.surfaceHigh },
  segmentDone: { backgroundColor: color.goldDark },
  segmentCurrent: { backgroundColor: color.gold },
  stepCounter: { ...typeTokens.overline, color: color.textTertiary },
  heading: { gap: space.xs, marginTop: -space.sm },
  title: { ...typeTokens.h1, color: color.textPrimary },
  subtitle: { ...typeTokens.body, color: color.textSecondary },
});
