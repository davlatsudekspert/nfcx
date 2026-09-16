import 'dart:async';

import 'package:flutter/material.dart' show RefreshIndicator;
// `SliverGridLayout` va `SliverGridGeometry` — chizish qatlamida.
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/business_hero.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/input.dart';
import '../../design/components/media.dart';
import '../../design/components/nav_bar.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/share.dart';
import '../content/post_detail.dart';
import '../content/story_viewer.dart';
import '../identity/profile_screen.dart';
import '../nfc/id_catalog.dart';

/// QIDIRUV — "boshqalarni topish".
///
/// EKRAN BOSH SAHIFADAN ATAYLAB FARQ QILADI: yorug'lik sovuq va
/// tepa-chapdan tushadi. Ikki ekran bir xil ko'rinsa, ilova
/// "bir xil" his qoldiradi.
///
/// UCH QATLAM:
/// 1. Qidiruv qatori va kategoriya chiplari — doim tepada.
/// 2. So'rov BO'SH bo'lsa: reyting, kompaniyalar va kashfiyot
///    gridi. Ya'ni ekran hech qachon bo'sh turmaydi.
/// 3. So'rov BOR bo'lsa: odamlar va kompaniyalar natijasi.
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  final _query = TextEditingController();
  Timer? _debounce;

  List<Record> _catalog = const [];
  List<Company> _companies = const [];
  List<FeedEntry> _feed = const [];
  List<Map<String, dynamic>> _categories = const [];

  List<Record> _foundPeople = const [];
  List<Company> _foundCompanies = const [];

  String _category = '';
  bool _loading = true;
  bool _searching = false;
  Object? _error;
  bool _loadedOnce = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_loadedOnce) {
      _loadedOnce = true;
      _load();
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  Future<void> _load({bool force = false}) async {
    final repo = AppScope.read(context).repo;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (force) repo.invalidateCatalog();
      // KATALOG — asosiy manba: reyting ham, tavsiya ham shundan
      // quriladi. Serverda alohida reyting endpointi YO'Q, saytda
      // ham reyting `/api/records` dagi ko'rishlar soni bo'yicha
      // hisoblanadi.
      final catalog = await repo.catalog(force: force);

      List<Company> companies = const [];
      try {
        companies = await repo.companies();
      } catch (_) {}

      List<FeedEntry> feed = const [];
      try {
        feed = (await repo.feed(page: 1)).items;
      } catch (_) {}

      List<Map<String, dynamic>> categories = const [];
      try {
        categories = await repo.categories();
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _catalog = catalog;
        _companies = companies;
        _feed = feed;
        _categories = categories;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  /// QIDIRUV 320 ms KUTADI.
  ///
  /// Har bosilgan harf uchun so'rov yuborilsa, server ham, tarmoq
  /// ham ortiqcha yuklanadi va natija sakrab turadi.
  void _onQuery(String value) {
    _debounce?.cancel();
    final q = value.trim();
    if (q.length < 2) {
      setState(() {
        _searching = false;
        _foundPeople = const [];
        _foundCompanies = const [];
      });
      return;
    }
    setState(() => _searching = true);
    _debounce = Timer(const Duration(milliseconds: 320), () => _search(q));
  }

  Future<void> _search(String q) async {
    final repo = AppScope.read(context).repo;
    try {
      final people = await repo.searchRecords(q);
      List<Company> companies = const [];
      try {
        companies = await repo.searchCompanies(q);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _foundPeople = people;
        _foundCompanies = companies;
        _searching = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _searching = false);
    }
  }

  /// Ko'rishlar bo'yicha eng yuqori uchtalik.
  List<Record> get _rating {
    final list = [..._catalog.where((r) => r.views > 0)]
      ..sort((a, b) => b.views.compareTo(a.views));
    return list.take(3).toList();
  }

  List<FeedEntry> get _grid {
    if (_category.isEmpty) return _feed;
    // Kategoriya tanlangan bo'lsa lentani shu toifadagi
    // mualliflarga qisqartiramiz. Serverda lentani toifa bo'yicha
    // filtrlash yo'q, shuning uchun bu mijozda bajariladi.
    final codes = _catalog
        .where((r) => r.categorySlug == _category)
        .map((r) => r.code)
        .toSet();
    return _feed.where((e) => codes.contains(e.code)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final hasQuery = _query.text.trim().length >= 2;

    return ScreenBackdrop(
      aura: Aura.search,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => _load(force: true),
          color: C.accent,
          backgroundColor: C.surface,
          displacement: 28,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: ScreenTitle(
                  tr('Qidiruv'),
                  subtitle: 'Yaxshi joylar. Yangi odamlar. Katta imkoniyatlar.',
                ),
              ),

              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  child: SearchField(
                    controller: _query,
                    hint: tr('Ism, kompaniya yoki ID kodi'),
                    onChanged: _onQuery,
                  ),
                ),
              ),

              // KATEGORIYA CHIPLARI — keshdan darhol chiziladi.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: S.x16),
                  child: _CategoryStrip(
                    categories: _categories,
                    active: _category,
                    onSelect: (slug) => setState(() => _category = slug),
                  ),
                ),
              ),


              if (hasQuery)
                ..._searchSlivers()
              else
                ..._browseSlivers(),

              SliverToBoxAdapter(
                child: SizedBox(height: NavBar.inset(context)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── QIDIRUV NATIJASI ────────────────────────────────────────

  List<Widget> _searchSlivers() {
    if (_searching) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(S.gutter, S.x20, S.gutter, 0),
            child: Column(
              children: List.generate(3, (_) => const SkeletonRow()),
            ),
          ),
        ),
      ];
    }

    if (_foundPeople.isEmpty && _foundCompanies.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: EmptyState(
            tr('Kodni tekshirib ko‘ring yoki katalogdan tanlang.'),
            title: trf('“{q}” topilmadi', {'q': _query.text.trim()}),
            icon: Ico.search,
            actionLabel: tr('ID katalogini ochish'),
            onAction: () => push<void>(context, (_) => const IdCatalogScreen()),
          ),
        ),
      ];
    }

    return [
      if (_foundPeople.isNotEmpty) ...[
        _header(tr('Odamlar')),
        SliverList.separated(
          itemCount: _foundPeople.length,
          separatorBuilder: (_, __) => const SizedBox(height: S.x8),
          itemBuilder: (context, i) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: _PersonRow(record: _foundPeople[i]),
          ),
        ),
      ],
      if (_foundCompanies.isNotEmpty) ...[
        _header(tr('Kompaniyalar')),
        SliverList.separated(
          itemCount: _foundCompanies.length,
          separatorBuilder: (_, __) => const SizedBox(height: S.x8),
          itemBuilder: (context, i) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: _CompanyRow(company: _foundCompanies[i]),
          ),
        ),
      ],
    ];
  }

  // ── KO'RIB CHIQISH ──────────────────────────────────────────

  List<Widget> _browseSlivers() {
    if (_loading && _catalog.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(S.gutter, S.x20, S.gutter, 0),
            child: Column(
              children: [
                ...List.generate(3, (_) => const SkeletonRow()),
                const SizedBox(height: S.x16),
                const SkeletonGrid(count: 6),
              ],
            ),
          ),
        ),
      ];
    }

    if (_error != null && _catalog.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: ErrorState(humanError(_error), detail: errorDetail(_error), onRetry: _load),
        ),
      ];
    }

    final rating = _rating;
    final grid = _grid;

    return [
      if (rating.isNotEmpty) ...[
        _header(tr('Reyting')),
        SliverList.separated(
          itemCount: rating.length,
          separatorBuilder: (_, __) => const SizedBox(height: S.x8),
          itemBuilder: (context, i) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: _RatingRow(rank: i + 1, record: rating[i]),
          ),
        ),
      ],

      if (_companies.isNotEmpty) ...[
        _header(tr('Sizga tavsiya')),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: _FeaturedCompany(company: _companies.first),
          ),
        ),
        if (_companies.length > 1) ...[
          _header(tr('Kompaniyalar')),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: GridView.builder(
              physics: const NeverScrollableScrollPhysics(),
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: (_companies.length - 1).clamp(0, 5),
              gridDelegate:
                  const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: S.x12,
                mainAxisSpacing: S.x12,
                childAspectRatio: .92,
              ),
              itemBuilder: (context, i) =>
                  _CompanyCard(company: _companies[i + 1]),
            ),
          ),
        ),
        ],
      ],

      if (grid.isNotEmpty) ...[
        _header(tr('Qidiruv')),
        SliverToBoxAdapter(
          child: _MixedGrid(
            items: grid,
            onOpen: (e) => push<void>(
              context,
              (_) => e.isStory
                  ? StoryViewerScreen(code: e.code)
                  : PostDetailScreen(
                      post: Post(
                        id: '${e.id}',
                        caption: e.caption,
                        images: [
                          if ((e.imageUrl ?? '').isNotEmpty) e.imageUrl!,
                        ],
                        videoUrl: e.videoUrl,
                        createdAt: e.createdAt,
                        likes: e.likeCount,
                        liked: e.liked,
                        authorName: e.name,
                        authorAvatar: e.avatarUrl,
                        authorCode: e.code,
                      ),
                      commentKind: e.commentTarget,
                    ),
            ),
          ),
        ),
      ] else if (_category.isNotEmpty)
        SliverToBoxAdapter(
          child: EmptyState(
            tr('Bu toifada hozircha kontent yo‘q.'),
            title: tr('Bo‘sh'),
            icon: Ico.grid,
            compact: true,
          ),
        ),
    ];
  }

  Widget _header(String title) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            S.gutter,
            S.x32,
            S.gutter,
            S.x12,
          ),
          child: SectionHeader(title),
        ),
      );
}

