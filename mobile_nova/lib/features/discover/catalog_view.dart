import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/errors/app_error.dart';
import '../../core/utils/external_link.dart';
import '../../data/models/models.dart';
import '../../data/repositories/business_repository.dart';
import '../../data/repositories/discover_repository.dart';
import '../../data/repositories/saves_repository.dart';
import '../../design/motion/motion.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../business/business_screens.dart' show formatMoney;
import '../social/media_frame.dart' show mediaImage;
import 'listing_labels.dart';

// ═══════════════════════════════════════════════════════════════════
// TANLOV → KATALOG
//
// UMUMIY KATALOG: barcha faol bizneslarning istalgan mahsuloti va
// xizmati bitta 2 ustunli to'rda (`GET /api/catalog/feed`). NFC
// kartalari — elektronika ichidagi bitta sub-kategoriya, xolos.
//
// Chiplar DINAMIK: "Hammasi · Tovarlar · Xizmatlar" va faqat ichida
// narsa bor global kategoriyalar (Ovqat, Kiyim, Go'zallik...). Har
// kartochkada: kategoriya, nom, narx yoki "Narx kelishiladi", mavjud
// emas belgisi, sevimli va SOTUVCHI — kompaniya nomi + Business ID.
//
// TO'LOV YO'Q: bu ko'rgazma. Buyurtma va to'lov sotuvchi bilan
// (qo'ng'iroq, Telegram, WhatsApp yoki uning sahifasi).
//
// Endpoint hali production'da bo'lmasa (404) — xato emas, "Katalog
// tez orada" holati ko'rsatiladi. Ilova serverdan oldin chiqishi mumkin.
// ═══════════════════════════════════════════════════════════════════

/// Filtrlar (`null` — hammasi): tur, global kategoriya, NFC sub-turi.
final catalogKindProvider =
    StateProvider.autoDispose<ListingKind?>((_) => null);

final catalogCategoryProvider =
    StateProvider.autoDispose<MarketCategory?>((_) => null);

final catalogSubProvider =
    StateProvider.autoDispose<NfcProductType?>((_) => null);

final catalogSortProvider =
    StateProvider.autoDispose<CatalogSort>((_) => CatalogSort.newest);

class CatalogFeedState {
  const CatalogFeedState({
    this.items = const [],
    this.total = 0,
    this.hasMore = false,
    this.counts = const {},
    this.loading = false,
    this.error,
    this.page = 0,
  });

  final List<CatalogProduct> items;
  final int total;
  final bool hasMore;
  final Map<String, int> counts;
  final bool loading;
  final AppError? error;

  /// Oxirgi yuklangan sahifa (0 — hali hech narsa).
  final int page;

  /// Server bu endpointni hali bilmaydi — deploy qilinmagan.
  bool get notDeployed =>
      error != null &&
      (error!.kind == AppErrorKind.notFound ||
          error!.kind == AppErrorKind.endpointMissing);

  CatalogFeedState copyWith({
    List<CatalogProduct>? items,
    int? total,
    bool? hasMore,
    Map<String, int>? counts,
    bool? loading,
    AppError? error,
    bool clearError = false,
    int? page,
  }) =>
      CatalogFeedState(
        items: items ?? this.items,
        total: total ?? this.total,
        hasMore: hasMore ?? this.hasMore,
        counts: counts ?? this.counts,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
        page: page ?? this.page,
      );
}

/// Sahifalab yuklovchi. Qidiruv, tur yoki saralash o'zgarsa provider
/// qayta yaratiladi va ro'yxat 1-sahifadan boshlanadi.
class CatalogFeedController extends StateNotifier<CatalogFeedState> {
  CatalogFeedController(this._repo,
      {required this.q,
      this.kind,
      required this.category,
      this.sub,
      required this.sort})
      : super(const CatalogFeedState(loading: true)) {
    _load(1);
  }

  final DiscoverRepository _repo;
  final String q;
  final ListingKind? kind;
  final MarketCategory? category;
  final NfcProductType? sub;
  final CatalogSort sort;

  static const pageSize = 20;

