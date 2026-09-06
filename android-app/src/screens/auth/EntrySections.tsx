import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MetalSurface } from '../../design-system/components/MetalSurface';
import { PremiumCard } from '../../design-system/components/PremiumCard';
import { ContactButtons, type ContactButtonSpec } from '../../composites/ContactButtons';
import {
  color,
  metal,
  radius,
  space,
  touchTarget,
  type as typeTokens,
} from '../../design-system/tokens';
import {
  ENTRY_BENEFITS,
  ENTRY_STEPS,
  ENTRY_TIERS,
  TIER_AUCTION_NOTE,
  TIER_SECTION_NOTE,
} from './entryContent';
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_TELEGRAM_HANDLE,
  openSupportPhone,
  openSupportTelegram,
} from './supportContacts';

/**
 * The value-proposition half of the entry experience: everything a newcomer
 * sees above and below the login form.
 *
 * Design rules it obeys (android/docs/05-DESIGN_SYSTEM.md): deep black
 * floor, brushed metal for anything that represents a physical card, gold
 * only as a hairline or a small accent, and light that moves once on
 * entrance rather than continuously. Every surface is a gradient — no
 * images, no per-frame JS — so the whole page still scrolls at frame rate.
 *
 * All copy lives in `entryContent.ts`, where each line is traced back to the
 * production website that already publishes it.
 */

/* ------------------------------------------------------------------ */
/* Section chrome                                                      */
/* ------------------------------------------------------------------ */

