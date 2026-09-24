import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/models.dart';
import '../../data/repositories/business_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../social/media_frame.dart';
import 'business_providers.dart';
import 'business_screens.dart' show formatMoney;
import '../../design/widgets/id_plate.dart';

// ============================================================ TOIFALAR
//
// BIZNES KATALOGI TOIFALARI (egasi, 2026-09-24: "katalog rasmli va
// toifalangan bo'lsin, profil uzunlashib ketmasin").
//
// Manba — SERVERDAGI HAQIQIY MA'LUMOT:
//   1. Biznes o'z tovarlariga bo'lim yozgan bo'lsa (`category`,
//      masalan "Ichimliklar") — aynan o'sha bo'limlar (dinamik).
//   2. Bo'lim yozilmagan bo'lsa — tovar NOMIDAN aniqlanadi (NFC
//      kartalar, uzuklar, breloklar, stikerlar, stendlar, sovg'alar,
//      biznes uchun). Hech narsa to'qilmaydi: bo'sh toifa chiqmaydi.
//   3. "Aksiyalar" — chegirmali tovarlar (virtual toifa).
//
// Toifa rasmi — o'sha toifadagi BIRINCHI tovarning o'z rasmi (demo
// rasm qo'shilmaydi); rasm bo'lmasa belgi.

/// Katalog toifasi — nomi, belgisi va tovarlari.
class StoreCategory {
  const StoreCategory({
    required this.id,
    required this.label,
    required this.items,
    required this.icon,
  });

  /// `all`, `promo`, `sec:<bo'lim>` yoki `kw:<kalit>`.
  final String id;
  final String label;
  final List<CatalogItem> items;
  final IconData icon;

  /// Toifa muqovasi — ichidagi birinchi rasmli tovar.
  String get image => items
      .firstWhere(
        (i) => i.imageUrl.isNotEmpty,
        orElse: () => const CatalogItem(id: 0),
      )
      .imageUrl;
}

/// Kalit so'zlar — TARTIB MUHIM (birinchi mos kelgani olinadi):
/// "Korporativ NFC sovg'a" — biznes uchun, "Sovg'a konverti" — sovg'a.
const _keywords = <(String, List<String>, IconData)>[
  (
    'business',
    ['korporativ', 'корпоратив', 'corporate', 'biznes uchun'],
    Icons.business_center_outlined,
  ),
  (
    'gifts',
    ["sovg'a", 'sovga', 'gift', 'подар', 'konvert'],
    Icons.card_giftcard_rounded,
  ),
  ('rings', ['uzuk', 'кольц', ' ring'], Icons.radio_button_unchecked_rounded),
  (
    'bracelets',
    ['braslet', 'bilaguzuk', 'bilakuzuk', 'bracelet', 'браслет'],
    Icons.watch_outlined,
  ),
  ('keychains', ['brelok', 'keychain', 'брелок'], Icons.vpn_key_outlined),
  ('stickers', ['stiker', 'sticker', 'стикер', 'наклейк'], Icons.sell_outlined),
  ('stands', ['stend', 'stand', 'стенд'], Icons.table_restaurant_outlined),
  ('cards', ['karta', 'card', 'карт'], Icons.credit_card_rounded),
];

String _norm(String s) => ' ${s.toLowerCase()}'
    .replaceAll(RegExp('[‘’ʻʼ`´]'), "'")
    .replaceAll(RegExp(r'\s+'), ' ');

String _kwLabel(L l, String id) => switch (id) {
  'cards' => l.storeCatCards,
  'rings' => l.storeCatRings,
  'keychains' => l.storeCatKeychains,
  'bracelets' => l.storeCatBracelets,
  'stickers' => l.storeCatStickers,
  'stands' => l.storeCatStands,
  'gifts' => l.storeCatGifts,
  'business' => l.storeCatBusiness,
  _ => l.storeCatOther,
};

IconData _iconFor(String text) {
  final n = _norm(text);
  for (final k in _keywords) {
    if (k.$2.any(n.contains)) return k.$3;
  }
  return Icons.inventory_2_outlined;
}

