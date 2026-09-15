import 'dart:async';

import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/input.dart';
import '../../design/components/press.dart';
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

  /// TUR BO'YICHA SUZGICH — saytdagi katalogdagi kabi.
  ///
  /// Saytda `/katalog` da to'rtta tugma bor: Hammasi, Shaxsiy,
  /// Ekspert, Biznes. Ilovada faqat faoliyat sohasi bo'yicha
  /// suzish bor edi, ya'ni "menga kompaniyalar kerak" deb
  /// ajratib bo'lmasdi.
  ///
  /// '' — hammasi.
  String _kind = '';
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
  bool _hit(String a, String b, String c) {
    final q = _query.text.trim().toLowerCase();
    return q.isEmpty ||
        a.toLowerCase().contains(q) ||
        b.toLowerCase().contains(q) ||
        c.toLowerCase().contains(q);
  }

  /// SHAXSIY PROFILLAR — kompaniyalarsiz.
  ///
  /// EGASI: "bu yerda kompaniyalarni alohida, personallarni
  /// alohida qilish kerak". Haq edi: ilgari kompaniyalar IKKI
  /// marta chiqardi — tepadagi katta kartalar to'rida va shu
  /// ro'yxatda yana bir marta.
  List<_Entry> get _people {
    if (_kind == 'business') return const [];
    return [
      for (final r in _catalog)
        if (_hit(r.code, r.name, r.role) &&
            (_category.isEmpty || r.categorySlug == _category) &&
            (_kind.isEmpty ||
                (_kind == 'expert' && r.role.trim().isNotEmpty) ||
                (_kind == 'personal' && !r.isBusiness)))
          _Entry.person(r),
    ];
  }

  /// KOMPANIYALAR — o'z bo'limida.
  List<_Entry> get _businesses {
    if (_kind == 'personal' || _kind == 'expert') return const [];
    return [
      for (final c in _companies)
        // Kompaniyada toifa maydoni yo'q — toifa tanlangan
        // bo'lsa ular ro'yxatga kirmaydi.
        if (_hit(c.id, c.name, c.city) && _category.isEmpty)
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
                  child: _KindStrip(
                    active: _kind,
                    onSelect: (k) => setState(() => _kind = k),
                  ),
                ),
              ),

              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: S.x8),
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
        _cardList([for (final r in _foundPeople) _Entry.person(r)]),
      ],
      if (_foundCompanies.isNotEmpty) ...[
        _header(tr('Kompaniyalar')),
        _cardList([for (final c in _foundCompanies) _Entry.business(c)]),
      ],
    ];
  }

  /// Bitta karta uslubi — qidiruvda ham, ro'yxatda ham.
  ///
  /// EGASI: "hammasi kichkina NFC ID ko'rinishida bo'lsin".
  /// Ilgari uch xil karta bor edi: qidiruvda odam uchun bitta,
  /// kompaniya uchun boshqasi, ro'yxatda yana uchinchisi — va
  /// kompaniyalar buning ustiga katta rasmli to'rda turardi. Bitta
  /// narsaning uch xil yuzi "aralashib ketgan" ko'rinish berardi.
  Widget _cardList(List<_Entry> items) => SliverList.separated(
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: S.x8),
        itemBuilder: (context, i) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: _ProfileCard(entry: items[i]),
        ),
      );

  // ── KO'RIB CHIQISH ──────────────────────────────────────────

  List<Widget> _browseSlivers() {
    if (_loading && _catalog.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(S.gutter, S.x20, S.gutter, 0),
            child: Column(
              children: List.generate(6, (_) => const SkeletonRow()),
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
    final people = _people;
    final businesses = _businesses;

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

      // KOMPANIYALAR — SHAXSIY PROFILLARDAN ALOHIDA.
      //
      // Ilgari bu yerda 2 ustunli KATTA kartalar to'ri turardi:
      // har biri muqova rasmi bilan, ekranning yarmini egallab.
      // Egasi: "kompaniya profillari katta bo'lib xunuk bo'lib
      // turibdi, hammasi kichkina NFC ID ko'rinishida bo'lsin".
      //
      // Endi ikkalasi bir xil ixcham kartada va HAR BIRI O'Z
      // BO'LIMIDA — qidirayotgan odam qayerga qarashini biladi.
      if (businesses.isNotEmpty) ...[
        _header(tr('Kompaniyalar')),
        _cardList(businesses),
      ],

      if (people.isNotEmpty) ...[
        _header(tr('Shaxsiy profillar')),
        _cardList(people),
      ],

      if (businesses.isEmpty && people.isEmpty)
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

/// TUR SUZGICHI — Hammasi / Shaxsiy / Ekspert / Biznes.
///
/// Saytdagi katalogdagi to'rtta tugmaning aynan o'zi.
class _KindStrip extends StatelessWidget {
  const _KindStrip({required this.active, required this.onSelect});

  final String active;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final items = <(String, String)>[
      ('', tr('Hammasi')),
      ('personal', tr('Shaxsiy')),
      ('expert', tr('Ekspert')),
      ('business', tr('Biznes')),
    ];

    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: S.x8),
        itemBuilder: (context, i) {
          final (slug, label) = items[i];
          final on = slug == active;
          return Press(
            onTap: on ? null : () => onSelect(slug),
            minSize: 0,
            scale: .95,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: S.x16),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: on ? C.raisedSurface : null,
                borderRadius: BorderRadius.circular(R.chip),
                border: Border.all(
                  color: on ? C.accent.withValues(alpha: .7) : C.line,
                  width: on ? 1.4 : 1,
                ),
              ),
              child: Text(
                label,
                style: T.buttonSm.copyWith(color: on ? C.ink : C.ink2),
              ),
            ),
          );
        },
      ),
    );
  }
}

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
              // "Barcha sohalar" — TEPADAGI "Hammasi" BILAN
              // ADASHMASIN. Ikkalasi bir xil so'z bo'lganda ekranda
              // ikkita bir xil tugma turardi va qaysi biri nimani
              // suzayotgani tushunarsiz edi.
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
            // KO'RISHLAR — saytdagi katalog kartasida ham shunday:
            // ko'z belgisi va son. Raqamning o'zi nimani
            // bildirishini aytmasdi.
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                NIcon(Ico.eye, size: 13, color: C.ink3),
                const SizedBox(width: 4),
                Text(som(entry.views), style: T.meta),
              ],
            ),
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
