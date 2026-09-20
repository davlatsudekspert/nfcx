import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
import '../../routing/routes.dart';
import '../social/feed_card.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';

enum DiscoverTab { people, businesses, posts }

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

final discoverResultsProvider = FutureProvider.autoDispose((ref) async {
  final q = ref.watch(searchQueryProvider);
  final tab = ref.watch(discoverTabProvider);
  final repo = ref.watch(discoverRepositoryProvider);

  if (q.isEmpty) {
    return switch (tab) {
      DiscoverTab.people => (await repo.suggested()).when(
          ok: (v) => <Object>[...v], err: (e) => throw e),
      // Ilgari bu yerda QATTIQ KODLANGAN bo'sh ro'yxat turardi va
      // "Bizneslar" bo'limi so'rovsiz holatda har doim "Hozircha
      // bo'sh" deb ko'rsatardi — produksiyada kompaniyalar bo'lsa
      // ham. Server ro'yxatni allaqachon beradi.
      DiscoverTab.businesses => (await repo.companies())
          .when(ok: (v) => <Object>[...v], err: (e) => throw e),
      DiscoverTab.posts =>
        (await repo.trending()).when(ok: (v) => <Object>[...v], err: (e) => throw e),
    };
  }

  return switch (tab) {
    DiscoverTab.people => (await repo.searchPeople(q))
        .when(ok: (v) => <Object>[...v], err: (e) => throw e),
    DiscoverTab.businesses => (await repo.searchBusinesses(q))
        .when(ok: (v) => <Object>[...v], err: (e) => throw e),
    DiscoverTab.posts => (await repo.trending()).when(
        ok: (v) => <Object>[
              ...v.where((p) =>
                  p.text.toLowerCase().contains(q.toLowerCase()) ||
                  p.authorName.toLowerCase().contains(q.toLowerCase()))
            ],
        err: (e) => throw e),
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
              decoration: BoxDecoration(
                color: t.surface2,
                borderRadius: R.pill,
                border: Border.all(color: t.border2),
              ),
              padding: const EdgeInsets.symmetric(horizontal: Gap.lg),
              child: Row(
                children: [
                  Icon(Icons.search_rounded, size: 19, color: t.text3),
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
                        hintText: l.searchHint,
                      ),
                    ),
                  ),
                  if (query.isNotEmpty)
                    GestureDetector(
                      onTap: () {
                        _controller.clear();
                        ref.read(searchQueryProvider.notifier).submit('');
                      },
                      child: Icon(Icons.close_rounded, size: 18, color: t.text3),
                    ),
                ],
              ),
            ),
          ),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              children: [
                for (final e in [
                  (DiscoverTab.people, l.discoverPeople, Icons.person_rounded),
                  (DiscoverTab.businesses, l.discoverBusinesses, Icons.storefront_rounded),
                  (DiscoverTab.posts, l.homePosts, Icons.article_rounded),
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
              data: (items) => items.isEmpty
                  ? StatePanel(
                      icon: Icons.search_off_rounded,
                      title: query.isEmpty ? l.stateEmpty : l.stateNoResults,
                      message: query.isEmpty ? l.stateEmptyHint : l.stateNoResultsHint,
                    )
                  : ListView.separated(
                      padding: EdgeInsets.fromLTRB(Gap.screenX, Gap.md,
                          Gap.screenX, navSafeBottom(context)),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
                      itemBuilder: (context, i) => _ResultTile(item: items[i]),
                    ),
            ),
          ),
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
          height: 36,
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
    final t = context.tokens;

    if (item is NfcId) {
      final e = item as NfcId;
      return FloatingSurface(
        solid: true,
        padding: const EdgeInsets.all(Gap.lg),
        onTap: () => context.push(Routes.user(e.code)),
        child: Row(
          children: [
            Avatar(url: e.avatarUrl, initials: _initials(e.name, e.code), size: 46),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.name.isEmpty ? e.code : e.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall),
                  Text(e.code,
                      style: AppType.monoStyle(color: t.text3, size: 11)),
                ],
              ),
            ),
            Text(formatCount(e.followers),
                style: Theme.of(context).textTheme.labelMedium),
          ],
        ),
      );
    }

    if (item is Business) {
      final e = item as Business;
      return FloatingSurface(
        solid: true,
        padding: const EdgeInsets.all(Gap.lg),
        onTap: () => context.push(Routes.storefront(e.companyId)),
        child: Row(
          children: [
            Avatar(
                url: e.logoUrl,
                initials: _initials(e.displayName, e.companyId),
                size: 46,
                ring: false),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(e.displayName.isEmpty ? e.companyId : e.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall),
                  Text(
                    [e.city, e.subcategory].where((s) => s.isNotEmpty).join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 20, color: t.text3),
          ],
        ),
      );
    }

    // POST — LENTA KARTASI BILAN BIR XIL.
    //
    // Ilgari Kashfiyotdagi post kartasi bosh ekrandagidan boshqacha
    // edi va unda layk/izoh/ulashish yo'q edi. Endi ikkala joyda
    // bitta `FeedCard` ishlatiladi: xulq ham, ko'rinish ham bir xil
    // bo'ladi va holat avtomatik sinxron qoladi.
    return FeedCard(post: item as Post);
  }

  String _initials(String name, String fallback) {
    final s = name.trim().isEmpty ? fallback : name.trim();
    return (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
  }
}