/// Tovar toifasi yozuvi: biznesning o'z bo'limi, bo'lmasa nomdan
/// aniqlangan toifa, bo'lmasa "Mahsulot"/"Xizmat".
String storeItemLabel(L l, CatalogItem i) {
  final s = i.category.trim();
  if (s.isNotEmpty) return s;
  final n = _norm(i.name);
  final hit = _keywords.where((k) => k.$2.any(n.contains)).firstOrNull;
  if (hit != null) return _kwLabel(l, hit.$1);
  return i.isService ? l.listingService : l.listingProduct;
}

/// Chegirma foizi (`−15%`).
int discountPercent(CatalogItem i) =>
    i.price <= 0 ? 0 : (((i.price - i.effectivePrice) * 100) / i.price).round();

/// Toifalar: "Hammasi", haqiqiy toifalar, "Aksiyalar".
List<StoreCategory> storeCategories(L l, List<CatalogItem> items) {
  final out = <StoreCategory>[
    StoreCategory(
      id: 'all',
      label: l.catalogAll,
      items: items,
      icon: Icons.apps_rounded,
    ),
  ];
  if (items.isEmpty) return out;

  // 1. Biznesning o'z bo'limlari.
  final sections = <String, List<CatalogItem>>{};
  final noSection = <CatalogItem>[];
  for (final i in items) {
    final s = i.category.trim();
    if (s.isEmpty) {
      noSection.add(i);
    } else {
      (sections[s] ??= []).add(i);
    }
  }
  final useSections =
      sections.length >= 2 || (sections.length == 1 && noSection.isNotEmpty);

  final groups = <StoreCategory>[];
  if (useSections) {
    for (final e in sections.entries) {
      groups.add(
        StoreCategory(
          id: 'sec:${e.key}',
          label: e.key,
          items: e.value,
          icon: _iconFor(e.key),
        ),
      );
    }
    if (noSection.isNotEmpty) {
      groups.add(
        StoreCategory(
          id: 'sec:',
          label: l.storeCatOther,
          items: noSection,
          icon: Icons.inventory_2_outlined,
        ),
      );
    }
  } else {
    // 2. Nomdan aniqlash.
    final byKw = <String, List<CatalogItem>>{};
    final rest = <CatalogItem>[];
    for (final i in items) {
      final n = _norm(i.name);
      final hit = _keywords.where((k) => k.$2.any(n.contains)).firstOrNull;
      if (hit == null) {
        rest.add(i);
      } else {
        (byKw[hit.$1] ??= []).add(i);
      }
    }
    // Faqat haqiqatan ajratsa: bitta toifaga hammasi tushsa — ma'nosiz.
    if (byKw.length >= 2 || (byKw.length == 1 && rest.isNotEmpty)) {
      for (final k in _keywords.reversed) {
        final list = byKw[k.$1];
        if (list == null) continue;
        groups.add(
          StoreCategory(
            id: 'kw:${k.$1}',
            label: _kwLabel(l, k.$1),
            items: list,
            icon: k.$3,
          ),
        );
      }
      if (rest.isNotEmpty) {
        groups.add(
          StoreCategory(
            id: 'kw:other',
            label: l.storeCatOther,
            items: rest,
            icon: Icons.inventory_2_outlined,
          ),
        );
      }
    }
  }
  out.addAll(groups);

  // 3. Aksiyalar — chegirmali tovarlar.
  final promo = items.where((i) => i.hasDiscount && i.available).toList();
  if (promo.isNotEmpty) {
    out.add(
      StoreCategory(
        id: 'promo',
        label: l.storeCatPromo,
        items: promo,
        icon: Icons.local_offer_outlined,
      ),
    );
  }
  return out;
}

/// Profilda ko'rinadigan 4 ta tovar: mavjud va rasmli tovarlar
/// egasining o'z tartibida (server `sort_order`), keyin qolganlari.
List<CatalogItem> featuredItems(List<CatalogItem> items, [int n = 4]) {
  final ranked = [
    ...items.where((i) => i.available && i.imageUrl.isNotEmpty),
    ...items.where((i) => i.available && i.imageUrl.isEmpty),
    ...items.where((i) => !i.available),
  ];
  return ranked.take(n).toList();
}