// ─────────────────────────────────────────────────────────────

class _CategoryStrip extends StatelessWidget {
  const _CategoryStrip({
    required this.categories,
    required this.active,
    required this.onSelect,
  });

  final List<Map<String, dynamic>> categories;
  final String active;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 38,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          itemCount: categories.length + 1,
          separatorBuilder: (_, __) => const SizedBox(width: S.x8),
          itemBuilder: (context, i) {
            if (i == 0) {
              return FilterChip(
                tr('Hammasi'),
                active: active.isEmpty,
                onTap: () => onSelect(''),
              );
            }
            final c = categories[i - 1];
            final slug = '${c['slug'] ?? ''}';
            final name = '${c['nameUz'] ?? c['slug'] ?? ''}';
            return FilterChip(
              name,
              active: active == slug,
              onTap: () => onSelect(slug),
            );
          },
        ),
      );
}

/// Qidiruv natijasidagi qator.
class _PersonRow extends StatelessWidget {
  const _PersonRow({required this.record});

  final Record record;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        onTap: () => push<void>(
          context,
          (_) => ProfileScreen(code: record.code),
        ),
        child: Row(
          children: [
            Avatar(
              url: record.avatarUrl,
              name: record.name,
              size: 48,
              square: record.isBusiness,
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          record.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.cardTitle,
                        ),
                      ),
                      if (record.verified) ...[
                        const SizedBox(width: 5),
                        const VerifiedBadge(size: 14),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    profileHandle(context, record.code,
                        company: record.isBusiness),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.link,
                  ),
                ],
              ),
            ),
            const SizedBox(width: S.x8),
            TierDot(record.tier, size: 14),
          ],
        ),
      );
}

