import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/utils/sharing.dart';
import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/id_plate.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart' show myIdsProvider;
import '../business/business_forms.dart' show businessCategoryLabel;
import '../business/business_providers.dart';
import '../business/store_catalog.dart';
import '../home/widgets/identity_card.dart' show formatCount;
import '../shop/nfc_id_market.dart' show tierLabel;
import '../social/engagement.dart';
import '../social/media_frame.dart';
import '../social/moderation.dart';

// TANLOV KARTALARI — PREMIUM (egasi, 2026-09-24, namuna rasmlar bilan).
//
// Odam kartasi: chapda katta kvadrat surat, o'ngda ism (serif), kasb,
// NFC ID, "Ko'rish" va belgili statistika.
//
// Biznes kartasi: chapda katta muqova (belgi + tovar soni), o'ngda
// logotip, nom, soha, manzil, ish vaqti, 4 ta tovar rasmi, statistika
// va "Kuzatish". HAMMASI HAQIQIY MA'LUMOT: reyting, soxta "TOP" yoki
// "Tasdiqlangan" belgisi YO'Q — serverda bunday ma'lumot yo'q.

String _initials(String name, String fallback) {
  final s = name.trim().isEmpty ? fallback.trim() : name.trim();
  final parts = s.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
}

/// Rasm yo'q bo'lsa — siyoh fon, oltin serif bosh harflar.
class _InitialsTile extends StatelessWidget {
  const _InitialsTile({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: IdPlate.inkCover,
        ),
      ),
      child: Center(
        child: Text(
          text,
          style: AppType.displayStyle(color: IdPlate.goldLight, size: 34),
        ),
      ),
    );
  }
}

/// Belgili statistika katakchasi: belgi, son, yorliq.
class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.value, required this.label});
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // Tor katakda belgi yashiriladi — son va yorliq o'qiladigan
    // o'lchamda qoladi (kichraytirilmaydi).
    return LayoutBuilder(
      builder: (context, c) {
        final icon = c.maxWidth >= 84;
        return Row(
          children: [
            if (icon) ...[
              Icon(
                this.icon,
                size: 16,
                color: Color.lerp(t.text1, t.text2, .35),
              ),
              const SizedBox(width: 5),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    value,
                    maxLines: 1,
                    style: TextStyle(
                      fontFamily: AppType.display,
                      fontFamilyFallback: AppType.displayFallback,
                      fontSize: 16,
                      height: 1.05,
                      color: t.text1,
                    ),
                  ),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 10.5,
                      height: 1.2,
                      color: t.text2,
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Champagne "Ko'rish ›" kapsulasi.
class _ViewPill extends StatelessWidget {
  const _ViewPill({required this.onTap, this.compact = false});
  final VoidCallback onTap;

  /// Tor ekranda — faqat "›" doirasi.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: compact
            ? const EdgeInsets.all(6)
            : const EdgeInsets.fromLTRB(12, 7, 8, 7),
        decoration: BoxDecoration(
          color: t.brand.withValues(alpha: t.isDark ? .18 : .14),
          borderRadius: R.pill,
          border: Border.all(color: t.brand.withValues(alpha: .55)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!compact)
              Text(
                l.storeView,
                style: TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: t.text1,
                ),
              ),
            Icon(Icons.chevron_right_rounded, size: 16, color: t.text1),
          ],
        ),
      ),
    );
  }
}

// ================================================================ ODAM

class DiscoverPersonCard extends ConsumerWidget {
  const DiscoverPersonCard({super.key, required this.id});
  final NfcId id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final e = id;
    final name = e.name.isEmpty ? e.code : e.name;
    // O'z yozuvim — faqat shaxsiy ID'lardan (biznes ro'yxatini so'ramaydi).
    final mine = ref.watch(myIdsProvider).any((i) => i.code == e.code);
    void open() => context.push(Routes.user(e.code));