/// Tovar sahifasini ochish — Tanlov katalogidagi bilan BIR XIL sahifa
/// (galereya, narx, chegirma, sotuvchi, aloqa, buyurtma).
void openStoreProduct(BuildContext context, CatalogItem item, Business b) {
  context.push(
    Routes.catalogProduct(b.companyId, item.key),
    extra: CatalogProduct.fromItem(item, b),
  );
}

// ============================================================ TOIFA CHIPI

/// Rasmli toifa chiplari — gorizontal qator.
///
/// Faol chip — siyoh kapsula (Ivory'da qora), ichida champagne
/// hoshiyali rasm; faol emasi — toza sirt + ingichka hoshiya.
class StoreCategoryStrip extends StatelessWidget {
  const StoreCategoryStrip({
    super.key,
    required this.categories,
    required this.selected,
    required this.onSelect,
    this.padding = const EdgeInsets.symmetric(horizontal: Gap.screenX),
  });

  final List<StoreCategory> categories;
  final String selected;
  final ValueChanged<StoreCategory> onSelect;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView.separated(
        key: const ValueKey('store-categories'),
        scrollDirection: Axis.horizontal,
        padding: padding,
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: Gap.sm),
        itemBuilder: (context, i) => _CategoryChip(
          category: categories[i],
          active: categories[i].id == selected,
          onTap: () => onSelect(categories[i]),
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.category,
    required this.active,
    required this.onTap,
  });

  final StoreCategory category;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final fg = active ? t.surfaceSolid : t.text1;
    final img = category.image;
    return Semantics(
      button: true,
      selected: active,
      label: '${category.label}, ${category.items.length}',
      child: PressableScale(
        onTap: onTap,
        child: AnimatedContainer(
          key: ValueKey('store-cat-${category.id}'),
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.fromLTRB(5, 5, 14, 5),
          decoration: BoxDecoration(
            color: active ? t.text1 : t.surfaceSolid,
            borderRadius: R.pill,
            border: Border.all(color: active ? t.text1 : t.border1),
            boxShadow: active ? t.shadowSoft : t.shadowTiny,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: active
                      ? t.surfaceSolid.withValues(alpha: .12)
                      : t.surface2,
                  border: Border.all(
                    color: t.brand.withValues(alpha: active ? .9 : .45),
                    width: 1.2,
                  ),
                ),
                clipBehavior: Clip.antiAlias,
                child: img.isEmpty || category.id == 'all'
                    ? Icon(category.icon, size: 18, color: fg)
                    : mediaImage(context, img, fit: BoxFit.cover),
              ),
              const SizedBox(width: 9),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    category.label,
                    maxLines: 1,
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 12.5,
                      height: 1.15,
                      fontWeight: FontWeight.w700,
                      color: fg,
                    ),
                  ),
                  Text(
                    '${category.items.length}',
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 10.5,
                      height: 1.2,
                      fontWeight: FontWeight.w600,
                      color: active
                          ? t.surfaceSolid.withValues(alpha: .7)
                          : t.text2,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================ TOVAR KARTASI

/// Premium tovar kartasi — rasm asosiy urg'u.
class StoreProductCard extends StatelessWidget {
  const StoreProductCard({
    super.key,
    required this.item,
    required this.business,
    this.width,
  });

  final CatalogItem item;
  final Business business;
  final double? width;

  /// Rasm ostidagi matn qismining balandligi (grid uchun).
  static const bodyHeight = 146.0;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final i = item;
    final price = i.priceOnRequest
        ? l.catalogPriceOnRequest
        : formatMoney(i.effectivePrice, i.currency);
    final eyebrow = storeItemLabel(l, i);

    return Semantics(
      button: true,
      label: '${i.name}, $price',
      child: PressableScale(
        scale: .97,
        onTap: () => openStoreProduct(context, i, business),
        child: Container(
          key: ValueKey('store-product-${i.key}'),
          width: width,
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: t.border1),
            boxShadow: t.shadowSoft,
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Opacity(
                      opacity: i.available ? 1 : .45,
                      child: i.imageUrl.isEmpty
                          ? ColoredBox(
                              color: t.surface2,
                              child: Icon(
                                _iconFor(i.name),
                                size: 34,
                                color: t.text3,
                              ),
                            )
                          : mediaImage(context, i.imageUrl, fit: BoxFit.cover),
                    ),
                    if (!i.available)
                      Positioned(
                        left: 10,
                        top: 10,
                        child: _Tag(text: l.catalogUnavailable, muted: true),
                      )
                    else if (i.hasDiscount && discountPercent(i) > 0)
                      Positioned(
                        left: 10,
                        top: 10,
                        child: _Tag(text: '−${discountPercent(i)}%'),
                      ),
                  ],
                ),
              ),
              SizedBox(
                height: bodyHeight,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        eyebrow.toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppType.eyebrow(color: t.brandInk, size: 8.5),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        i.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: t.text1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        i.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 11,
                          color: t.text2,
                        ),
                      ),
                      const Spacer(),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          price,
                          maxLines: 1,
                          style: TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: t.text1,
                          ),
                        ),
                      ),
                      if (i.hasDiscount)
                        Text(
                          formatMoney(i.price, i.currency),
                          maxLines: 1,
                          style: TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 10.5,
                            color: t.text3,
                            decoration: TextDecoration.lineThrough,
                          ),
                        )
                      else
                        const SizedBox(height: 13),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text(
                            l.storeDetails,
                            style: TextStyle(
                              fontFamily: AppType.sans,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: t.text1,
                            ),
                          ),
                          const SizedBox(width: 2),
                          Icon(
                            Icons.arrow_forward_rounded,
                            size: 13,
                            color: t.brandInk,
                          ),
                        ],
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