  Future<void> _load(int page) async {
    final res = await _repo.catalogFeed(
      page: page,
      limit: pageSize,
      q: q,
      kind: kind,
      category: category,
      sub: sub,
      sort: sort,
    );
    if (!mounted) return;
    res.when(
      ok: (p) => state = state.copyWith(
        items: page == 1 ? p.items : [...state.items, ...p.items],
        total: p.total,
        hasMore: p.hasMore,
        counts: p.counts,
        loading: false,
        clearError: true,
        page: page,
      ),
      err: (e) => state = state.copyWith(loading: false, error: e),
    );
  }

  /// Keyingi sahifa — ro'yxat oxiriga yaqinlashganda.
  Future<void> loadMore() async {
    if (state.loading || !state.hasMore || state.error != null) return;
    state = state.copyWith(loading: true);
    await _load(state.page + 1);
  }

  Future<void> retry() async {
    state = state.copyWith(loading: true, clearError: true);
    await _load(state.page == 0 ? 1 : state.page + 1);
  }

  Future<void> refresh() async {
    state = const CatalogFeedState(loading: true);
    await _load(1);
  }
}

final catalogFeedProvider = StateNotifierProvider.autoDispose
    .family<CatalogFeedController, CatalogFeedState, String>((ref, q) {
  return CatalogFeedController(
    ref.watch(discoverRepositoryProvider),
    q: q,
    kind: ref.watch(catalogKindProvider),
    category: ref.watch(catalogCategoryProvider),
    sub: ref.watch(catalogSubProvider),
    sort: ref.watch(catalogSortProvider),
  );
});

/// Katalog sevimlilari — HISOBGA bog'langan (`/api/saves`, kind=listing).
///
/// Ilgari faqat shu telefonda turardi va telefon almashsa yo'qolardi.
/// Endi server asosiy manba, telefon xotirasi — tezkor kesh (internet
/// bo'lmasa ham bosish darhol ishlaydi). Batafsil: `SyncedSaves`.
final catalogFavoritesProvider =
    StateNotifierProvider<SyncedSaves, Set<String>>((ref) {
  final prefs = ref.watch(prefsProvider);
  return SyncedSaves(ref.watch(savesRepositoryProvider), SaveKind.listing,
      initial: prefs.catalogFavorites, persist: prefs.setCatalogFavorites);
});

String _sortLabel(L l, CatalogSort s) => switch (s) {
      CatalogSort.newest => l.catalogSortNew,
      CatalogSort.priceAsc => l.catalogSortPriceAsc,
      CatalogSort.priceDesc => l.catalogSortPriceDesc,
    };

/// Katalog tabining butun tanasi (qidiruv maydoni tepada, Tanlov'da).
class CatalogView extends ConsumerWidget {
  const CatalogView({super.key, required this.query});

  final String query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final state = ref.watch(catalogFeedProvider(query));
    final kind = ref.watch(catalogKindProvider);
    final category = ref.watch(catalogCategoryProvider);
    final sub = ref.watch(catalogSubProvider);
    final sort = ref.watch(catalogSortProvider);

    int? count(String k) => state.counts.isEmpty ? null : state.counts[k];
    String chip(String label, int? n) => n == null ? label : '$label · $n';

    // DINAMIK: bo'sh kategoriya chipi ko'rsatilmaydi (sonlar hali
    // kelmagan bo'lsa — faqat "Hammasi"). Tanlangan chip esa soni 0
    // bo'lsa ham qoladi, aks holda filtrni bekor qilib bo'lmasdi.
    bool shown(String k, bool selected) =>
        selected || ((count(k) ?? 0) > 0);

    void pick({ListingKind? k, MarketCategory? m}) {
      ref.read(catalogKindProvider.notifier).state = k;
      ref.read(catalogCategoryProvider.notifier).state = m;
      ref.read(catalogSubProvider.notifier).state = null;
    }

    final chips = <(String, String, bool, VoidCallback)>[
      ('all', chip(l.catalogAll, count('all')),
          kind == null && category == null, () => pick()),
      for (final k in ListingKind.values)
        if (shown(k.name, kind == k && category == null))
          (k.name, chip(kindPluralLabel(l, k), count(k.name)),
              kind == k && category == null, () => pick(k: k)),
      for (final m in MarketCategory.values)
        if (shown(m.name, category == m && kind == null))
          (m.name, chip(marketLabel(l, m), count(m.name)),
              category == m && kind == null, () => pick(m: m)),
    ];

