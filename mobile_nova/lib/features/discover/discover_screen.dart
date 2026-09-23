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
import '../../design/widgets/id_plate.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import 'catalog_view.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';

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
    return f != 0 ? f : a.companyId.compareTo(b.companyId);
  });
  return out;
}

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
                        // Katalogda qidiruv mahsulot, xizmat, Business va
                        // NFC ID bo'yicha (server `q`) — shuni aytadi.
                        hintText: tab == DiscoverTab.catalog
                            ? l.catalogSearchHint
                            : l.searchHint,
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
    final l = L.of(context);

    if (item is NfcId) {
      final e = item as NfcId;
      return _ProfileCard(
        title: e.name.isEmpty ? e.code : e.name,
        // Kasb yo'q bo'lsa — bo'sh (ilgari tab nomi "Odamlar" yozilardi).
        subtitle: e.role,
        badge: e.code,
        tier: e.tier,
        imageUrl: e.avatarUrl,
        initials: _initials(e.name, e.code),
        rounded: false,
        // PROFILDAGI BILAN AYNAN BIR XIL uchta son va tartib:
        // Postlar · Obunachilar · Obunalar (egasi 2026-09: kartadagi
        // sonlar profilga kirganda "bir-biriga tushmayapti" edi —
        // bu yerda Ko'rishlar turardi va tartib boshqa edi).
        stats: [
          (formatCount(e.posts), l.profilePosts),
          (formatCount(e.followers), l.profileFollowers),
          (formatCount(e.following), l.profileFollowing),
        ],
        onTap: () => context.push(Routes.user(e.code)),
      );
    }

    // Faqat ODAM yoki BIZNES keladi — "Postlar" yorlig'i
    // olib tashlangandan keyin bu ro'yxatga post tushmaydi.
    {
      final e = item as Business;
      final where =
          [e.city, e.subcategory].where((s) => s.isNotEmpty).join(' · ');
      return _ProfileCard(
        title: e.displayName.isEmpty ? e.companyId : e.displayName,
        subtitle: where,
        badge: e.companyId,
        imageUrl: e.logoUrl,
        initials: _initials(e.displayName, e.companyId),
        // Biznes — KVADRAT logotip, shaxsiy — dumaloq avatar.
        // Ikkalasi bir qarashda ajralib tursin.
        rounded: true,
        accentBusiness: true,
        stats: [
          (formatCount(e.views), l.nfcViews),
          (formatCount(e.followers), l.profileFollowers),
        ],
        onTap: () => context.push(Routes.storefront(e.companyId)),
      );
    }
  }

  /// Bosh harflar — ilovaning qolgan joylari bilan BIR XIL qoida:
  /// ikki so'z bo'lsa har birining birinchi harfi (`Aziz Karimov`
  /// -> `AK`, ilgari `AZ` chiqardi), bitta so'z bo'lsa ikki harf.
  String _initials(String name, String fallback) {
    final s = name.trim().isEmpty ? fallback.trim() : name.trim();
    final parts = s.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
  }
}

/// TANLOV BO'LIMIDAGI PROFIL KARTASI.
///
/// Ilgari bu yerda oddiy ro'yxat qatori turardi: kichik avatar,
/// ism, kod va o'ngda bitta raqam. U "texnik ro'yxat" bo'lib
/// ko'rinardi va profilga kirishga undamasdi.
///
/// Endi "NFC Mobile" demo kartalari bilan BIR XIL tilda: surat
/// o'ngda kvadrat ramkada, chapda ism, kichik tavsif va kod
/// kapsulasi, pastda uchta statistika qutisi. Butun yuza
/// bosiladi.
///
/// Rang qat'iy yozilmagan — hammasi `context.tokens` dan, ya'ni
/// mavzu almashganda karta ham o'zgaradi.
class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.title,
    required this.subtitle,
    required this.badge,
    this.tier = '',
    required this.imageUrl,
    required this.initials,
    required this.stats,
    required this.onTap,
    this.rounded = false,
    this.accentBusiness = false,
  });

  final String title;
  final String subtitle;
  final String badge;

  /// NFC ID darajasi — plastinka rangini shu belgilaydi.
  /// Kompaniyada daraja tushunchasi yo'q, shuning uchun bo'sh.
  final String tier;
  final String imageUrl;
  final String initials;

  /// `true` — kvadrat (biznes logotipi), `false` — dumaloq avatar.
  final bool rounded;
  final bool accentBusiness;
  final List<(String, String)> stats;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final accent = accentBusiness ? t.accentB : t.accent2;

    // KARTA FON BILAN QO'SHILIB KETMASIN.
    //
    // Qora mavzuda `surfaceSolid` va fon bir-biriga juda yaqin
    // edi, chegara esa neytral — natijada odam kartasi
    // "ko'rinmas quti" bo'lib qolardi. Endi chetida juda ingichka
    // shampan chiziq bor: quti emas, lekin chegara sezilib
    // turadi.
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: accent.withValues(alpha: .22)),
      ),
      child: FloatingSurface(
      solid: true,
      border: false,
      padding: const EdgeInsets.all(14),
      borderRadius: BorderRadius.circular(24),
      onTap: onTap,
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
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    const SizedBox(height: Gap.sm),
                    // KOD — MAHSULOT, YORLIQ EMAS.
                    //
                    // Ilgari bu yerda kichkina kulrang halqa
                    // ichida 11 dp matn turardi. Odam uni
                    // texnik yorliq deb o'qirdi.
                    //
                    // Tanlov — ro'yxat emas, VITRINA: odam shu
                    // yerda boshqalarning ID'sini ko'radi va
                    // "menikiniyam shunday bo'lsin" deb
                    // o'ylaydi. Shuning uchun kod bu yerda
                    // eng ko'zga tashlanadigan element bo'lishi
                    // kerak.
                    IdPlate(code: badge, tier: tier),
                  ],
                ),
              ),
              const SizedBox(width: Gap.md),
              // SURAT — kartaning eng jonli qismi.
              Container(
                width: 78,
                height: 78,
                decoration: BoxDecoration(
                  borderRadius:
                      BorderRadius.circular(rounded ? 20 : 999),
                  border: Border.all(color: accent.withValues(alpha: .55),
                      width: 1.4),
                ),
                padding: const EdgeInsets.all(3),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(rounded ? 17 : 999),
                  child: Avatar(
                    url: imageUrl,
                    initials: initials,
                    size: 72,
                    ring: false,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: Gap.md),
          Row(
            children: [
              for (var i = 0; i < stats.length; i++) ...[
                if (i > 0) const SizedBox(width: Gap.sm),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        vertical: 9, horizontal: 4),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: t.border2),
                    ),
                    child: Column(
                      children: [
                        Text(stats[i].$1,
                            maxLines: 1,
                            style:
                                AppType.monoStyle(color: t.text1, size: 12)),
                        const SizedBox(height: 2),
                        Text(
                          stats[i].$2,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 8.5,
                            color: t.text3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
      ),
    );
  }
}