class _Tag extends StatelessWidget {
  const _Tag({required this.text, this.muted = false});
  final String text;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: muted ? t.surfaceSolid : t.text1,
        borderRadius: R.pill,
        border: Border.all(
          color: muted ? t.border1 : t.brand.withValues(alpha: .6),
        ),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontFamily: AppType.sans,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: muted ? t.text1 : t.surfaceSolid,
        ),
      ),
    );
  }
}

/// Ikki ustunli to'r — ekran kengligiga moslashadi (360/390/430).
class _TwoColumn extends StatelessWidget {
  const _TwoColumn({required this.items, required this.business});
  final List<CatalogItem> items;
  final Business business;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        const gap = Gap.md;
        final w = (c.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final i in items)
              StoreProductCard(item: i, business: business, width: w),
          ],
        );
      },
    );
  }
}

// ============================================================ PROFILDAGI BLOK

/// Profil ichidagi katalog: sarlavha, rasmli toifalar, 4 ta tovar va
/// "Barchasini ko'rish". Profil uzunlashib ketmaydi — to'liq ro'yxat
/// alohida sahifada.
class StoreCatalogPreview extends ConsumerWidget {
  const StoreCatalogPreview({super.key, required this.business});
  final Business business;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final id = business.companyId;
    final catalog = ref.watch(businessCatalogProvider(id));