/// Kompaniya qatori — qidiruv natijasida.
class _CompanyRow extends StatelessWidget {
  const _CompanyRow({required this.company});

  final Company company;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        onTap: () => push<void>(
          context,
          (_) => ProfileScreen(companyId: company.id),
        ),
        child: Row(
          children: [
            Avatar(
              url: company.logoUrl,
              name: company.name,
              size: 48,
              square: true,
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          company.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.cardTitle,
                        ),
                      ),
                      if (company.verified) ...[
                        const SizedBox(width: 5),
                        const VerifiedBadge(size: 14),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    profileHandle(context, company.id, company: true),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.link,
                  ),
                ],
              ),
            ),
            if (company.isOpen != null) ...[
              const SizedBox(width: S.x8),
              StatusChip(
                company.isOpen! ? tr('Ochiq') : tr('Yopiq'),
                tone: company.isOpen! ? StatusTone.ok : StatusTone.neutral,
              ),
            ],
          ],
        ),
      );
}

/// Reyting qatori — o'rin raqami mono bilan.
class _RatingRow extends StatelessWidget {
  const _RatingRow({required this.rank, required this.record});

  final int rank;
  final Record record;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        onTap: () => push<void>(
          context,
          (_) => ProfileScreen(code: record.code),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 22,
              child: Text(
                '$rank',
                textAlign: TextAlign.center,
                style: T.statValue.copyWith(
                  fontSize: 17,
                  color: rank == 1 ? C.accent : C.ink3,
                ),
              ),
            ),
            const SizedBox(width: S.x8),
            Avatar(
              url: record.avatarUrl,
              name: record.name,
              size: 40,
              square: record.isBusiness,
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    record.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.cardTitle,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    profileHandle(context, record.code,
                        company: record.isBusiness),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.link,
                  ),
                ],
              ),
            ),
            const SizedBox(width: S.x8),
            Text(som(record.views), style: T.amount.copyWith(fontSize: 13)),
          ],
        ),
      );
}

