import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';

/// BUSINESS OCHISH — KIRISH EKRANI.
///
/// Egasining talabi (2026-09, Play testerlari fikridan keyin):
/// "Business ochish" bosilganda odam darhol anketaga emas, avval
/// Business NIMA BERISHINI ko'rsin, keyin ikki yo'ldan birini
/// tanlasin:
///
///   1. BEPUL Business ID — ilova ichida ochiladi. Server buni
///      allaqachon qo'llardi (`POST /api/companies` + `auto: true`),
///      lekin ilova formasi faqat MAXSUS nom so'rardi va u 349 000
///      so'mdan boshlanardi. Tester buni "free biznes yo'q" deb
///      topdi — aynan shunday edi.
///   2. MAXSUS NOM / PREMIUM ID — nom ilovada tekshiriladi, xarid
///      esa SAYTDA. Ilovada to'lov yo'q (`store_policy.dart` dagi
///      Google Play qoidasi): sayt manzili MATN, bosiladigan havola
///      emas.
///
/// Bu vidjet ikki joyda: alohida ekran ([BusinessIntroScreen]) va
/// biznesi hali yo'q odamning Biznes bo'limi.
class BusinessIntroScreen extends StatelessWidget {
  const BusinessIntroScreen({super.key});

  @override
  Widget build(BuildContext context) => const NovaScaffold(
        showBack: true,
        body: BusinessIntroBody(),
      );
}

class BusinessIntroBody extends StatelessWidget {
  const BusinessIntroBody({super.key});

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;

    final features = <(IconData, String, String)>[
      (Icons.web_rounded, l.bizFeatSite, l.bizFeatSiteHint),
      (Icons.inventory_2_outlined, l.bizFeatCatalog, l.bizFeatCatalogHint),
      (Icons.nfc_rounded, l.bizFeatNfc, l.bizFeatNfcHint),
      (Icons.auto_awesome_motion_outlined, l.bizFeatContent,
          l.bizFeatContentHint),
      (Icons.insights_rounded, l.bizFeatAnalytics, l.bizFeatAnalyticsHint),
      (Icons.contact_phone_outlined, l.bizFeatContacts,
          l.bizFeatContactsHint),
    ];

    return NovaScroll(
      padding: const EdgeInsets.fromLTRB(
          Gap.screenX, Gap.md, Gap.screenX, Gap.section),
      children: [
        Text(l.bizIntroEyebrow.toUpperCase(),
            style: AppType.eyebrow(color: t.brandInk)),
        const SizedBox(height: Gap.sm),
        Text(l.bizIntroTitle,
            style: AppType.displayStyle(
                color: t.text1, size: 34, height: 1.08)),
        const SizedBox(height: Gap.md),
        Text(l.bizIntroLead, style: text.bodyMedium),
        const SizedBox(height: Gap.xl),

        // IMKONIYATLAR — bitta sirt, ichida ingichka ajratgichlar.
        FloatingSurface(
          solid: true,
          padding: const EdgeInsets.symmetric(vertical: Gap.xs),
          child: Column(
            children: [
              for (var i = 0; i < features.length; i++) ...[
                if (i > 0)
                  Divider(
                      height: 1,
                      thickness: 1,
                      indent: 70,
                      color: t.border2),
                _FeatureRow(
                  icon: features[i].$1,
                  title: features[i].$2,
                  hint: features[i].$3,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: Gap.md),

        // NAMUNA — eng ishonarli dalil.
        FloatingSurface(
          solid: true,
          padding: const EdgeInsets.all(Gap.lg),
          onTap: () => context.push(Routes.demoBusiness),
          child: Row(
            children: [
              Icon(Icons.visibility_outlined, size: 20, color: t.text1),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l.bizPitchDemo, style: text.titleSmall),
                    const SizedBox(height: 2),
                    Text(l.bizPitchDemoHint, style: text.bodySmall),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, size: 20, color: t.text3),
            ],
          ),
        ),

        const SizedBox(height: Gap.section),
        Text(l.bizOptionsTitle.toUpperCase(),
            style: AppType.eyebrow(color: t.text3)),
        const SizedBox(height: Gap.md),

        _OptionCard(
          key: const ValueKey('biz-option-free'),
          badge: l.bizFreeBadge,
          title: l.bizFreeTitle,
          hint: l.bizFreeHint,
          cta: NovaButton(
            label: l.bizFreeCta,
            icon: Icons.add_business_rounded,
            onPressed: () => context.push(Routes.businessOnboard),
          ),
        ),
        const SizedBox(height: Gap.md),
        _OptionCard(
          key: const ValueKey('biz-option-premium'),
          premium: true,
          badge: l.bizPremiumBadge,
          title: l.bizPremiumTitle,
          hint: l.bizPremiumHint,
          cta: NovaButton(
            label: l.bizPremiumCta,
            tone: ButtonTone.outline,
            icon: Icons.search_rounded,
            onPressed: () => context.push(Routes.businessOnboardCustom),
          ),
        ),
      ],
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({
    required this.icon,
    required this.title,
    required this.hint,
  });

  final IconData icon;
  final String title;
  final String hint;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: 13),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: t.surface2,
              borderRadius: R.tile,
            ),
            child: Icon(icon, size: 19, color: t.text1),
          ),
          const SizedBox(width: Gap.md + 2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.titleSmall),
                const SizedBox(height: 2),
                Text(hint, style: text.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({
    super.key,
    required this.badge,
    required this.title,
    required this.hint,
    required this.cta,
    this.premium = false,
  });

  final String badge;
  final String title;
  final String hint;
  final Widget cta;

  /// Premium variant — champagne hoshiya. Oltin FAQAT shu yerda:
  /// "maxsus nom" rostdan ham alohida mahsulot.
  final bool premium;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.lg, Gap.xl, Gap.xl),
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        borderRadius: R.soft,
        border: Border.all(
          color: premium ? t.brand.withValues(alpha: .55) : t.border2,
        ),
        boxShadow: t.shadowSoft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(10, 4, 10, 4),
            decoration: BoxDecoration(
              color: premium
                  ? t.brandSoft.withValues(alpha: t.isDark ? .35 : .55)
                  : t.surface2,
              borderRadius: R.pill,
            ),
            child: Text(
              badge.toUpperCase(),
              style: AppType.eyebrow(
                  color: premium ? t.brandInk : t.text2, size: 9.5),
            ),
          ),
          const SizedBox(height: Gap.md),
          Text(title,
              style: AppType.displayStyle(
                  color: t.text1, size: 24, height: 1.15)),
          const SizedBox(height: Gap.sm),
          Text(hint, style: text.bodyMedium),
          const SizedBox(height: Gap.lg),
          cta,
        ],
      ),
    );
  }
}