    Widget header(int count) => Padding(
      padding: const EdgeInsets.fromLTRB(
        Gap.screenX,
        Gap.section,
        Gap.screenX,
        Gap.md,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l.bizCatalog.toUpperCase(),
                  style: AppType.eyebrow(color: t.text2),
                ),
                const SizedBox(height: 2),
                Text(
                  count > 0 ? '$count · ${l.storeProducts}' : l.storeProducts,
                  style: AppType.displayStyle(color: t.text1, size: 22),
                ),
              ],
            ),
          ),
          if (count > 0)
            PressableScale(
              onTap: () => context.push(Routes.storeCatalog(id)),
              child: Container(
                key: const ValueKey('store-see-all'),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  color: t.surfaceSolid,
                  borderRadius: R.pill,
                  border: Border.all(color: t.border1),
                  boxShadow: t.shadowTiny,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      l.storeSeeAll,
                      style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: t.text1,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      Icons.arrow_forward_rounded,
                      size: 14,
                      color: t.brandInk,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );

    return catalog.when(
      loading: () => Column(
        children: [
          header(0),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: SkeletonList(count: 2),
          ),
        ],
      ),
      error: (e, __) => Column(
        children: [
          header(0),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: StatePanel.fromError(
              context,
              asAppError(e),
              onRetry: () => ref.invalidate(businessCatalogProvider(id)),
            ),
          ),
        ],
      ),
      data: (items) {
        if (items.isEmpty) {
          return Column(
            children: [
              header(0),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: FloatingSurface(
                  solid: true,
                  child: Text(
                    l.bizCatalogEmpty,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ),
            ],
          );
        }
        final cats = storeCategories(l, items);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            header(items.length),
            if (cats.length > 1) ...[
              StoreCategoryStrip(
                categories: cats,
                selected: 'all',
                onSelect: (c) =>
                    context.push(Routes.storeCatalog(id, category: c.id)),
              ),
              const SizedBox(height: Gap.md),
            ],
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: _TwoColumn(
                items: featuredItems(items),
                business: business,
              ),
            ),
          ],
        );
      },
    );
  }
}

// ============================================================ TO'LIQ KATALOG

/// To'liq katalog sahifasi — qidiruv, rasmli toifalar, tavsiya etilgan
/// tovarlar va ikki ustunli to'r.
class StoreCatalogScreen extends ConsumerStatefulWidget {
  const StoreCatalogScreen({
    super.key,
    required this.companyId,
    this.initialCategory = 'all',
  });

  final String companyId;
  final String initialCategory;

  @override
  ConsumerState<StoreCatalogScreen> createState() => _StoreCatalogScreenState();
}

class _StoreCatalogScreenState extends ConsumerState<StoreCatalogScreen> {
  late String _cat = widget.initialCategory;
  String _query = '';
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final id = widget.companyId;
    final biz = ref.watch(storefrontProvider(id));
    final catalog = ref.watch(businessCatalogProvider(id));