    // NFCSTORE mahsulotlari — elektronika ichida ikkinchi qator.
    final subs = [
      for (final t in NfcProductType.values)
        if (t != NfcProductType.other && shown(t.name, sub == t)) t,
    ];
    final showSubs = category == MarketCategory.electronics && subs.isNotEmpty;

    return Column(
      children: [
        const SizedBox(height: Gap.sm),
        // Qator ATAYLAB lazy emas: chiplar ~12 ta, hammasi quriladi —
        // ekrandan tashqaridagi chip ham topiladi va o'qiladi.
        // Balandlik shrift bilan o'sadi (`Capsule.rowHeight`): 1.3 da
        // qattiq `40` yorliqni pastdan kesardi ("Katalog" → "Kataloa").
        SizedBox(
          height: Capsule.rowHeight(context),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: Row(children: [
              for (final c in chips)
                Padding(
                  padding: const EdgeInsets.only(right: Gap.sm),
                  child: Capsule(
                    key: ValueKey('catalog-chip-${c.$1}'),
                    label: c.$2,
                    selected: c.$3,
                    onTap: c.$4,
                  ),
                ),
            ]),
          ),
        ),
        if (showSubs) ...[
          const SizedBox(height: Gap.sm),
          // NFC SUB-TURLAR QATORI — ASOSIY QATOR BILAN BIR XIL BALANDLIK.
          //
          // Ilgari `36` edi: kapsulaning yorlig'iga 15dp qolardi, holbuki
          // uning qatori 19dp — oddiy shriftda ham "Breloklar", "Karta"
          // ning pastki qismi (y, р) kesilardi. Qo'shilgan 4dp pastdagi
          // bo'shliqdan olinadi (quyida `Gap.sm`), ya'ni saralash qatori
          // va mahsulotlar to'ri joyidan siljimaydi.
          SizedBox(
            height: Capsule.rowHeight(context),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: Row(children: [
                for (final t in subs)
                  Padding(
                    padding: const EdgeInsets.only(right: Gap.sm),
                    child: Capsule(
                      key: ValueKey('catalog-sub-${t.name}'),
                      label: chip(nfcTypeLabel(l, t), count(t.name)),
                      icon: nfcTypeIcon(t),
                      selected: sub == t,
                      onTap: () => ref.read(catalogSubProvider.notifier).state =
                          sub == t ? null : t,
                    ),
                  ),
              ]),
            ),
          ),
        ],
        Padding(
          // Sub-turlar qatori 4dp o'sgani uchun bu yerdan 4dp olinadi
          // (12 → 8): saralash va to'r aynan avvalgi joyida.
          padding: EdgeInsets.fromLTRB(
              Gap.screenX, showSubs ? Gap.sm : Gap.md, Gap.md, 0),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  state.page == 0 ? '' : l.catalogCount(state.total),
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: t.text2,
                  ),
                ),
              ),
              TextButton.icon(
                key: const ValueKey('catalog-sort'),
                onPressed: () => showCatalogSortSheet(context),
                icon: Icon(Icons.tune_rounded, size: 17, color: t.text1),
                label: Text(
                  '${l.catalogSort}: ${_sortLabel(l, sort)}',
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: t.text1,
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(child: _CatalogBody(query: query, state: state)),
      ],
    );
  }
}

class _CatalogBody extends ConsumerWidget {
  const _CatalogBody({required this.query, required this.state});

  final String query;
  final CatalogFeedState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final ctrl = ref.read(catalogFeedProvider(query).notifier);

    if (state.items.isEmpty) {
      if (state.loading) return const _GridSkeleton();
      if (state.notDeployed) {
        return StatePanel(
          icon: Icons.storefront_outlined,
          title: l.catalogSoon,
          message: l.catalogSoonHint,
        );
      }
      if (state.error != null) {
        return StatePanel.fromError(context, state.error!, onRetry: ctrl.retry);
      }
      return StatePanel(
        icon: Icons.search_off_rounded,
        title: query.isEmpty ? l.stateEmpty : l.stateNoResults,
        message: query.isEmpty ? l.catalogEmptyHint : l.stateNoResultsHint,
      );
    }