/// Qidiruv lentasining katta vitrinası. Birinchi kompaniya rasm, nom,
/// holat va joylashuvni bitta editorial kompozitsiyada beradi; qolgan
/// kompaniyalar pastdagi gridda qoladi. Shu sababli API katalogi
/// qisqarmaydi, faqat uning vizual ierarxiyasi o'zgaradi.
class _FeaturedCompany extends StatelessWidget {
  const _FeaturedCompany({required this.company});

  final Company company;

  @override
  Widget build(BuildContext context) => Surface(
        padding: EdgeInsets.zero,
        radius: R.card,
        glow: company.verified,
        onTap: () => push<void>(
          context,
          (_) => ProfileScreen(companyId: company.id),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(R.card),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                BusinessHero(imageUrl: company.coverUrl ?? company.logoUrl),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x00000000), Color(0xE9000000)],
                      stops: [.26, 1],
                    ),
                  ),
                ),
                Positioned(
                  top: S.x12,
                  left: S.x12,
                  child: GlassPanel(
                    radius: R.status,
                    padding: const EdgeInsets.symmetric(horizontal: S.x8, vertical: 6),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Avatar(url: company.logoUrl, name: company.name, size: 20, square: true),
                        const SizedBox(width: 6),
                        Text(tr('Biznes'), style: T.meta.copyWith(color: C.ink, fontSize: 9)),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  left: S.x16,
                  right: S.x16,
                  bottom: S.x16,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              company.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: T.section.copyWith(fontSize: 26),
                            ),
                          ),
                          if (company.verified) ...[
                            const SizedBox(width: 7),
                            const VerifiedBadge(size: 17),
                          ],
                        ],
                      ),
                      const SizedBox(height: 5),
                      Row(
                        children: [
                          if (company.city.isNotEmpty)
                            Flexible(
                              child: Text(company.city, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.caption.copyWith(color: C.ink2)),
                            ),
                          if (company.city.isNotEmpty && company.itemCount > 0)
                            Text(' · ', style: T.caption.copyWith(color: C.ink3)),
                          if (company.itemCount > 0)
                            Text(trf('{n} mahsulot', {'n': '${company.itemCount}'}), style: T.caption.copyWith(color: C.accent)),
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

/// Kompaniya kartasi — ikki ustunli grid uchun.
class _CompanyCard extends StatelessWidget {
  const _CompanyCard({required this.company});

  final Company company;

  @override
  Widget build(BuildContext context) => Surface(
        padding: EdgeInsets.zero,
        glow: company.verified,
        onTap: () => push<void>(
          context,
          (_) => ProfileScreen(companyId: company.id),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(R.card),
              ),
              child: AspectRatio(
                aspectRatio: 16 / 10,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    BusinessHero(
                      imageUrl: company.coverUrl ?? company.logoUrl,
                      compact: true,
                    ),
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Color(0x08000000), Color(0xC9000000)],
                          stops: [.2, 1],
                        ),
                      ),
                    ),
                    Positioned(
                      left: S.x8,
                      top: S.x8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: S.x8,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xB8000000),
                          borderRadius: BorderRadius.circular(R.status),
                          border: Border.all(color: C.lineStrong),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            NIcon(Ico.building, size: 12, color: C.accent),
                            const SizedBox(width: 5),
                            Text(
                              company.isOpen == null
                                  ? tr('Biznes')
                                  : company.isOpen!
                                      ? tr('Ochiq')
                                      : tr('Yopiq'),
                              style: T.meta.copyWith(
                                color: C.ink,
                                fontSize: 9,
                                letterSpacing: .8,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Positioned(
                      left: S.x12,
                      right: S.x12,
                      bottom: S.x8,
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              company.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: T.cardTitle.copyWith(color: C.ink),
                            ),
                          ),
                          if (company.verified) ...[
                            const SizedBox(width: 5),
                            const VerifiedBadge(size: 14),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(S.x12, S.x8, S.x12, S.x12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      [
                        if (company.city.isNotEmpty) company.city,
                        if (company.itemCount > 0)
                          trf('{n} mahsulot', {'n': '${company.itemCount}'}),
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.caption.copyWith(fontSize: 12),
                    ),
                  ),
                  NIcon(Ico.chevronRight, size: 15, color: C.accent),
                ],
              ),
            ),
          ],
        ),
      );
}

/// MEDIA GRIDI — 3 ustun, 3 dp oraliq.
///
/// Reels katakchalari IKKI BARAVAR katta (2×2) va yashil belgi
/// bilan: lenta bir xil kvadratlardan iborat bo'lsa, ko'z hech
/// nimaga ilashmaydi.
class _MixedGrid extends StatelessWidget {
  const _MixedGrid({required this.items, required this.onOpen});