    return PressableScale(
      scale: .985,
      onTap: open,
      child: Container(
        key: ValueKey('discover-person-${e.code}'),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: t.border1),
          boxShadow: t.shadowSoft,
        ),
        child: LayoutBuilder(
          builder: (context, box) {
            // 360 dp va undan torda surat biroz kichrayadi, "Ko'rish"
            // yozuvi o'rniga "›" doirasi (x1.3 shriftda ham sig'sin).
            final photo = (box.maxWidth * .32).clamp(84.0, 108.0);
            final compact =
                box.maxWidth - photo - 12 < 210 ||
                MediaQuery.textScalerOf(context).scale(10) > 11.5;
            // QAT'IY BALANDLIK (IntrinsicHeight EMAS): rasm vidjeti ichida
            // LayoutBuilder bor, u intrinsic o'lchamni bera olmaydi.
            // Shrift kattalashsa karta ham shunga yarasha o'sadi.
            final scale = MediaQuery.textScalerOf(
              context,
            ).scale(1).clamp(1.0, 1.4);
            return SizedBox(
              height: 136 + (scale - 1) * 70,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // SURAT — katta kvadrat, kartaning asosiy urg'usi.
                  SizedBox(
                    width: photo,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: e.avatarUrl.isEmpty
                          ? _InitialsTile(text: _initials(e.name, e.code))
                          : mediaImage(context, e.avatarUrl, fit: BoxFit.cover),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppType.displayStyle(
                                      color: t.text1,
                                      size: 21,
                                      height: 1.15,
                                    ),
                                  ),
                                  if (e.role.isNotEmpty)
                                    Text(
                                      e.role,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                ],
                              ),
                            ),
                            if (!mine)
                              SizedBox(
                                width: 28,
                                height: 32,
                                child: IconButton(
                                  padding: EdgeInsets.zero,
                                  tooltip: l.reportTitle,
                                  icon: Icon(
                                    Icons.more_vert_rounded,
                                    size: 20,
                                    color: t.text1,
                                  ),
                                  onPressed: () => showContentActions(
                                    context,
                                    ref,
                                    target: ReportTarget.record,
                                    targetId: e.code,
                                    ownerCode: e.code,
                                    blockKind: BlockKind.record,
                                    blockId: e.code,
                                    keyPrefix: 'discover',
                                  ),
                                ),
                              ),
                            _ViewPill(onTap: open, compact: compact),
                          ],
                        ),
                        const SizedBox(height: 8),
                        IdPlate(
                          code: e.code,
                          tier: e.tier,
                          size: IdPlateSize.small,
                        ),
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.only(top: 8),
                          decoration: BoxDecoration(
                            border: Border(top: BorderSide(color: t.border1)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: _Stat(
                                  icon: Icons.article_outlined,
                                  value: formatCount(e.posts),
                                  label: l.profilePosts,
                                ),
                              ),
                              Expanded(
                                child: _Stat(
                                  icon: Icons.people_outline_rounded,
                                  value: formatCount(e.followers),
                                  label: l.profileFollowers,
                                ),
                              ),
                              Expanded(
                                child: _Stat(
                                  icon: Icons.person_outline_rounded,
                                  value: formatCount(e.following),
                                  label: l.profileFollowing,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

// ============================================================== BIZNES

/// Biznes kartasi. Ro'yxat API'si faqat nom, logo, muqova va sohani
/// beradi — qolgani (ish vaqti, tovarlar, obunachilar, daraja) karta
/// ekranga chiqqanda vitrina so'rovidan olinadi (bitta so'rov: vitrina
/// va katalog bir-biriga ulangan). Ko'rishlar soni bundan OSHMAYDI —
/// u alohida POST bilan hisoblanadi.
class DiscoverBusinessCard extends ConsumerWidget {
  const DiscoverBusinessCard({super.key, required this.business});
  final Business business;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final id = business.companyId;
    final full = ref.watch(storefrontProvider(id)).valueOrNull;
    final items =
        ref.watch(businessCatalogProvider(id)).valueOrNull ??
        const <CatalogItem>[];
    final b = full ?? business;
    final name = b.displayName.isEmpty ? b.companyId : b.displayName;
    final cover = b.coverUrl.isNotEmpty ? b.coverUrl : business.coverUrl;
    final mine =
        ref
            .watch(myBusinessesProvider)
            .valueOrNull
            ?.any((m) => m.companyId.toUpperCase() == id.toUpperCase()) ??
        false;
    final following = mine ? false : ref.watch(followingOfProvider(id));
    final followers =
        ref.watch(followStatsProvider(id)).valueOrNull?.followers ??
        b.followers;
    final category = [
      if (b.subcategory.isNotEmpty)
        b.subcategory
      else if (b.category.isNotEmpty)
        businessCategoryLabel(l, b.category),
    ].join();
    final place = [b.city, b.address].where((s) => s.isNotEmpty).join(', ');

    // BELGI — faqat haqiqiy asos bilan (ustuvorlik tartibida).
    final isNew =
        business.createdAt != null &&
        DateTime.now().difference(business.createdAt!).inDays <= 30;
    final String? badge = IdPlate.isPrecious(b.tier)
        ? tierLabel(l, b.tier)
        : b.plan.premium
        ? l.storePremium
        : items.any((i) => i.hasDiscount)
        ? l.storeCatPromo
        : isNew
        ? l.storeNew
        : null;
    final thumbs = featuredItems(
      items,
    ).where((i) => i.imageUrl.isNotEmpty).take(4).toList();
    void open() => context.push(Routes.storefront(id));
    // Tor ekran yoki katta shrift — ulashish belgisi yashiriladi
    // (u biznes sahifasida bor), "Kuzatish" sig'ib qolsin.
    final narrow =
        MediaQuery.sizeOf(context).width < 375 ||
        MediaQuery.textScalerOf(context).scale(10) > 11.5;

    return PressableScale(
      scale: .985,
      onTap: open,
      child: Container(
        key: ValueKey('discover-business-$id'),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: t.border1),
          boxShadow: t.shadowSoft,
        ),
        child: SizedBox(
          height:
              184 +
              (MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.4) - 1) *
                  90,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // MUQOVA + belgi + tovar soni.
              Expanded(
                flex: 44,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (cover.isNotEmpty)
                        mediaImage(context, cover, fit: BoxFit.cover)
                      else
                        const StoreInkCover(markSize: 56),
                      if (badge != null)
                        Positioned(
                          left: 8,
                          top: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: IdPlate.inkCover.first.withValues(
                                alpha: .82,
                              ),
                              borderRadius: R.pill,
                              border: Border.all(
                                color: IdPlate.gold.withValues(alpha: .7),
                              ),
                            ),
                            child: Text(
                              badge.toUpperCase(),
                              style: const TextStyle(
                                fontFamily: AppType.sans,
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: .8,
                                color: IdPlate.goldLight,
                              ),
                            ),
                          ),
                        ),
                      if (items.isNotEmpty)
                        Positioned(
                          left: 8,
                          bottom: 8,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: IdPlate.inkCover.first.withValues(
                                alpha: .72,
                              ),
                              borderRadius: R.pill,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.grid_view_rounded,
                                  size: 12,
                                  color: IdPlate.goldLight,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  '${items.length}',
                                  style: const TextStyle(
                                    fontFamily: AppType.sans,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: IdPlate.goldLight,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 56,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          padding: const EdgeInsets.all(1.6),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: t.brand.withValues(alpha: .7),
                              width: 1.2,
                            ),
                          ),
                          child: ClipOval(
                            child: b.logoUrl.isEmpty
                                ? _InitialsTile(
                                    text: _initials(b.displayName, id),
                                  )
                                : mediaImage(
                                    context,
                                    b.logoUrl,
                                    fit: BoxFit.cover,
                                  ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontFamily: AppType.sans,
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w800,
                                  color: t.text1,
                                ),
                              ),
                              if (category.isNotEmpty)
                                Text(
                                  category,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontFamily: AppType.sans,
                                    fontSize: 11,
                                    color: t.text2,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (place.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      _Line(icon: Icons.place_outlined, text: place),
                    ],
                    if (b.openNow != null) ...[
                      const SizedBox(height: 3),
                      _Line(
                        dot: b.openNow! ? t.success : t.error,
                        text: [
                          b.openNow! ? l.storeOpenShort : l.storeClosedShort,
                          if (b.todayOpen.isNotEmpty && b.todayClose.isNotEmpty)
                            '${b.todayOpen}–${b.todayClose}',
                        ].join(' · '),
                        strong: b.openNow! ? t.success : null,
                      ),
                    ],
                    if (thumbs.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      // Balandlik QAT'IY (42 dp): keng ekranda (planshet,
                      // BlueStacks) kataklar kattalashib, pastki qator
                      // karta tashqarisiga chiqib ketardi.
                      SizedBox(
                        height: 42,
                        child: Row(
                          children: [
                            for (var i = 0; i < 4; i++) ...[
                              if (i > 0) const SizedBox(width: 5),
                              Flexible(
                                child: AspectRatio(
                                  aspectRatio: 1,
                                  child: i < thumbs.length
                                      ? ClipRRect(
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                          child: mediaImage(
                                            context,
                                            thumbs[i].imageUrl,
                                            fit: BoxFit.cover,
                                          ),
                                        )
                                      : const SizedBox(),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _Stat(
                            icon: Icons.people_outline_rounded,
                            value: formatCount(followers),
                            label: l.profileFollowers,
                          ),
                        ),
                        if (!narrow)
                          GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => shareLink(
                              '$kApiBase/c/${Uri.encodeComponent(id)}',
                              title: name,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(6),
                              child: Icon(
                                Icons.ios_share_rounded,
                                size: 18,
                                color: t.text1,
                              ),
                            ),
                          ),
                        if (!mine) ...[
                          const SizedBox(width: 4),
                          Flexible(
                            flex: 0,
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: _FollowPill(
                                following: following,
                                onTap: () async {
                                  final err = await ref
                                      .read(followOverridesProvider.notifier)
                                      .toggle(
                                        id,
                                        following: following,
                                        company: true,
                                      );
                                  if (err == null || !context.mounted) return;
                                  ScaffoldMessenger.of(context)
                                    ..hideCurrentSnackBar()
                                    ..showSnackBar(
                                      SnackBar(
                                        content: Text(describeError(l, err)),
                                      ),
                                    );
                                },
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.text, this.icon, this.dot, this.strong});
  final String text;
  final IconData? icon;
  final Color? dot;
  final Color? strong;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Row(
      children: [
        SizedBox(
          width: 14,
          child: dot != null
              ? Center(
                  child: Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: dot,
                      shape: BoxShape.circle,
                    ),
                  ),
                )
              : Icon(icon, size: 13, color: t.text1),
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 11.5,
              fontWeight: strong != null ? FontWeight.w700 : FontWeight.w500,
              color: strong ?? t.text2,
            ),
          ),
        ),
      ],
    );
  }
}

class _FollowPill extends StatelessWidget {
  const _FollowPill({required this.following, required this.onTap});
  final bool following;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return Semantics(
      button: true,
      label: following ? l.actionFollowing : l.actionFollow,
      child: PressableScale(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: following ? t.brand.withValues(alpha: .14) : t.text1,
            borderRadius: R.pill,
            border: Border.all(
              color: following ? t.brand.withValues(alpha: .6) : t.text1,
            ),
          ),
          child: Text(
            following ? l.actionFollowing : l.actionFollow,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: following ? t.text1 : t.surfaceSolid,
            ),
          ),
        ),
      ),
    );
  }
}