export function SectionHeading({
  overline,
  title,
  subtitle,
}: {
  overline: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.heading}>
      <View style={styles.overlineRow}>
        <View style={styles.overlineRule} />
        <Text style={styles.overline}>{overline}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Brand hero                                                       */
/* ------------------------------------------------------------------ */

/**
 * The demo card face. `AAA000` / "SIZNING ISMINGIZ" are the exact
 * placeholders the website's own hero uses (src/pages/HomePage.jsx →
 * `NeonOrbitCard code="AAA000" name={t('SIZNING ISMINGIZ')}`) — a template,
 * deliberately not a real person's data.
 */
const DEMO_CODE = 'AAA000';

export function EntryHero({ onGoToForm }: { onGoToForm: () => void }) {
  const m = metal.exclusive;
  return (
    <View style={styles.hero}>
      <View style={styles.mark}>
        <Text style={styles.markText}>N</Text>
      </View>
      <Text style={styles.wordmark}>NFCSTORE</Text>
      <Text style={styles.promise}>Sizning raqamli profilingiz. Har doim yoningizda.</Text>
      <Text style={styles.promiseSub}>
        Telefon raqamingiz, ijtimoiy tarmoqlaringiz va saytingizni bitta profilda jamlang. NFC karta
        orqali ulashish esa bir necha soniya vaqt oladi.
      </Text>

      <MetalSurface tier="exclusive" cornerRadius={radius.xl} style={styles.heroCard}>
        <View style={styles.heroCardInner}>
          <View style={styles.heroCardTop}>
            <Text style={[styles.heroCardBrand, { color: m.subtext }]}>NFCSTORE</Text>
            <Feather name="wifi" size={18} color={m.subtext} style={styles.nfcGlyph} />
          </View>
          <View>
            <Text style={[styles.heroCardCode, { color: m.text }]}>{DEMO_CODE}</Text>
            <Text style={[styles.heroCardName, { color: m.subtext }]} numberOfLines={1}>
              SIZNING ISMINGIZ
            </Text>
          </View>
        </View>
      </MetalSurface>

      <View style={styles.chipRow}>
        <HeroChip label="Bir tegishda" />
        <HeroChip label="Ilova shart emas" />
        <HeroChip label="Kontaktni saqlash" />
      </View>

      <Pressable
        onPress={onGoToForm}
        accessibilityRole="button"
        accessibilityLabel="Hisobingiz bormi? Kirish"
        style={styles.jumpLink}
      >
        <Text style={styles.jumpLinkText}>Hisobingiz bormi? Kirish</Text>
        <Feather name="arrow-down" size={14} color={color.gold} />
      </Pressable>
    </View>
  );
}

function HeroChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Feather name="check" size={11} color={color.gold} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Benefits                                                         */
/* ------------------------------------------------------------------ */

export function BenefitList() {
  return (
    <View style={styles.stack}>
      {ENTRY_BENEFITS.map((b, i) => (
        <PremiumCard key={b.key} index={i} contentStyle={styles.benefitCard}>
          <View style={styles.benefitIcon}>
            <Feather name={b.icon} size={18} color={color.gold} />
          </View>
          <View style={styles.benefitBody}>
            <Text style={styles.benefitTitle}>{b.title}</Text>
            <Text style={styles.benefitText}>{b.text}</Text>
          </View>
        </PremiumCard>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 3. How it works                                                     */
/* ------------------------------------------------------------------ */

export function StepList() {
  return (
    <View style={styles.steps}>
      {ENTRY_STEPS.map((s, i) => (
        <View key={s.key} style={styles.stepRow}>
          <View style={styles.stepRail}>
            <View style={styles.stepDot}>
              <Text style={styles.stepDotText}>{s.n}</Text>
            </View>
            {i < ENTRY_STEPS.length - 1 && <View style={styles.stepLine} />}
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{s.title}</Text>
            <Text style={styles.stepText}>{s.text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Tier / price showcase                                            */
/* ------------------------------------------------------------------ */

export function TierShowcase() {
  return (
    <View style={styles.stack}>
      {ENTRY_TIERS.map((t, i) => {
        const m = metal[t.key];
        return (
          <MetalSurface key={t.key} tier={t.key} index={i} cornerRadius={radius.lg} style={styles.tierCard}>
            <View style={styles.tierInner}>
              <View style={styles.tierLeft}>
                <Text style={[styles.tierCode, { color: m.text }]}>{t.sampleCode}</Text>
                <Text style={[styles.tierHint, { color: m.subtext }]}>{t.hint}</Text>
              </View>
              <View style={styles.tierRight}>
                <Text style={[styles.tierLabel, { color: m.text }]}>{t.label}</Text>
                <Text style={[styles.tierPrice, { color: m.text }]}>{t.priceText}</Text>
              </View>
            </View>
          </MetalSurface>
        );
      })}
      <Text style={styles.tierNote}>{TIER_SECTION_NOTE}</Text>
      <Text style={styles.tierNote}>{TIER_AUCTION_NOTE}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Account access — the honest registration path                       */
/* ------------------------------------------------------------------ */

const SUPPORT_BUTTONS: ContactButtonSpec[] = [
  {
    key: 'telegram',
    icon: 'send',
    label: `Telegram · ${SUPPORT_TELEGRAM_HANDLE}`,
    onPress: openSupportTelegram,
  },
  {
    key: 'phone',
    icon: 'phone',
    label: SUPPORT_PHONE_DISPLAY,
    onPress: openSupportPhone,
  },
];

/**
 * The API exposes only `POST /api/auth/login`, `POST /api/auth/logout` and
 * `GET /api/auth/me` — there is no registration route at all (see
 * `src/config/remoteFlags.ts`). So instead of a signup form that cannot
 * succeed, this hands the newcomer the company's real published channels.
 * Stated calmly, as a fact about how accounts are opened today — not as an
 * error banner, which would read as "the app is broken".
 */
export function AccountAccessBlock({ note }: { note: string }) {
  return (
    <PremiumCard featured contentStyle={styles.accessCard}>
      <View style={styles.overlineRow}>
        <View style={styles.overlineRule} />
        <Text style={styles.overline}>Hisob ochish</Text>
      </View>
      <Text style={styles.accessText}>{note}</Text>
      <ContactButtons items={SUPPORT_BUTTONS} />
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  /* headings */
  heading: { marginBottom: space.lg },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  overlineRule: { width: 18, height: 1, backgroundColor: color.borderGoldStrong },
  overline: { ...typeTokens.overline, color: color.gold, textTransform: 'uppercase' },
  sectionTitle: { ...typeTokens.h1, color: color.textPrimary, marginTop: space.sm },
  sectionSubtitle: { ...typeTokens.body, color: color.textSecondary, marginTop: space.xs },

  /* hero */
  hero: { alignItems: 'center' },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: color.borderGoldStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.goldWash,
  },
  markText: { ...typeTokens.h1, fontSize: 28, color: color.gold },
  wordmark: {
    ...typeTokens.h1,
    color: color.textPrimary,
    letterSpacing: 4,
    marginTop: space.md,
  },
  promise: {
    ...typeTokens.h2,
    color: color.textPrimary,
    textAlign: 'center',
    marginTop: space.lg,
  },
  promiseSub: {
    ...typeTokens.body,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: space.sm,
  },
  heroCard: { alignSelf: 'stretch', minHeight: 168, marginTop: space.xl },
  heroCardInner: { flex: 1, padding: space.lg, justifyContent: 'space-between' },
  heroCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroCardBrand: { ...typeTokens.overline },
  nfcGlyph: { transform: [{ rotate: '90deg' }] },
  heroCardCode: { ...typeTokens.monoLarge, letterSpacing: 4 },
  heroCardName: { ...typeTokens.caption, letterSpacing: 2, marginTop: space.xs },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  chipText: { ...typeTokens.caption, color: color.textSecondary },

  jumpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: touchTarget,
    marginTop: space.sm,
    paddingHorizontal: space.md,
  },
  jumpLinkText: { ...typeTokens.bodyStrong, color: color.gold },

  /* benefits */
  stack: { gap: space.md },
  benefitCard: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: color.goldWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitBody: { flex: 1 },
  benefitTitle: { ...typeTokens.h3, color: color.textPrimary },
  benefitText: { ...typeTokens.body, color: color.textSecondary, marginTop: space.xs },

  /* steps */
  steps: { gap: 0 },
  stepRow: { flexDirection: 'row', gap: space.lg },
  stepRail: { alignItems: 'center', width: 40 },
  stepDot: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.borderGold,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: { ...typeTokens.overline, color: color.gold },
  stepLine: { flex: 1, width: 1, minHeight: space.xl, backgroundColor: color.border },
  stepBody: { flex: 1, paddingBottom: space.xl },
  stepTitle: { ...typeTokens.h3, color: color.textPrimary },
  stepText: { ...typeTokens.body, color: color.textSecondary, marginTop: space.xs },

  /* tiers */
  tierCard: { minHeight: 84 },
  tierInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  tierLeft: { flex: 1 },
  tierCode: { ...typeTokens.mono, fontSize: 17, letterSpacing: 2 },
  tierHint: { ...typeTokens.caption, marginTop: space.xs },
  tierRight: { alignItems: 'flex-end' },
  tierLabel: { ...typeTokens.overline },
  tierPrice: { ...typeTokens.bodyStrong, marginTop: space.xs },
  tierNote: { ...typeTokens.caption, color: color.textTertiary },

  /* account access */
  accessCard: { gap: space.md },
  accessText: { ...typeTokens.body, color: color.textSecondary },
});