  final List<FeedEntry> items;
  final ValueChanged<FeedEntry> onOpen;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      padding: const EdgeInsets.symmetric(horizontal: 3),
      itemCount: items.length,
      gridDelegate: const SliverQuiltedGridDelegate(),
      itemBuilder: (context, i) => _GridTile(
        item: items[i],
        onTap: () => onOpen(items[i]),
      ),
    );
  }
}

/// Har uchinchi katakcha ikki barobar — "quilted" naqsh.
///
/// `SliverGridDelegate` ni qo'lda yozamiz: Flutter'da tayyor
/// "quilted" delegat yo'q va qo'shimcha paket olib kelishga
/// arzimaydi.
class SliverQuiltedGridDelegate extends SliverGridDelegate {
  const SliverQuiltedGridDelegate({this.spacing = 3});

  final double spacing;

  @override
  SliverGridLayout getLayout(SliverConstraints constraints) {
    final cell = (constraints.crossAxisExtent - spacing * 2) / 3;
    return _QuiltedLayout(cell: cell, spacing: spacing);
  }

  @override
  bool shouldRelayout(SliverQuiltedGridDelegate old) =>
      old.spacing != spacing;
}

class _QuiltedLayout extends SliverGridLayout {
  const _QuiltedLayout({required this.cell, required this.spacing});

  final double cell;
  final double spacing;

  double get _step => cell + spacing;

  /// Naqsh sakkiztalik blokdan iborat: bitta katta (2×2) va oltita
  /// kichik. Blok ikki qatorni egallaydi.
  static const _pattern = [
    // (ustun, qator, kenglik, balandlik)
    [0, 0, 2, 2],
    [2, 0, 1, 1],
    [2, 1, 1, 1],
    [0, 2, 1, 1],
    [1, 2, 1, 1],
    [2, 2, 1, 1],
  ];

  static const _rowsPerBlock = 3;

  @override
  double computeMaxScrollOffset(int childCount) {
    final blocks = (childCount / _pattern.length).ceil();
    return blocks * _rowsPerBlock * _step;
  }

  @override
  SliverGridGeometry getGeometryForChildIndex(int index) {
    final block = index ~/ _pattern.length;
    final p = _pattern[index % _pattern.length];
    return SliverGridGeometry(
      scrollOffset: (block * _rowsPerBlock + p[1]) * _step,
      crossAxisOffset: p[0] * _step,
      mainAxisExtent: p[3] * cell + (p[3] - 1) * spacing,
      crossAxisExtent: p[2] * cell + (p[2] - 1) * spacing,
    );
  }

  @override
  int getMinChildIndexForScrollOffset(double scrollOffset) {
    final block = (scrollOffset / (_rowsPerBlock * _step)).floor();
    return (block * _pattern.length).clamp(0, 1 << 30);
  }

  @override
  int getMaxChildIndexForScrollOffset(double scrollOffset) {
    final block = (scrollOffset / (_rowsPerBlock * _step)).ceil();
    return ((block + 1) * _pattern.length).clamp(0, 1 << 30);
  }
}

class _GridTile extends StatelessWidget {
  const _GridTile({required this.item, required this.onTap});

  final FeedEntry item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .98,
        child: Stack(
          fit: StackFit.expand,
          children: [
            NetImage(item.imageUrl, radius: 2, slotIcon: Ico.image),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x05000000), Color(0x9E000000)],
                  stops: [.35, 1],
                ),
              ),
            ),
            if ((item.videoUrl ?? '').isNotEmpty)
              Positioned(
                left: 6,
                top: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xB8000000),
                    borderRadius: BorderRadius.circular(5),
                    border: Border.all(color: C.lineStrong),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      NIcon(Ico.play, size: 9, color: C.accent, filled: true),
                      const SizedBox(width: 4),
                      Text(
                        'VIDEO',
                        style: T.meta.copyWith(
                          fontSize: 8.5,
                          color: C.ink,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Positioned(
              left: 6,
              right: 6,
              bottom: 6,
              child: Row(
                children: [
                  if (item.likeCount > 0) ...[
                    NIcon(Ico.heart, size: 11, color: C.accent, filled: true),
                    const SizedBox(width: 4),
                    Text(
                      som(item.likeCount),
                      style: T.meta.copyWith(fontSize: 10, color: C.ink),
                    ),
                  ],
                  const Spacer(),
                  if (item.name.trim().isNotEmpty)
                    Flexible(
                      child: Text(
                        item.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                        style: T.meta.copyWith(
                          fontSize: 9,
                          color: C.ink.withValues(alpha: .88),
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
