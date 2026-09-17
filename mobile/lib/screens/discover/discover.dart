import 'dart:async';

import 'package:flutter/material.dart' show RefreshIndicator;
// `SliverGridLayout` va `SliverGridGeometry` — chizish qatlamida.
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/icons.dart';
import '../shell.dart';
import '../../design/components/logo.dart';
import '../../design/components/buttons.dart';
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
import '../content/reels.dart';
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

  /// So'ralgan matn ID KODIGA o'xshaydimi.
  ///
  /// Kod — harf va raqamlardan iborat, 3 dan 15 tagacha. Bo'shliq
  /// yoki tinish belgisi bo'lsa, bu ism yoki kompaniya nomi.
  static final _codeLike = RegExp(r'^[A-Za-z0-9]{3,15}$');

  Future<void> _search(String q) async {
    final repo = AppScope.read(context).repo;
    try {
      var people = await repo.searchRecords(q);
      List<Company> companies = const [];
      try {
        companies = await repo.searchCompanies(q);
      } catch (_) {}

      // KOD BO'YICHA QIDIRUV — ALOHIDA SO'ROV.
      //
      // `/api/records/search` ISM bo'yicha qidiradi. Odam esa
      // ko'pincha aynan KODNI yozadi ("VIP001", "AAA729") va
      // ro'yxat bo'sh qaytardi — qidiruv umuman ishlamayotgandek
      // tuyulardi. Endi kodga o'xshash matn uchun yozuvning o'zi
      // ham so'raladi; topilmasa do'kon katalogidan qidiriladi
      // (o'sha kod sotuvda bo'lishi mumkin). Hech qanday kod
      // qo'lda yozilmagan — ikkala manba ham serverdan.
      final code = q.trim().toUpperCase();
      if (people.isEmpty && _codeLike.hasMatch(code)) {
        Record? exact;
        try {
          exact = await repo.record(code);
        } catch (_) {
          try {
            final catalog = await repo.catalog();
            for (final r in catalog) {
              if (r.code.toUpperCase() == code) {
                exact = r;
                break;
              }
            }
          } catch (_) {}
        }
        if (exact != null) people = [exact];
      }

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
  /// PROFIL TURI FILTRI (prototip: Hammasi · Shaxsiy · Ekspert ·
  /// Biznes). Kalitlar `Record.profileType` bilan bir xil.
  static const _kinds = <({String key, String label})>[
    (key: '', label: 'Hammasi'),
    (key: 'personal', label: 'Shaxsiy'),
    (key: 'expert', label: 'Ekspert'),
    (key: 'business', label: 'Biznes'),
  ];
  String _kind = '';

  /// KO'RINADIGAN KOMPANIYALAR — tur va soha filtri bilan.
  List<Company> get _shownCompanies {
    if (_kind.isNotEmpty && _kind != 'business') return const [];
    if (_category.isEmpty) return _companies;
    return _companies
        .where((c) => c.category.toLowerCase() == _category.toLowerCase())
        .toList();
  }

  /// KO'RINADIGAN SHAXSIY PROFILLAR.
  ///
  /// Ko'rish soni bo'yicha saralanadi: ro'yxat tepasida faol
  /// profillar tursin, yangi ochilgan bo'sh profillar emas.
  List<Record> get _shownPeople {
    if (_kind == 'business') return const [];
    final list = _catalog
        .where((r) => _kind.isEmpty || r.profileType == _kind)
        .where((r) => _category.isEmpty || r.categorySlug == _category)
        .toList()
      ..sort((a, b) => b.views.compareTo(a.views));
    return list;
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
              // SARLAVHA QATORI — brend yorlig'i va skanerlash
              // (prototip: `.topbar`). Qidiruvdan NFC'ga o'tish eng
              // tez yo'l: kod yozgandan ko'ra kartani tegizish
              // qulayroq.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(S.gutter, S.x12, S.gutter, 0),
                  child: Row(
                    children: [
                      const BrandTag(),
                      const Spacer(),
                      RoundButton(
                        Ico.scan,
                        size: 38,
                        iconSize: 18,
                        onTap: () => ShellScope.maybeOf(context)?.goTab(2),
                      ),
                    ],
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: ScreenTitle(
                  tr('Kimni'),
                  accent: tr('topamiz?'),
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

              // PROFIL TURI — prototipdagi birinchi chiplar qatori.
              //
              // Kategoriya (soha) bilan aralashtirilmaydi: bu ikki
              // xil savol — "kim?" va "qaysi sohada?".
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: S.x16),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: Row(
                      children: [
                        for (final kind in _kinds) ...[
                          FilterChip(
                            tr(kind.label),
                            active: _kind == kind.key,
                            onTap: () => setState(() => _kind = kind.key),
                          ),
                          if (kind != _kinds.last) const SizedBox(width: S.x8),
                        ],
                      ],
                    ),
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

    final companies = _shownCompanies;
    final people = _shownPeople;
    final grid = _grid;

    if (companies.isEmpty && people.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: EmptyState(
            tr('Boshqa soha yoki turni tanlab ko‘ring.'),
            title: tr('Bu filtrda hech kim yo‘q'),
            icon: Ico.search,
            compact: true,
          ),
        ),
      ];
    }

    return [
      // KOMPANIYALAR — ikki ustunli kartalar (prototip).
      //
      // Ro'yxat emas, KARTA: kompaniyani odam avval RASMIDAN
      // taniydi. Bir qatorli ro'yxatda esa hammasi bir xil
      // ko'rinardi va tanlash uchun har birini ochish kerak edi.
      if (companies.isNotEmpty) ...[
        _header(
          tr('Kompaniyalar'),
          trailing: companies.length > 6 ? tr('Hammasi') : null,
          onTrailing: companies.length > 6
              ? () => setState(() => _kind = 'business')
              : null,
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: GridView.builder(
              physics: const NeverScrollableScrollPhysics(),
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: _kind == 'business'
                  ? companies.length
                  : companies.length.clamp(0, 6),
              // KOMPANIYALAR SHAXSIY PROFILLAR BILAN BIR OILADA.
              //
              // Ilgari bu yerda 16:10 rasm bilan ikki ustunli grid
              // turardi — u ilovadagi boshqa hech bir ro'yxatga
              // o'xshamas va qidiruv sahifasi ikki xil dizayn
              // tilida chiqardi. Endi kompaniya ham, odam ham
              // BIR XIL qator: bir xil yuza, radius, ichki bo'shliq
              // va bosilish hissi. Farqni kvadrat logotip va
              // "Biznes" belgisi ko'rsatadi, boshqa maket emas.
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 1,
                mainAxisSpacing: S.x12,
                mainAxisExtent: 84,
              ),
              itemBuilder: (context, i) => _CompanyRow(company: companies[i]),
            ),
          ),
        ),
      ],

      // SHAXSIY PROFILLAR — qatorlar (prototip).
      if (people.isNotEmpty) ...[
        _header(tr('Shaxsiy profillar')),
        SliverList.separated(
          itemCount: _kind.isEmpty ? people.length.clamp(0, 8) : people.length,
          separatorBuilder: (_, __) => const SizedBox(height: S.x8),
          itemBuilder: (context, i) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: _PersonRow(record: people[i]),
          ),
        ),
      ],

      // SOHA TANLANGANDA — o'sha sohadagi kontent.
      //
      // Standart ko'rinishda bu blok YO'Q (prototipda ham): u
      // yerda odam "kimni topamiz?" deb qidiryapti, lenta emas.
      if (_category.isNotEmpty && grid.isNotEmpty) ...[
        _header(tr('Kontent')),
        SliverToBoxAdapter(
          child: _MixedGrid(
            items: grid,
            onOpen: (e) => push<void>(
              context,
              (_) => e.isStory
                  ? StoryViewerScreen(code: e.code)
                  // VIDEO → REELS (grid'dagi yashil belgili
                  // katakchalar aynan shular).
                  : (e.videoUrl ?? '').trim().isNotEmpty
                      ? ReelsScreen(startKind: e.kind, startId: e.id)
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
      ],
    ];
  }

  Widget _header(String title, {String? trailing, VoidCallback? onTrailing}) =>
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            S.gutter,
            S.x32,
            S.gutter,
            S.x12,
          ),
          child: SectionHeader(
            title,
            actionLabel: trailing,
            onAction: onTrailing,
          ),
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
              // "HAMMASI" EMAS, "BARCHA SOHALAR": tepadagi qatorda
              // ham "Hammasi" bor (profil turi) va ikkita bir xil
              // yozuv qaysi biri nimani filtrlashini yashirardi.
              return FilterChip(
                tr('Barcha sohalar'),
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
              size: 52,
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

/// Kompaniya kartasi — ikki ustunli grid uchun.
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
                    border: Border.all(color: C.onMedia3),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      NIcon(Ico.play, size: 9, color: C.onMediaAccent, filled: true),
                      const SizedBox(width: 4),
                      Text(
                        'VIDEO',
                        style: T.meta.copyWith(
                          fontSize: 8.5,
                          color: C.onMedia,
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
