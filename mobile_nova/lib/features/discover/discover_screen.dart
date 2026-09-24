import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../data/models/models.dart';
import '../../data/repositories/discover_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import 'catalog_view.dart';
import 'discover_cards.dart';

/// TANLOV BO'LIMI — FAQAT ODAMLAR VA BIZNESLAR.
///
/// "Postlar" yorlig'i olib tashlandi: bosh sahifaning O'ZI
/// postlar lentasi, ya'ni bu yerdagi uchinchi yorliq aynan
/// o'sha ro'yxatni ikkinchi marta ko'rsatardi. Tanlov esa
/// QIDIRUV bo'limi — bu yerda odam ODAM yoki BIZNES qidiradi.
///
/// Yorliq bilan birga `discoverRepository.trending()` ham
/// ketdi: u `/api/feed` ning IKKINCHI mijozi edi, birinchisi —
/// bosh sahifaning `SocialRepository.feed()` i.
enum DiscoverTab { people, businesses, catalog }

/// Qidiruv so'rovi — `debounce` bilan.
///
/// Har bosilgan harfga so'rov yuborish serverni ham, batareyani ham
/// behuda sarflaydi. Shuning uchun 350 ms tinchlikdan keyin yuboriladi.
class SearchQuery extends StateNotifier<String> {
  SearchQuery() : super('');
  Timer? _debounce;

  void update(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) state = v.trim();
    });
  }

  void submit(String v) {
    _debounce?.cancel();
    state = v.trim();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }
}

final searchQueryProvider =
    StateNotifierProvider.autoDispose<SearchQuery, String>((_) => SearchQuery());

final discoverTabProvider =
    StateProvider.autoDispose<DiscoverTab>((_) => DiscoverTab.people);

/// Ko'rishlar bo'yicha kamayish tartibida.
///
/// Teng bo'lsa obunachilar, keyin ism — aks holda har ochilganda
/// tartib sakrab, ro'yxat "beqaror" bo'lib ko'rinardi.
List<NfcId> _byViews(List<NfcId> v) {
  final out = [...v];
  out.sort((a, b) {
    final c = b.views.compareTo(a.views);
    if (c != 0) return c;
    final f = b.followers.compareTo(a.followers);
    return f != 0 ? f : a.code.compareTo(b.code);
  });
  return out;
}

List<Business> _byBizViews(List<Business> v) {
  final out = [...v];
  out.sort((a, b) {
    final c = b.views.compareTo(a.views);
    if (c != 0) return c;
    final f = b.followers.compareTo(a.followers);
    if (f != 0) return f;
    // Teng bo'lsa — server kabi yangisi oldin.
    final ta = a.createdAt, tb = b.createdAt;
    if (ta != null && tb != null && ta != tb) return tb.compareTo(ta);
    return a.companyId.compareTo(b.companyId);
  });
  return out;
}

/// Bizneslar bo'limida tanlangan soha (`all` — hammasi).
final discoverBizCategoryProvider = StateProvider<String>((ref) => 'all');

