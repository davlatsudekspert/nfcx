import 'dart:async';

import 'package:flutter/material.dart' show RefreshIndicator;
// `SliverGridLayout` va `SliverGridGeometry` — chizish qatlamida.
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/input.dart';
import '../../design/components/media.dart';
import '../../design/components/nav_bar.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../design/refresh.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/share.dart';
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

      // Lenta so'rovi olib tashlandi: u faqat "Kashfiyot" to'ri
      // uchun kerak edi va u bo'lim endi yo'q. Ya'ni Qidiruv
      // ochilishi uchun bitta tarmoq so'rovi kam.

      List<Map<String, dynamic>> categories = const [];
      try {
        categories = await repo.categories();
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _catalog = catalog;
        _companies = companies;
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
  /// QIDIRUV NATIJASI — shaxsiy va biznes profillar birga.
  ///
  /// Saytdagi katalog bilan bir xil mantiq: yozilgan so'z kod,
  /// ism yoki kompaniya nomiga to'g'ri kelsa chiqadi; toifa
  /// tanlansa shu bo'yicha suziladi.
  ///
  /// Ikkalasi BIR RO'YXATDA, chunki odam "kim" yoki "qaysi
  /// kompaniya" deb izlaydi — ularni ikki joyga bo'lish qidiruvni
  /// qiyinlashtirardi. Biznes kartada bino belgisi turadi.
  List<_Entry> get _profiles {
    final q = _query.text.trim().toLowerCase();
    bool hit(String a, String b, String c) =>
        q.isEmpty ||
        a.toLowerCase().contains(q) ||
        b.toLowerCase().contains(q) ||
        c.toLowerCase().contains(q);

    return [
      for (final r in _catalog)
        if (hit(r.code, r.name, r.role) &&
            (_category.isEmpty || r.categorySlug == _category))
          _Entry.person(r),
      for (final c in _companies)
        // Kompaniyada toifa maydoni yo'q — toifa tanlangan
        // bo'lsa ular ro'yxatga kirmaydi.
        if (hit(c.id, c.name, c.city) && _category.isEmpty)
          _Entry.business(c),
    ];
  }

  List<Record> get _rating {
    final list = [..._catalog.where((r) => r.views > 0)]
      ..sort((a, b) => b.views.compareTo(a.views));
    return list.take(3).toList();
  }


  @override
  Widget build(BuildContext context) {
    final hasQuery = _query.text.trim().length >= 2;

    return ScreenBackdrop(
      aura: Aura.search,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => pullRefresh(() => _load(force: true)),
          color: C.accent,
          backgroundColor: C.surface,
          displacement: 28,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(child: ScreenTitle(tr('Qidiruv'))),

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
        _header(tr('Kompaniyalar')),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: GridView.builder(
              physics: const NeverScrollableScrollPhysics(),
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: _companies.length.clamp(0, 6),
              gridDelegate:
                  const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: S.x12,
                mainAxisSpacing: S.x12,
                childAspectRatio: .92,
              ),
              itemBuilder: (context, i) =>
                  _CompanyCard(company: _companies[i]),
            ),
          ),
        ),
      ],

      // PROFILLAR — SAYTDAGI KATALOG KABI.
      //
      // Bu yerda ilgari "Kashfiyot" turardi: post va istorya
      // rasmlarining aralash to'ri. Egasi: "kashfiyot nima degan,
      // olib tashlash kerak, bu yerda personal va biznes profillar
      // turishi kerak, bosa profiliga kirsin".
      //
      // To'g'ri e'tiroz edi. Qidiruv tabining vazifasi — ODAM VA
      // KOMPANIYA topish. Rasmlar to'ri esa Reels bilan bir xil
      // ishni qilardi va bosilganda postga olib borardi, ya'ni
      // qidirilayotgan narsaga emas.
      //
      // Endi saytdagi katalog bilan bir xil: kod, ism, tarif
      // belgisi, ko'rishlar soni va toifa. Bosilsa — o'sha
      // profilning o'zi ochiladi.
      if (_profiles.isNotEmpty) ...[
        _header(tr('Profillar')),
        SliverList.separated(
          itemCount: _profiles.length,
          separatorBuilder: (_, __) => const SizedBox(height: S.x8),
          itemBuilder: (context, i) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: _ProfileCard(entry: _profiles[i]),
          ),
        ),
      ] else if (_query.text.trim().isNotEmpty || _category.isNotEmpty)
        SliverToBoxAdapter(
          child: EmptyState(
            tr('Boshqa so‘z yoki toifa bilan qidirib ko‘ring.'),
            title: tr('Topilmadi'),
            icon: Ico.search,
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

/// Qidiruv natijasidagi bitta yozuv — shaxsiy yoki biznes.
class _Entry {
  const _Entry.person(this.record)
      : company = null,
        isBusiness = false;
  const _Entry.business(this.company)
      : record = null,
        isBusiness = true;

  final Record? record;
  final Company? company;
  final bool isBusiness;

  String get code => isBusiness ? company!.id : record!.code;
  String get name => isBusiness ? company!.name : record!.name;
  String? get avatarUrl => isBusiness ? company!.logoUrl : record!.avatarUrl;
  bool get verified => isBusiness ? company!.verified : record!.verified;
  int get views => isBusiness ? company!.views : record!.views;
  String get note => isBusiness ? company!.city : record!.role;
  Tier get tier => isBusiness
      ? TierStyle.parse(company!.tier)
      : TierStyle.parse(record!.serverTier);
}

/// PROFIL KARTASI — saytdagi katalogdagi kabi.
///
/// Chapda avatar, o'rtada KOD (mono, katta) va ism, o'ngda
/// ko'rishlar soni. Tarif belgisi kodning yonida — saytda ham
/// shunday.
class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.entry});

  final _Entry entry;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        onTap: () => push<void>(
          context,
          (_) => entry.isBusiness
              ? ProfileScreen(companyId: entry.code)
              : ProfileScreen(code: entry.code),
        ),
        child: Row(
          children: [
            Avatar(
              url: entry.avatarUrl,
              name: entry.name,
              size: 46,
              square: entry.isBusiness,
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
                          entry.code.toUpperCase(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.code(14, color: C.ink),
                        ),
                      ),
                      const SizedBox(width: 6),
                      TierDot(entry.tier, size: 10),
                      if (entry.verified) ...[
                        const SizedBox(width: 5),
                        const VerifiedBadge(size: 13),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [entry.name, if (entry.note.isNotEmpty) entry.note]
                        .join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.caption.copyWith(color: C.ink2),
                  ),
                ],
              ),
            ),
            const SizedBox(width: S.x8),
            Text(som(entry.views), style: T.meta),
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

/// Kompaniya kartasi — ikki ustunli grid uchun.
class _CompanyCard extends StatelessWidget {
  const _CompanyCard({required this.company});

  final Company company;

  @override
  Widget build(BuildContext context) => Surface(
        padding: EdgeInsets.zero,
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
                child: NetImage(
                  company.coverUrl ?? company.logoUrl,
                  radius: 0,
                  slotIcon: Ico.building,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(S.x12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    company.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.cardTitle,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      if (company.city.isNotEmpty) company.city,
                      if (company.itemCount > 0)
                        trf('{n} mahsulot', {'n': '${company.itemCount}'}),
                    ].join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.caption.copyWith(fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
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