    final width = MediaQuery.sizeOf(context).width;
    final k = (MediaQuery.textScalerOf(context).scale(12) / 12).clamp(1.0, 1.6);
    final tile = (width - Gap.screenX * 2 - Gap.md) / 2;
    // Rasm kvadrat + ma'lumot qismi (shrift bilan birga o'sadi).
    final extent = tile + 124 + (k - 1) * 70;

    return RefreshIndicator(
      onRefresh: ctrl.refresh,
      child: NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.metrics.pixels > n.metrics.maxScrollExtent - 600) {
            ctrl.loadMore();
          }
          return false;
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                  Gap.screenX, Gap.sm, Gap.screenX, 0),
              sliver: SliverGrid(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: Gap.md,
                  crossAxisSpacing: Gap.md,
                  mainAxisExtent: extent,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, i) => ProductCard(product: state.items[i]),
                  childCount: state.items.length,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.only(
                  top: Gap.lg,
                  bottom: navSafeBottom(context),
                ),
                child: state.loading
                    ? const Center(
                        child: SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    : state.error != null
                        ? Center(
                            child: TextButton(
                              onPressed: ctrl.retry,
                              child: Text(l.actionRetry),
                            ),
                          )
                        : const SizedBox.shrink(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GridSkeleton extends StatelessWidget {
  const _GridSkeleton();

  @override
  Widget build(BuildContext context) {
    final w = (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - Gap.md) / 2;
    return GridView.count(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(Gap.screenX, Gap.sm, Gap.screenX, 0),
      crossAxisCount: 2,
      mainAxisSpacing: Gap.md,
      crossAxisSpacing: Gap.md,
      childAspectRatio: w / (w + 124),
      children: [
        for (var i = 0; i < 4; i++) Skeleton(height: w + 124, radius: R.tile),
      ],
    );
  }
}

/// Tovar kartochkasi — 2 ustunli to'r uchun.
class ProductCard extends ConsumerWidget {
  const ProductCard({super.key, required this.product});

  final CatalogProduct product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final p = product;
    final fav = ref.watch(catalogFavoritesProvider).contains(p.key);

    return Semantics(
      button: true,
      label: [
        p.name,
        p.priceOnRequest
            ? l.catalogPriceOnRequest
            : formatMoney(p.effectivePrice, 'UZS'),
        if (!p.available) l.catalogUnavailable,
        p.companyName,
      ].join(', '),
      child: PressableScale(
        scale: .97,
        onTap: () => context.push(
          Routes.catalogProduct(p.companyId, p.id),
          extra: p,
        ),
        child: Container(
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: t.border2),
            boxShadow: t.shadowTiny,
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
                    _ProductImage(product: p),
                    if (!p.available)
                      Positioned(
                        left: 10,
                        bottom: 10,
                        child: _Badge(
                          key: const ValueKey('badge-unavailable'),
                          text: l.catalogUnavailable,
                          muted: true,
                        ),
                      )
                    else if (p.hasDiscount)
                      Positioned(
                        left: 10,
                        top: 10,
                        child: _Badge(text: '−${p.discountPercent}%'),
                      ),
                    Positioned(
                      right: 6,
                      top: 6,
                      child: _FavButton(
                        on: fav,
                        tooltip: l.catalogFavorite,
                        onTap: () => ref
                            .read(catalogFavoritesProvider.notifier)
                            .toggle(p.key),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 10, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        listingEyebrow(l, p).toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppType.eyebrow(color: t.brandInk, size: 8.5),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        p.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: t.text1,
                        ),
                      ),
                      const SizedBox(height: 3),
                      _PriceLine(product: p, size: 14, currency: false),
                      const Spacer(),
                      Divider(height: 1, thickness: 1, color: t.border2),
                      _SellerLine(product: p),
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

class _ProductImage extends StatelessWidget {
  const _ProductImage({required this.product, this.url});
  final CatalogProduct product;

  /// Galereyadagi boshqa rasm (bo'lmasa muqova).
  final String? url;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final p = product;
    final Widget img = (url ?? p.imageUrl).isEmpty
        ? ColoredBox(
            color: t.surface2,
            child: Icon(
              p.sub != null ? nfcTypeIcon(p.sub!) : marketIcon(p.marketCategory),
              size: 34,
              color: t.text3,
            ),
          )
        : mediaImage(context, url ?? p.imageUrl, fit: BoxFit.cover);
    // Mavjud emas — rasm xiralashadi, lekin ko'rinib turadi.
    if (p.available) return img;
    return Opacity(opacity: .45, child: img);
  }
}

class _Badge extends StatelessWidget {
  const _Badge({super.key, required this.text, this.muted = false});
  final String text;

  /// Ochroq belgi ("Mavjud emas").
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: muted ? t.surfaceSolid : t.text1,
        borderRadius: R.pill,
        border: muted ? Border.all(color: t.border1) : null,
      ),
      child: Text(
        text,
        style: TextStyle(
          fontFamily: AppType.sans,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: muted ? t.text1 : t.bg1,
        ),
      ),
    );
  }
}

class _FavButton extends StatelessWidget {
  const _FavButton({required this.on, required this.onTap, required this.tooltip});

  final bool on;
  final VoidCallback onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      toggled: on,
      label: tooltip,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        // Nishon 44px, ko'rinadigan doira 32px.
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: AnimatedContainer(
              duration: Motion.fast,
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: t.surfaceSolid.withValues(alpha: .92),
                shape: BoxShape.circle,
                boxShadow: t.shadowTiny,
              ),
              child: AnimatedSwitcher(
                duration: Motion.fast,
                transitionBuilder: (c, a) => ScaleTransition(scale: a, child: c),
                child: Icon(
                  on ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  key: ValueKey(on),
                  size: 16,
                  color: on ? t.error : t.text1,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PriceLine extends StatelessWidget {
  const _PriceLine({
    required this.product,
    required this.size,
    this.currency = true,
  });
  final CatalogProduct product;
  final double size;

  /// Kartochkada valyuta yozilmaydi — tor ustunda narx kesilardi
  /// (`249 00…`). Tovar sahifasida to'liq: `249 000 so'm`.
  final bool currency;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    if (product.priceOnRequest) {
      return Text(
        L.of(context).catalogPriceOnRequest,
        key: const ValueKey('price-on-request'),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontFamily: AppType.sans,
          fontSize: size * .86,
          fontWeight: FontWeight.w700,
          color: t.text1,
        ),
      );
    }
    final main = currency
        ? formatMoney(product.effectivePrice, 'UZS')
        : formatMoney(product.effectivePrice, '').trim();
    final old = formatMoney(product.price, '').trim();
    final mainStyle = TextStyle(
      fontFamily: AppType.sans,
      fontSize: size,
      fontWeight: FontWeight.w800,
      color: t.text1,
    );
    final oldStyle = TextStyle(
      fontFamily: AppType.sans,
      fontSize: size * .76,
      fontWeight: FontWeight.w500,
      color: t.text3,
      decoration: TextDecoration.lineThrough,
    );
    // ASOSIY NARX HECH QACHON KESILMAYDI ("12 900 0…" bo'lardi). Eski
    // narx faqat SIG'SA ko'rsatiladi — sig'masa chegirma baribir
    // rasmdagi "−7%" belgisida ko'rinadi.
    return LayoutBuilder(builder: (context, c) {
      final scaler = MediaQuery.textScalerOf(context);
      double w(String text, TextStyle st) => (TextPainter(
            text: TextSpan(text: text, style: st),
            textDirection: TextDirection.ltr,
            textScaler: scaler,
            maxLines: 1,
          )..layout())
              .width;
      final showOld = product.hasDiscount &&
          w(main, mainStyle) + 6 + w(old, oldStyle) <= c.maxWidth;
      return Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(main, maxLines: 1, style: mainStyle),
            ),
          ),
          if (showOld) ...[
            const SizedBox(width: 6),
            Text(old, maxLines: 1, style: oldStyle),
          ],
        ],
      );
    });
  }
}