// ======================================================= BIZNES TOIFALARI

/// Bizneslar bo'limidagi rasmli toifa kataklari: "Hammasi" + ro'yxatda
/// bor sohalar. Rasm — o'sha sohadagi birinchi biznesning muqovasi yoki
/// logotipi (haqiqiy), bo'lmasa belgi. Son — ro'yxatdagi bizneslar.
class DiscoverBizCategories extends StatelessWidget {
  const DiscoverBizCategories({
    super.key,
    required this.businesses,
    required this.selected,
    required this.onSelect,
  });

  final List<Business> businesses;
  final String selected;
  final ValueChanged<String> onSelect;

  static IconData _icon(String slug) => switch (slug) {
    'restaurant' || 'cafe' => Icons.restaurant_rounded,
    'market' || 'shop' => Icons.shopping_bag_outlined,
    'services' => Icons.room_service_outlined,
    'construction' => Icons.construction_rounded,
    'clinic' || 'pharmacy' => Icons.medical_services_outlined,
    'education' => Icons.school_outlined,
    _ => Icons.storefront_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final groups = <String, List<Business>>{};
    for (final b in businesses) {
      (groups[b.category.isEmpty ? 'other' : b.category] ??= []).add(b);
    }
    final cells = <(String, String, int, String, IconData)>[
      ('all', l.catalogAll, businesses.length, '', Icons.grid_view_rounded),
      for (final e in groups.entries)
        (
          e.key,
          businessCategoryLabel(l, e.key),
          e.value.length,
          e.value
              .map((b) => b.coverUrl.isNotEmpty ? b.coverUrl : b.logoUrl)
              .firstWhere((u) => u.isNotEmpty, orElse: () => ''),
          _icon(e.key),
        ),
    ];
    if (cells.length <= 2) return const SizedBox.shrink();
    return SizedBox(
      height: 112,
      child: ListView.separated(
        key: const ValueKey('discover-biz-categories'),
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        itemCount: cells.length,
        separatorBuilder: (_, __) => const SizedBox(width: Gap.sm),
        itemBuilder: (context, i) {
          final c = cells[i];
          return _BizCell(
            label: c.$2,
            count: c.$3,
            image: c.$4,
            icon: c.$5,
            active: selected == c.$1,
            onTap: () => onSelect(c.$1),
          );
        },
      ),
    );
  }
}

class _BizCell extends StatelessWidget {
  const _BizCell({
    required this.label,
    required this.count,
    required this.image,
    required this.icon,
    required this.active,
    required this.onTap,
  });

  final String label;
  final int count;
  final String image;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final fg = active ? t.surfaceSolid : t.text1;
    return Semantics(
      button: true,
      selected: active,
      label: '$label, $count',
      child: PressableScale(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 86,
          decoration: BoxDecoration(
            color: active ? t.text1 : t.surfaceSolid,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: active ? t.brand.withValues(alpha: .8) : t.border1,
              width: active ? 1.4 : 1,
            ),
            boxShadow: active ? t.shadowSoft : t.shadowTiny,
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              SizedBox(
                height: 58,
                width: double.infinity,
                child: image.isEmpty
                    ? Icon(
                        icon,
                        size: 26,
                        color: active ? IdPlate.goldLight : t.text1,
                      )
                    : mediaImage(context, image, fit: BoxFit.cover),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: fg,
                        ),
                      ),
                      Text(
                        formatCount(count),
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 10.5,
                          color: active
                              ? t.surfaceSolid.withValues(alpha: .7)
                              : t.text2,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