    return NovaScaffold(
      showBack: true,
      body: switch ((biz, catalog)) {
        (AsyncError(:final error), _) ||
        (_, AsyncError(:final error)) => StatePanel.fromError(
          context,
          asAppError(error),
          onRetry: () {
            ref
              ..invalidate(storefrontProvider(id))
              ..invalidate(businessCatalogProvider(id));
          },
        ),
        (AsyncData(value: final b), AsyncData(value: final items)) => _body(
          context,
          l,
          t,
          b,
          items,
        ),
        _ => const Padding(
          padding: EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: SkeletonList(count: 4),
        ),
      },
    );
  }

  Widget _body(
    BuildContext context,
    L l,
    NfcTokens t,
    Business b,
    List<CatalogItem> items,
  ) {
    final cats = storeCategories(l, items);
    final active = cats.where((c) => c.id == _cat).firstOrNull ?? cats.first;
    final q = _query.trim().toLowerCase();
    final shown = active.items
        .where(
          (i) =>
              q.isEmpty ||
              i.name.toLowerCase().contains(q) ||
              i.description.toLowerCase().contains(q) ||
              i.category.toLowerCase().contains(q),
        )
        .toList();
    final showFeatured = active.id == 'all' && q.isEmpty && items.length > 4;
    final featured = showFeatured
        ? featuredItems(items)
        : const <CatalogItem>[];

    return CustomScrollView(
      key: const ValueKey('store-catalog'),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              Gap.screenX,
              Gap.sm,
              Gap.screenX,
              Gap.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (b.displayName.isEmpty ? b.companyId : b.displayName)
                      .toUpperCase(),
                  style: AppType.eyebrow(color: t.brandInk),
                ),
                const SizedBox(height: 4),
                Text(
                  l.bizCatalog,
                  style: AppType.displayStyle(color: t.text1, size: 30),
                ),
                const SizedBox(height: 2),
                Text(
                  '${items.length} · ${l.storeProducts}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: Gap.lg),
                // Qidiruv — Tanlov'dagi qidiruv maydoni bilan bir tilda.
                Container(
                  height: 50,
                  padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
                  decoration: BoxDecoration(
                    color: t.surfaceSolid,
                    borderRadius: R.pill,
                    border: Border.all(color: t.border1),
                    boxShadow: t.shadowTiny,
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.search_rounded, size: 20, color: t.text1),
                      const SizedBox(width: Gap.sm),
                      Expanded(
                        child: TextField(
                          key: const ValueKey('store-search'),
                          controller: _search,
                          onChanged: (v) => setState(() => _query = v),
                          textInputAction: TextInputAction.search,
                          style: TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 14,
                            color: t.text1,
                          ),
                          decoration: InputDecoration(
                            isCollapsed: true,
                            filled: false,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            hintText: l.storeSearchHint,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        if (cats.length > 1)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(bottom: Gap.lg),
              child: StoreCategoryStrip(
                categories: cats,
                selected: active.id,
                onSelect: (c) => setState(() => _cat = c.id),
              ),
            ),
          ),
        if (featured.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                Gap.screenX,
                0,
                Gap.screenX,
                Gap.md,
              ),
              child: Text(
                l.storeFeatured.toUpperCase(),
                style: AppType.eyebrow(color: t.text2),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 170 + StoreProductCard.bodyHeight + 8,
              child: ListView.separated(
                key: const ValueKey('store-featured'),
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                itemCount: featured.length,
                separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
                itemBuilder: (_, i) => Align(
                  alignment: Alignment.topCenter,
                  child: StoreProductCard(
                    item: featured[i],
                    business: b,
                    width: 170,
                  ),
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                Gap.screenX,
                Gap.lg,
                Gap.screenX,
                Gap.md,
              ),
              child: Text(
                active.label.toUpperCase(),
                style: AppType.eyebrow(color: t.text2),
              ),
            ),
          ),
        ],
        if (shown.isEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: StatePanel(
                icon: Icons.search_off_rounded,
                title: l.stateNoResults,
              ),
            ),
          )
        else
          SliverPadding(
            padding: EdgeInsets.fromLTRB(
              Gap.screenX,
              0,
              Gap.screenX,
              navSafeBottom(context),
            ),
            // DANGASA to'r: katalog katta bo'lsa ham faqat ko'ringan
            // kartalar quriladi va rasmlari yuklanadi.
            sliver: SliverLayoutBuilder(
              builder: (context, c) {
                const gap = Gap.md;
                final w = (c.crossAxisExtent - gap) / 2;
                return SliverGrid(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: gap,
                    crossAxisSpacing: gap,
                    mainAxisExtent: w + StoreProductCard.bodyHeight + 2,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => StoreProductCard(item: shown[i], business: b),
                    childCount: shown.length,
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}

// ============================================================ BUYURTMA

/// Buyurtma varag'i — mavjud server oqimi (`/api/companies/:id/orders`).
///
/// To'lov YO'Q va "to'landi" holati hech qachon ko'rsatilmaydi:
/// buyurtma egasining kabinetiga tushadi, u o'zi bog'lanadi.
Future<void> showOrderSheet(
  BuildContext context, {
  required String companyId,
  String itemId = '',
  String itemName = '',
}) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) =>
        _OrderSheet(companyId: companyId, itemId: itemId, itemName: itemName),
  );
}

class _OrderSheet extends ConsumerStatefulWidget {
  const _OrderSheet({
    required this.companyId,
    required this.itemId,
    required this.itemName,
  });

  final String companyId;
  final String itemId;
  final String itemName;

  @override
  ConsumerState<_OrderSheet> createState() => _OrderSheetState();
}

class _OrderSheetState extends ConsumerState<_OrderSheet> {
  late final _name = TextEditingController(
    text: ref.read(currentUserProvider)?.displayName ?? '',
  );
  late final _phone = TextEditingController(
    text: ref.read(currentUserProvider)?.phone ?? '',
  );
  final _note = TextEditingController();
  int _qty = 1;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final l = L.of(context);
    final name = _name.text.trim();
    final phone = _phone.text.trim();
    if (name.isEmpty || phone.replaceAll(RegExp(r'\D'), '').length < 7) {
      setState(() => _error = l.errRequired);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref
        .read(businessRepositoryProvider)
        .order(
          widget.companyId,
          itemId: widget.itemId,
          name: name,
          phone: phone,
          qty: _qty,
          note: _note.text.trim(),
        );
    if (!mounted) return;
    res.when(
      ok: (_) {
        final messenger = ScaffoldMessenger.of(context);
        Navigator.of(context).pop();
        messenger
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(l.orderSent)));
      },
      err: (e) => setState(() {
        _busy = false;
        _error = e.code == 'orders_disabled'
            ? l.orderDisabled
            : describeError(l, e);
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return Padding(
      padding: EdgeInsets.only(
        left: Gap.md,
        right: Gap.md,
        bottom:
            MediaQuery.viewInsetsOf(context).bottom +
            MediaQuery.viewPaddingOf(context).bottom +
            Gap.md,
      ),
      child: Container(
        key: const ValueKey('order-sheet'),
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: R.soft,
          border: Border.all(color: t.border1),
          boxShadow: t.shadowFloat,
        ),
        padding: const EdgeInsets.fromLTRB(Gap.xl, Gap.xl, Gap.xl, Gap.lg),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l.orderTitle,
                style: AppType.displayStyle(color: t.text1, size: 24),
              ),
              if (widget.itemName.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  widget.itemName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
              const SizedBox(height: Gap.lg),
              NovaField(label: l.orderName, controller: _name, enabled: !_busy),
              const SizedBox(height: Gap.md),
              NovaField(
                label: l.orderPhone,
                controller: _phone,
                keyboardType: TextInputType.phone,
                enabled: !_busy,
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ()-]')),
                ],
              ),
              const SizedBox(height: Gap.md),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l.orderQty,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                  NovaIconButton(
                    key: const ValueKey('order-minus'),
                    icon: Icons.remove_rounded,
                    tooltip: '−',
                    size: 40,
                    onPressed: _busy || _qty <= 1
                        ? null
                        : () => setState(() => _qty--),
                  ),
                  SizedBox(
                    width: 44,
                    child: Text(
                      '$_qty',
                      key: const ValueKey('order-qty'),
                      textAlign: TextAlign.center,
                      style: AppType.displayStyle(color: t.text1, size: 22),
                    ),
                  ),
                  NovaIconButton(
                    key: const ValueKey('order-plus'),
                    icon: Icons.add_rounded,
                    tooltip: '+',
                    size: 40,
                    onPressed: _busy || _qty >= 999
                        ? null
                        : () => setState(() => _qty++),
                  ),
                ],
              ),
              const SizedBox(height: Gap.md),
              NovaField(label: l.orderNote, controller: _note, enabled: !_busy),
              if (_error != null) ...[
                const SizedBox(height: Gap.md),
                Text(
                  _error!,
                  key: const ValueKey('order-error'),
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: t.error,
                  ),
                ),
              ],
              const SizedBox(height: Gap.lg),
              NovaButton(
                key: const ValueKey('order-send'),
                label: l.orderSend,
                icon: Icons.shopping_bag_outlined,
                busy: _busy,
                onPressed: _send,
              ),
              const SizedBox(height: Gap.sm),
              Text(
                l.orderNoPayment,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Muqova yo'q bo'lganda — siyoh material, champagne nur va NFC belgisi.
/// Demo rasm EMAS: brendning o'z materiali (profil va Tanlov kartasida).
class StoreInkCover extends StatelessWidget {
  const StoreInkCover({super.key, this.markSize = 96});
  final double markSize;

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
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: const Alignment(.7, -.6),
            radius: 1.0,
            colors: [
              IdPlate.inkCoverGlow,
              IdPlate.inkCoverGlow.withValues(alpha: 0),
            ],
          ),
        ),
        child: Align(
          alignment: const Alignment(.85, -.1),
          child: Icon(
            Icons.contactless_outlined,
            size: markSize,
            color: IdPlate.inkCoverMark,
          ),
        ),
      ),
    );
  }
}