/// Sotuvchi: logotip, nomi va Business ID. Bosilsa kompaniya sahifasi.
class _SellerLine extends StatelessWidget {
  const _SellerLine({required this.product});
  final CatalogProduct product;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final p = product;
    return Semantics(
      link: true,
      label: '${p.companyName} ${p.companyId}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => context.push(Routes.storefront(p.companyId)),
        child: SizedBox(
          height: 46,
          child: Row(
            children: [
              _Logo(url: p.companyLogo, name: p.companyName, size: 24),
              const SizedBox(width: 7),
              // Ikki qator: nomi va Business ID — tor ustunda ham
              // ikkalasi ham o'qiladi.
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.companyName.isEmpty ? p.companyId : p.companyName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 11,
                        height: 1.2,
                        fontWeight: FontWeight.w600,
                        color: t.text1,
                      ),
                    ),
                    Text(
                      p.companyId,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppType.monoStyle(
                          color: t.text3, size: 9.5, letterSpacing: .6),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, size: 15, color: t.text3),
            ],
          ),
        ),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo({required this.url, required this.name, required this.size});
  final String url;
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final letter = name.trim().isEmpty ? '·' : name.trim()[0].toUpperCase();
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: t.surface2,
        border: Border.all(color: t.border1),
      ),
      clipBehavior: Clip.antiAlias,
      child: url.isEmpty
          ? Center(
              child: Text(
                letter,
                style: TextStyle(
                  fontFamily: AppType.display,
                  fontSize: size * .55,
                  color: t.text1,
                ),
              ),
            )
          : mediaImage(context, url, fit: BoxFit.cover),
    );
  }
}

