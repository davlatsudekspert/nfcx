/**
 * Copy for the entry (login) experience — the app's storefront.
 *
 * EVERY claim below is lifted from the production website's own published
 * copy, with the source file named on each entry. Nothing is invented: no
 * statistics, no user counts, no testimonials, no ratings, no features the
 * business does not already advertise. If a line cannot be traced to a
 * source file it does not belong in this module.
 *
 * Prices are never written down here — they are read from
 * `src/lib/pricing.ts` (`TIER_PRICE`, the same table the web app uses) and
 * rendered through `formatSom`, so a price change in one place changes the
 * entry screen too, and an unset price can never surface as `NaN`.
 */
import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';
import type { TierKey } from '../../lib/codeTiers';
import { TIER_LABEL, TIER_PRICE } from '../../lib/pricing';
import { formatSom } from '../../lib/format';

type FeatherName = ComponentProps<typeof Feather>['name'];

export interface EntryBenefit {
  key: string;
  icon: FeatherName;
  title: string;
  text: string;
}

/**
 * "NFC nima beradi?" — five things the business already promises publicly.
 *
 * 1. tap-to-open ...... src/pages/HowItWorksPage.jsx STEPS.uz[1..2]
 * 2. no app needed .... src/pages/HowItWorksPage.jsx STEPS.uz[1],
 *                       src/pages/HomePage.jsx ("Telefon ilovasi shart emas")
 * 3. one profile ...... src/pages/HomePage.jsx hero paragraph
 * 4. save the contact . src/pages/HowItWorksPage.jsx STEPS.uz[3],
 *                       src/pages/HomePage.jsx (".VCF formatida saqlash")
 * 5. stays editable ... src/pages/FaqPage.jsx FAQ.uz[0]
 */
export const ENTRY_BENEFITS: readonly EntryBenefit[] = [
  {
    key: 'tap',
    icon: 'zap',
    title: 'Bir tegish yetarli',
    text: 'Kartani telefonning orqa qismiga tuting — raqamli profilingiz o‘zi ochiladi.',
  },
  {
    key: 'no-app',
    icon: 'smartphone',
    title: 'Ilova o‘rnatish shart emas',
    text: 'Suhbatdoshingizga hech narsa yuklab olish kerak emas — profil brauzerda ochiladi.',
  },
  {
    key: 'one-link',
    icon: 'link',
    title: 'Hamma narsa bitta profilda',
    text: 'Telefon raqamingiz, ijtimoiy tarmoqlaringiz va saytingiz bir joyda jamlanadi.',
  },
  {
    key: 'save-contact',
    icon: 'user-plus',
    title: 'Kontakt bir tugmada saqlanadi',
    text: 'Aloqa ma’lumotlaringiz suhbatdoshingiz telefoniga .VCF ko‘rinishida yoziladi.',
  },
  {
    key: 'editable',
    icon: 'edit-3',
    title: 'Karta tayyor bo‘lgach ham yangilanadi',
    text: 'Ism, kasb, rasm va ijtimoiy tarmoqlarni istalgan vaqt tahrirlaysiz.',
  },
];

export interface EntryStep {
  key: string;
  n: string;
  title: string;
  text: string;
}

/**
 * "Qanday ishlaydi" — the site's own short three-step version.
 * Step 1 ... src/pages/HomePage.jsx (kod tekshirish: 3 harf + 3 raqam, masalan ABZ007)
 * Step 2 ... src/pages/HowItWorksPage.jsx STEPS.uz[0]
 * Step 3 ... src/pages/HomePage.jsx "3 oddiy qadam" bloki
 */
export const ENTRY_STEPS: readonly EntryStep[] = [
  {
    key: 'choose',
    n: '01',
    title: 'NFC ID tanlang',
    text: '3 harf + 3 raqam kiriting (masalan ABZ007) — bo‘sh yoki bandligi darhol ko‘rinadi.',
  },
  {
    key: 'profile',
    n: '02',
    title: 'Profilingizni to‘ldiring',
    text: 'Ism, kasb, telefon, ijtimoiy tarmoqlar va saytingizni kiriting.',
  },
  {
    key: 'tap',
    n: '03',
    title: 'Kartani teging',
    text: 'Kartani telefonga yaqinlashtiring — profilingiz brauzerda ochiladi.',
  },
];

export interface EntryTier {
  key: TierKey;
  /** Tier name — `TIER_LABEL`, the same table the web app renders. */
  label: string;
  /** Why a code lands in this tier — src/pages/PricingPage.jsx TIER_HINT.uz. */
  hint: string;
  /** A pattern example — src/pages/PricingPage.jsx EXAMPLES.uz. */
  sampleCode: string;
  /** Formatted price, or the auction note when the tier has no fixed price. */
  priceText: string;
}

/** Ordered most exclusive first, mirroring the website's pricing table. */
const TIER_ORDER: readonly TierKey[] = ['exclusive', 'premium', 'gold', 'silver', 'free'];

/** src/pages/PricingPage.jsx → TIER_HINT.uz (verbatim). */
const TIER_HINT: Record<TierKey, string> = {
  exclusive: 'Noyob ID’lar uchun auksion',
  premium: 'Eng noyob va maxsus kombinatsiyalar',
  gold: 'Chiroyli va tanilgan kombinatsiyalar',
  silver: 'Esda qoladigan raqamlar',
  free: 'Boshlash uchun yetarli',
};

/** src/pages/PricingPage.jsx → EXAMPLES.uz (verbatim codes). */
const TIER_SAMPLE: Record<TierKey, string> = {
  exclusive: 'VIP001',
  premium: 'BMW007',
  gold: 'XYZ007',
  silver: 'LOL101',
  free: 'MXK413',
};

/**
 * `TIER_PRICE.exclusive` is intentionally `null` — an exclusive ID has no
 * fixed price because it is sold only at auction (src/pages/HomePage.jsx:
 * "faqat auksion orqali sotiladi"). That null is rendered as words, never
 * pushed through `formatSom` as a number that isn't there.
 */
export const ENTRY_TIERS: readonly EntryTier[] = TIER_ORDER.map((key) => ({
  key,
  label: TIER_LABEL[key],
  hint: TIER_HINT[key],
  sampleCode: TIER_SAMPLE[key],
  priceText: TIER_PRICE[key] == null ? 'Auksionda' : formatSom(TIER_PRICE[key]),
}));

/** src/pages/FaqPage.jsx FAQ.uz[1] — price depends only on the pattern. */
export const TIER_SECTION_NOTE =
  'Narx band qilingan ID’lar soniga emas, faqat harf/raqam naqshiga bog‘liq.';

/** src/pages/HomePage.jsx — exclusive codes are auction-only. */
export const TIER_AUCTION_NOTE = 'Ekslyuziv ID’lar faqat auksion orqali sotiladi.';
