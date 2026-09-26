import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../demo/demo_data.dart';
import '../home/widgets/identity_card.dart' show formatCount;
import '../social/media_frame.dart' show mediaImage;
import 'business_screens.dart' show formatMoney;
import 'sample_businesses.dart';
import '../../design/widgets/brand_icon.dart';

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
        const SizedBox(height: Gap.lg),

        // RASMLI KO'RINISH — biznes nima olishini ko'z bilan ko'rsin.
        const _Showcase(),
        const SizedBox(height: Gap.xl),

        // IKKI YO'L — darhol, pastga aylantirmasdan.
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

        // NAMUNA PROFILLAR — tayyor bizneslar sahifasi qanday ko'rinadi.
        // Variantlardan keyin: tugmalar pastga surilmasin. Namuna yo'q
        // bo'lsa bo'sh joy ham qolmaydi.
        const _SampleSection(),

        const SizedBox(height: Gap.section),
        Text(l.bizFeaturesTitle.toUpperCase(),
            style: AppType.eyebrow(color: t.text3)),
        const SizedBox(height: Gap.md),
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
            child: BrandAwareIcon(icon, size: 19, color: t.text1),
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


/// Biznes sahifasining NAMUNA ko'rinishi — uch slayd.
///
/// Egasining talabi: "Business nima berishini rasmli premium onboarding
/// bilan ko'rsat". Slaydlar HAQIQIY ekran elementlaridan qurilgan
/// (sahifa, katalog, statistika) va ichidagi ma'lumot — ilovadagi
/// "NFC Market" namunasi (`demo_data.dart`). Har slaydda "NAMUNA"
/// yozuvi bor: bu odamning sahifasi emas, ko'rinishi.
class _SampleSection extends ConsumerWidget {
  const _SampleSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final has = ref.watch(sampleBusinessesProvider).valueOrNull?.isNotEmpty ??
        false;
    if (!has) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: Gap.section),
      child: SampleBusinessesStrip(
        title: L.of(context).sampleBusinessesIntroTitle,
        horizontalPadding: 0,
      ),
    );
  }
}

class _Showcase extends StatefulWidget {
  const _Showcase();

  @override
  State<_Showcase> createState() => _ShowcaseState();
}

class _ShowcaseState extends State<_Showcase> {
  final _page = PageController(viewportFraction: .9);
  int _i = 0;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final slides = <(String, String, Widget)>[
      (l.bizFeatSite, l.bizFeatSiteHint, const _SiteSlide()),
      (l.bizFeatCatalog, l.bizFeatCatalogHint, const _CatalogSlide()),
      (l.bizFeatAnalytics, l.bizFeatAnalyticsHint, const _StatsSlide()),
    ];
    return Column(
      children: [
        SizedBox(
          height: 330,
          child: PageView.builder(
            key: const ValueKey('biz-showcase'),
            controller: _page,
            padEnds: false,
            itemCount: slides.length,
            onPageChanged: (i) => setState(() => _i = i),
            itemBuilder: (context, i) => Padding(
              padding: const EdgeInsets.only(right: Gap.md),
              child: Container(
                decoration: BoxDecoration(
                  color: t.surfaceSolid,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: t.border2),
                  boxShadow: t.shadowSoft,
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                  children: [
                    Positioned.fill(child: slides[i].$3),
                    Positioned(
                      right: 12,
                      top: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: t.surfaceSolid.withValues(alpha: .92),
                          borderRadius: R.pill,
                          border: Border.all(
                              color: t.brand.withValues(alpha: .6)),
                        ),
                        child: Text(l.bizShowcaseSample.toUpperCase(),
                            style: AppType.eyebrow(
                                color: t.brandInk, size: 8.5)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: Gap.md),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: Column(
            key: ValueKey(_i),
            children: [
              Text(slides[_i].$1,
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 2),
              Text(slides[_i].$2,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
        const SizedBox(height: Gap.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var k = 0; k < slides.length; k++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: k == _i ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: k == _i ? t.text1 : t.border1,
                  borderRadius: R.pill,
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _SiteSlide extends StatelessWidget {
  const _SiteSlide();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    const b = demoBusiness;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 128,
          width: double.infinity,
          child: mediaImage(context, b.coverUrl, fit: BoxFit.cover),
        ),
        Transform.translate(
          offset: const Offset(0, -26),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: t.surfaceSolid, width: 3),
                    boxShadow: t.shadowTiny,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: mediaImage(context, b.logoUrl, fit: BoxFit.cover),
                ),
                const SizedBox(height: 8),
                Text(b.displayName,
                    style: AppType.displayStyle(color: t.text1, size: 24)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        borderRadius: R.pill,
                        border: Border.all(color: t.border1),
                      ),
                      child: Text(b.companyId,
                          style: AppType.monoStyle(
                              color: t.text1, size: 11, letterSpacing: 1.4)),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text('${b.subcategory} · ${b.city}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    for (final ic in const [
                      Icons.call_outlined,
                      Icons.send_outlined,
                      Icons.place_outlined,
                      Icons.language_rounded,
                    ])
                      Container(
                        margin: const EdgeInsets.only(right: 8),
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: t.surface2,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(ic, size: 17, color: t.text1),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CatalogSlide extends StatelessWidget {
  const _CatalogSlide();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final items = demoCatalog.where((e) => e.imageUrl.isNotEmpty).take(4).toList();
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 44, 14, 14),
      child: GridView.count(
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: .98,
        children: [
          for (final it in items)
            Container(
              decoration: BoxDecoration(
                color: t.surface2,
                borderRadius: BorderRadius.circular(16),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                      child: SizedBox(
                          width: double.infinity,
                          child: mediaImage(context, it.imageUrl,
                              fit: BoxFit.cover))),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 5, 8, 6),
                    child: Text(
                      formatMoney(it.effectivePrice, '').trim(),
                      maxLines: 1,
                      style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        color: t.text1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StatsSlide extends StatelessWidget {
  const _StatsSlide();

  /// Namuna haftalik ko'rishlar — "NAMUNA" yozuvi ostida.
  static const _week = [.42, .55, .48, .7, .64, .88, 1.0];

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    const b = demoBusiness;
    Widget stat(String v, String k) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(v, style: AppType.displayStyle(color: t.text1, size: 30)),
              Text(k.toUpperCase(),
                  style: AppType.eyebrow(color: t.text3, size: 9)),
            ],
          ),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 48, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            stat(formatCount(b.views), l.nfcViews),
            stat(formatCount(b.followers), l.profileFollowers),
          ]),
          const Spacer(),
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < _week.length; i++)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: FractionallySizedBox(
                        heightFactor: _week[i],
                        alignment: Alignment.bottomCenter,
                        child: Container(
                          decoration: BoxDecoration(
                            color: i == _week.length - 1
                                ? t.text1
                                : t.brand.withValues(alpha: .45),
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