final discoverResultsProvider = FutureProvider.autoDispose((ref) async {
  final q = ref.watch(searchQueryProvider);
  final tab = ref.watch(discoverTabProvider);
  final repo = ref.watch(discoverRepositoryProvider);

  if (q.isEmpty) {
    return switch (tab) {
      // ENG KO'P KO'RILGANLAR TEPADA.
      //
      // Server tartibni kafolatlamaydi, shuning uchun ro'yxat
      // shu yerda saralanadi: odam bo'limni ochganda eng faol
      // profillarni birinchi ko'rsin.
      DiscoverTab.people => (await repo.suggested()).when(
          ok: (v) => <Object>[..._byViews(v)], err: (e) => throw e),
      // Ilgari bu yerda QATTIQ KODLANGAN bo'sh ro'yxat turardi va
      // "Bizneslar" bo'limi so'rovsiz holatda har doim "Hozircha
      // bo'sh" deb ko'rsatardi — produksiyada kompaniyalar bo'lsa
      // ham. Server ro'yxatni allaqachon beradi.
      DiscoverTab.businesses => (await repo.companies())
          .when(ok: (v) => <Object>[..._byBizViews(v)], err: (e) => throw e),
      // Katalog o'z sahifalovchisi bilan (`catalogFeedProvider`).
      DiscoverTab.catalog => const <Object>[],
    };
  }

  return switch (tab) {
    DiscoverTab.people => (await repo.searchPeople(q))
        .when(ok: (v) => <Object>[...v], err: (e) => throw e),
    DiscoverTab.businesses => (await repo.searchBusinesses(q))
        .when(ok: (v) => <Object>[...v], err: (e) => throw e),
    DiscoverTab.catalog => const <Object>[],
  };
});

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final tab = ref.watch(discoverTabProvider);
    final results = ref.watch(discoverResultsProvider);
    final query = ref.watch(searchQueryProvider);
    final prefs = ref.watch(prefsProvider);

    return NovaScaffold(
      // Asosiy tab: pastki bo'shliq `navSafeBottom` da (suzuvchi menyu).
      padBottom: false,
      // SARLAVHA YO'Q.
      //
      // "Kashf eting" yozuvi qidiruv maydoni va tablar ustida
      // ortiqcha qavat hosil qilardi: ekranning o'zi allaqachon
      // pastki navigatsiyada belgilangan. Sarlavha berilmagani
      // uchun `NovaScaffold` yuqori panelni UMUMAN chizmaydi va
      // qidiruv maydoni tepaga ko'tariladi.
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(Gap.screenX, Gap.sm, Gap.screenX, Gap.md),
            child: Container(
              // Yorug' mavzuda oq sirt + nozik chegara + yengil soya
              // (premium redizayn, 2026-09-24).
              decoration: BoxDecoration(
                color: t.surfaceSolid,
                borderRadius: R.pill,
                border: Border.all(color: t.border1),
                boxShadow: t.shadowTiny,
              ),
              padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
              child: Row(
                children: [
                  Icon(Icons.search_rounded,
                      size: 19, color: t.text1),
                  const SizedBox(width: Gap.md),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      onChanged: ref.read(searchQueryProvider.notifier).update,
                      onSubmitted: (v) {
                        ref.read(searchQueryProvider.notifier).submit(v);
                        prefs.pushSearch(v);
                      },
                      textInputAction: TextInputAction.search,
                      style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        color: t.text1,
                      ),
                      decoration: InputDecoration(
                        isDense: true,
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 15),
                        // Katalogda qidiruv mahsulot, xizmat, Business va
                        // NFC ID bo'yicha (server `q`) — shuni aytadi.
                        hintText: tab == DiscoverTab.catalog
                            ? l.catalogSearchHint
                            : l.searchHint,
                      ),
                    ),
                  ),
                  if (query.isNotEmpty)
                    // TOZALASH — BOSISH MAYDONI 44x44, BELGI JOYIDA.
                    //
                    // Ilgari faqat 18x18 belgining o'zi bosilardi: sal
                    // chetga tegilsa matn maydoniga tushib, kursor
                    // surilardi xolos. Shaffof chekka belgini surmaydi:
                    // o'ngda 0 (belgi avvalgidek qator chetida), yuqori
                    // va pastda 13 — qator (~50dp) balandligidan oshmaydi.
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () {
                        _controller.clear();
                        ref.read(searchQueryProvider.notifier).submit('');
                      },
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(26, 13, 0, 13),
                        child:
                            Icon(Icons.close_rounded, size: 18, color: t.text3),
                      ),
                    ),
                ],
              ),
            ),
          ),
          // Balandlik shrift bilan o'sadi: qattiq `40` da 1.3 shriftda
          // "Odamlar"/"Katalog" yorlig'i pastdan kesilardi.
          SizedBox(
            height: Capsule.rowHeight(context),
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              children: [
                for (final e in [
                  (DiscoverTab.people, l.discoverPeople, Icons.person_rounded),
                  (DiscoverTab.businesses, l.discoverBusinesses, Icons.storefront_rounded),
                  (DiscoverTab.catalog, l.discoverCatalog, Icons.grid_view_rounded),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: Gap.sm),
                    child: Capsule(
                      label: e.$2,
                      icon: e.$3,
                      selected: tab == e.$1,
                      onTap: () =>
                          ref.read(discoverTabProvider.notifier).state = e.$1,
                    ),
                  ),
              ],
            ),
          ),
          if (tab == DiscoverTab.catalog)
            Expanded(child: CatalogView(query: query))
          else ...[
          if (query.isEmpty && prefs.recentSearches.isNotEmpty)
            _RecentSearches(
              items: prefs.recentSearches,
              onPick: (v) {
                _controller.text = v;
                ref.read(searchQueryProvider.notifier).submit(v);
              },
              onClear: () async {
                await prefs.clearSearches();
                if (mounted) setState(() {});
              },
            ),
          Expanded(
            child: results.when(
              loading: () => const SkeletonList(),
              error: (e, __) => StatePanel.fromError(
                context,
                asAppError(e),
                onRetry: () => ref.invalidate(discoverResultsProvider),
              ),
              data: (all) {
                if (all.isEmpty) {
                  return StatePanel(
                    icon: Icons.search_off_rounded,
                    title: query.isEmpty ? l.stateEmpty : l.stateNoResults,
                    message:
                        query.isEmpty ? l.stateEmptyHint : l.stateNoResultsHint,
                  );
                }
                // BIZNES TOIFALARI — rasmli kataklar (egasi, 2026-09-24).
                final bizCat = ref.watch(discoverBizCategoryProvider);
                final businesses = tab == DiscoverTab.businesses
                    ? all.whereType<Business>().toList()
                    : const <Business>[];
                final items = tab == DiscoverTab.businesses && bizCat != 'all'
                    ? businesses
                        .where((b) =>
                            (b.category.isEmpty ? 'other' : b.category) ==
                            bizCat)
                        .toList()
                    : all;
                final list = ListView.separated(
                  padding: EdgeInsets.fromLTRB(Gap.screenX, Gap.md,
                      Gap.screenX, navSafeBottom(context)),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
                  itemBuilder: (context, i) => _ResultTile(item: items[i]),
                );
                if (businesses.isEmpty) return list;
                return Column(
                  children: [
                    DiscoverBizCategories(
                      businesses: businesses,
                      selected: bizCat,
                      onSelect: (c) => ref
                          .read(discoverBizCategoryProvider.notifier)
                          .state = c,
                    ),
                    Expanded(child: list),
                  ],
                );
              },
            ),
          ),
          ],
        ],
      ),
    );
  }
}

class _RecentSearches extends StatelessWidget {
  const _RecentSearches({
    required this.items,
    required this.onPick,
    required this.onClear,
  });

  final List<String> items;
  final ValueChanged<String> onPick;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: l.searchRecent, action: l.searchClear, onAction: onClear),
        SizedBox(
          height: Capsule.rowHeight(context, base: 36, dense: true),
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            children: [
              for (final e in items)
                Padding(
                  padding: const EdgeInsets.only(right: Gap.sm),
                  child: Capsule(
                    label: e,
                    icon: Icons.history_rounded,
                    dense: true,
                    onTap: () => onPick(e),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({required this.item});
  final Object item;

  @override
  Widget build(BuildContext context) {
    final i = item;
    // Faqat ODAM yoki BIZNES keladi.
    if (i is NfcId) return DiscoverPersonCard(id: i);
    return DiscoverBusinessCard(business: i as Business);
  }
}