/// Saralash va tur — bitta varaqda.
Future<void> showCatalogSortSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    // Ildiz navigatorda — aks holda varaq pastki panel ostida qoladi.
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: context.tokens.surfaceSolid,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (_) => const _SortSheet(),
  );
}

class _SortSheet extends ConsumerWidget {
  const _SortSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final sort = ref.watch(catalogSortProvider);
    final kind = ref.watch(catalogKindProvider);
    final category = ref.watch(catalogCategoryProvider);

    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Gap.screenX, 0, Gap.screenX, Gap.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.catalogSort,
                style: AppType.displayStyle(color: t.text1, size: 26)),
            const SizedBox(height: Gap.md),
            for (final s in CatalogSort.values)
              InkWell(
                key: ValueKey('sort-${s.wire}'),
                borderRadius: R.tile,
                onTap: () {
                  ref.read(catalogSortProvider.notifier).state = s;
                  Navigator.of(context).pop();
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _sortLabel(l, s),
                          style: TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 15,
                            fontWeight:
                                s == sort ? FontWeight.w700 : FontWeight.w500,
                            color: t.text1,
                          ),
                        ),
                      ),
                      AnimatedOpacity(
                        opacity: s == sort ? 1 : 0,
                        duration: Motion.fast,
                        child: Icon(Icons.check_rounded, size: 20, color: t.text1),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: Gap.lg),
            Text(l.catalogKindLabel.toUpperCase(),
                style: AppType.eyebrow(color: t.text3)),
            const SizedBox(height: Gap.md),
            Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              children: [
                Capsule(
                  label: l.catalogAll,
                  selected: kind == null,
                  onTap: () =>
                      ref.read(catalogKindProvider.notifier).state = null,
                ),
                for (final k in ListingKind.values)
                  Capsule(
                    key: ValueKey('sheet-kind-${k.name}'),
                    label: kindPluralLabel(l, k),
                    icon: kindIcon(k),
                    selected: kind == k,
                    onTap: () =>
                        ref.read(catalogKindProvider.notifier).state = k,
                  ),
              ],
            ),
            const SizedBox(height: Gap.lg),
            Text(l.catalogCategoryLabel.toUpperCase(),
                style: AppType.eyebrow(color: t.text3)),
            const SizedBox(height: Gap.md),
            Wrap(
              spacing: Gap.sm,
              runSpacing: Gap.sm,
              children: [
                Capsule(
                  label: l.catalogAll,
                  selected: category == null,
                  onTap: () {
                    ref.read(catalogCategoryProvider.notifier).state = null;
                    ref.read(catalogSubProvider.notifier).state = null;
                  },
                ),
                for (final m in MarketCategory.values)
                  Capsule(
                    key: ValueKey('sheet-cat-${m.name}'),
                    label: marketLabel(l, m),
                    selected: category == m,
                    onTap: () {
                      ref.read(catalogCategoryProvider.notifier).state = m;
                      ref.read(catalogSubProvider.notifier).state = null;
                    },
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Chuqur havola orqali (extra'siz) ochilganda tovar kompaniya
/// katalogidan topiladi — alohida endpoint shart emas.
final catalogProductProvider = FutureProvider.autoDispose
    .family<CatalogProduct?, (String, String)>((ref, key) async {
  final repo = ref.watch(businessRepositoryProvider);
  final company = await repo.byId(key.$1);
  final items = await repo.catalog(key.$1);
  final b = company.valueOrNull;
  final list = items.valueOrNull;
  if (b == null || list == null) {
    throw company.errorOrNull ?? items.errorOrNull ?? const AppError(AppErrorKind.unknown);
  }
  final hit = list.where((i) => i.key == key.$2).firstOrNull;
  return hit == null ? null : CatalogProduct.fromItem(hit, b);
});

/// Tovar sahifasi.
class CatalogProductScreen extends ConsumerWidget {
  const CatalogProductScreen({
    super.key,
    required this.companyId,
    required this.itemId,
    this.initial,
  });

  final String companyId;
  final String itemId;

  /// Katalogdan bosilganda tovar allaqachon bor — qayta so'ralmaydi.
  final CatalogProduct? initial;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    if (initial != null) return _ProductDetail(product: initial!);

    final async = ref.watch(catalogProductProvider((companyId, itemId)));
    return async.when(
      loading: () => const NovaScaffold(
        showBack: true,
        body: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      error: (e, _) => NovaScaffold(
        showBack: true,
        body: StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () =>
              ref.invalidate(catalogProductProvider((companyId, itemId))),
        ),
      ),
      data: (p) => p == null
          ? NovaScaffold(
              showBack: true,
              body: StatePanel(
                icon: Icons.inventory_2_outlined,
                title: l.stateNoResults,
              ),
            )
          : _ProductDetail(product: p),
    );
  }
}

class _ProductDetail extends ConsumerStatefulWidget {
  const _ProductDetail({required this.product});
  final CatalogProduct product;

  @override
  ConsumerState<_ProductDetail> createState() => _ProductDetailState();
}

class _ProductDetailState extends ConsumerState<_ProductDetail> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final p = widget.product;
    final fav = ref.watch(catalogFavoritesProvider).contains(p.key);
    final images = p.images.isEmpty ? [p.imageUrl] : p.images;

    return NovaScaffold(
      showBack: true,
      actions: [
        NovaIconButton(
          icon: fav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
          tooltip: l.catalogFavorite,
          onPressed: () =>
              ref.read(catalogFavoritesProvider.notifier).toggle(p.key),
        ),
      ],
      body: NovaScroll(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(26),
            child: AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (images.length > 1)
                    PageView.builder(
                      key: const ValueKey('listing-gallery'),
                      itemCount: images.length,
                      onPageChanged: (i) => setState(() => _page = i),
                      itemBuilder: (_, i) =>
                          _ProductImage(product: p, url: images[i]),
                    )
                  else
                    _ProductImage(product: p),
                  if (!p.available)
                    Positioned(
                      left: 14,
                      top: 14,
                      child: _Badge(text: l.catalogUnavailable, muted: true),
                    )
                  else if (p.hasDiscount)
                    Positioned(
                      left: 14,
                      top: 14,
                      child: _Badge(text: '−${p.discountPercent}%'),
                    ),
                  if (images.length > 1)
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 12,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < images.length; i++)
                            AnimatedContainer(
                              duration: Motion.fast,
                              margin: const EdgeInsets.symmetric(horizontal: 3),
                              width: i == _page ? 16 : 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: Colors.white
                                    .withValues(alpha: i == _page ? .95 : .55),
                                borderRadius: R.pill,
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: Gap.xl),
          Text(listingEyebrow(l, p).toUpperCase(),
              style: AppType.eyebrow(color: t.brandInk)),
          const SizedBox(height: 6),
          Text(p.name, style: AppType.displayStyle(color: t.text1, size: 30)),
          const SizedBox(height: Gap.md),
          _PriceLine(product: p, size: 22),
          const SizedBox(height: Gap.md),
          Wrap(
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            children: [
              _InfoPill(
                key: const ValueKey('listing-kind'),
                icon: kindIcon(p.kind),
                text: kindLabel(l, p.kind),
              ),
              _InfoPill(
                key: const ValueKey('listing-availability'),
                icon: p.available
                    ? Icons.check_circle_outline_rounded
                    : Icons.remove_circle_outline_rounded,
                text: p.available ? l.catalogInStock : l.catalogUnavailable,
                tone: p.available ? t.success : t.text3,
              ),
              if (p.section.isNotEmpty && NfcProductType.parse(p.section) == null)
                _InfoPill(
                  icon: Icons.folder_open_rounded,
                  text: p.section,
                ),
            ],
          ),
          if (p.description.isNotEmpty) ...[
            const SizedBox(height: Gap.lg),
            Text(p.description, style: Theme.of(context).textTheme.bodyLarge),
          ],
          const SizedBox(height: Gap.xl),
          Text(l.catalogSeller.toUpperCase(),
              style: AppType.eyebrow(color: t.text3)),
          const SizedBox(height: Gap.md),
          FloatingSurface(
            key: const ValueKey('listing-seller'),
            solid: true,
            onTap: () => context.push(Routes.storefront(p.companyId)),
            child: Row(
              children: [
                _Logo(url: p.companyLogo, name: p.companyName, size: 46),
                const SizedBox(width: Gap.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.companyName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        p.companyId,
                        style: AppType.monoStyle(color: t.text2, size: 12),
                      ),
                      if (p.companyAddress.isNotEmpty || p.companyCity.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          [p.companyCity, p.companyAddress]
                              .where((e) => e.isNotEmpty)
                              .join(', '),
                          key: const ValueKey('listing-address'),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: t.text3),
              ],
            ),
          ),
          if (p.hasContact) ...[
            const SizedBox(height: Gap.xl),
            Text(l.catalogContact.toUpperCase(),
                style: AppType.eyebrow(color: t.text3)),
            const SizedBox(height: Gap.md),
            Row(
              children: [
                if (p.companyPhone.isNotEmpty)
                  Expanded(
                    child: _ContactButton(
                      key: const ValueKey('contact-call'),
                      icon: Icons.phone_rounded,
                      label: l.catalogCall,
                      onTap: () => openLink(telUrl(p.companyPhone)),
                    ),
                  ),
                if (p.companyTelegram.isNotEmpty) ...[
                  if (p.companyPhone.isNotEmpty) const SizedBox(width: Gap.sm),
                  Expanded(
                    child: _ContactButton(
                      key: const ValueKey('contact-telegram'),
                      icon: Icons.send_rounded,
                      label: 'Telegram',
                      onTap: () => openLink(telegramUrl(p.companyTelegram)),
                    ),
                  ),
                ],
                if (p.companyWhatsapp.isNotEmpty) ...[
                  if (p.companyPhone.isNotEmpty || p.companyTelegram.isNotEmpty)
                    const SizedBox(width: Gap.sm),
                  Expanded(
                    child: _ContactButton(
                      key: const ValueKey('contact-whatsapp'),
                      icon: Icons.chat_rounded,
                      label: 'WhatsApp',
                      onTap: () => openLink(whatsappUrl(p.companyWhatsapp)),
                    ),
                  ),
                ],
              ],
            ),
          ],
          const SizedBox(height: Gap.xl),
          NovaButton(
            label: l.catalogOpenSeller,
            icon: Icons.storefront_outlined,
            onPressed: () => context.push(Routes.storefront(p.companyId)),
          ),
          const SizedBox(height: Gap.md),
          // To'lov ilovada YO'Q — buyurtma va to'lov sotuvchi bilan.
          Text(
            '${l.catalogOrderNote} ${l.catalogFavoritesLocal}',
            key: const ValueKey('listing-no-payment'),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({super.key, required this.icon, required this.text, this.tone});
  final IconData icon;
  final String text;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        borderRadius: R.pill,
        border: Border.all(color: t.border1),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: tone ?? t.text2),
          const SizedBox(width: 5),
          ConstrainedBox(
            constraints: BoxConstraints(
                maxWidth: MediaQuery.sizeOf(context).width - 120),
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: t.text1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactButton extends StatelessWidget {
  const _ContactButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        scale: .96,
        onTap: onTap,
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: R.tile,
            border: Border.all(color: t.border1),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 19, color: t.text1),
              const SizedBox(height: 4),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: t.text1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
