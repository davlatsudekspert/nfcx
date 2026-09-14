import 'dart:async';
import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/material.dart' show TextField, InputDecoration, InputBorder, Material, MaterialType;
import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../identity/id_chip.dart';
import '../identity/profile_screen.dart';
import '../../l10n/strings.dart';

/// DISCOVER — bitta qidiruv yuzasi: odamlar, bizneslar, mahsulotlar va
/// bo'sh NFC ID'lar. Eski "Katalog" ning o'rnini bosadi.
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  final _query = TextEditingController();
  Timer? _debounce;

  List<Record> _catalog = const [];
  List<Record> _results = const [];
  List<Company> _companies = const [];
  List<Company> _allCompanies = const [];
  bool _loading = true;
  bool _searching = false;

  /// Qidiruv so'rovi tushgani. `null` — xato yo'q.
  String? _searchError;
  Object? _error;
  int _filter = 0;

  // Getter, `static final` emas: tarjima til almashganda qayta
  // hisoblanishi kerak (`NavBar.tabs` dagi bilan bir xil sabab).
  static List<String> get _filters =>
      [tr('Hammasi'), tr('Odamlar'), tr('Biznes'), 'ID'];

  @override
  void initState() {
    super.initState();
    _loadCatalog();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  /// `force` — "tortib yangilash". Keshni chetlab o'tadi.
  Future<void> _loadCatalog({bool force = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = AppScope.read(context).repo;
      // Ikkalasi BIR VAQTDA — ketma-ket so'rasak ekran ikki barobar
      // uzoq bo'sh turardi.
      final results = await Future.wait([
        repo.catalog(force: force),
        // Kompaniyalar ixtiyoriy: ular kelmasa ham katalog ko'rinadi.
        repo.companies().catchError((_) => <Company>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _catalog = results[0] as List<Record>;
        _allCompanies = results[1] as List<Company>;
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

  /// Qidiruv 320ms kechikish bilan — har harfda so'rov yuborilsa,
  /// "metall" so'zi olti marta so'rov qilardi.
  void _onQueryChanged(String v) {
    _debounce?.cancel();
    if (v.trim().length < 2) {
      setState(() {
        _results = const [];
        _companies = const [];
        _searching = false;
        _searchError = null;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 320), () => _search(v.trim()));
  }

  Future<void> _search(String q) async {
    setState(() {
      _searching = true;
      _searchError = null;
    });
    final repo = AppScope.read(context).repo;
    try {
      final res = await Future.wait([
        repo.searchRecords(q),
        repo.searchCompanies(q).catchError((_) => <Company>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _results = res[0] as List<Record>;
        _companies = res[1] as List<Company>;
        _searching = false;
        _searchError = null;
      });
    } catch (e) {
      // Ilgari xato JIMGINA yutilardi va ekranda "hech narsa
      // topilmadi" chiqardi — ya'ni tarmoq uzilishi "bunday odam
      // yo'q" bo'lib ko'rinardi. Endi sabab aytiladi.
      if (mounted) {
        setState(() {
          _searching = false;
          _searchError = humanError(e);
        });
      }
    }
  }

  /// Sotuvdagi bo'sh ID — egasi yo'q, narxi bor va sovg'a emas.
  ///
  /// Katalog javobida "bo'sh" degan alohida bayroq yo'q, shuning uchun
  /// belgi shu uch shartdan yig'iladi — saytdagi qoida bilan bir xil.
  bool _isFreeId(Record r) => r.name.trim().isEmpty && r.price > 0 && !r.notForSale;

  @override
  Widget build(BuildContext context) {
    final hasQuery = _query.text.trim().length >= 2;
    // DISCOVER — QIDIRUVGA QARATILGAN EKRAN.
    //
    // Ilgari bu yerda ham Home va NFC'dagi kabi katta serif
    // sarlavha turardi — uchala ekranning tepasi bir xil edi.
    // Endi bu bo'limning BOSH ELEMENTI qidiruv maydoni: sarlavha
    // kichik yozuvga tushirildi, qidiruv esa kattalashdi va eng
    // tepaga chiqdi. Nur ham boshqacha: tepadan, sovuq va eng zaif —
    // e'tibor natijalardagi rasmlarga qolsin.
    return ScreenAura(
      color: C.platinum,
      origin: const Alignment(0, -1),
      strength: .05,
      radius: 1.3,
      child: SafeArea(
      bottom: false,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(S.gutter, S.x16, S.gutter, S.x12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Eyebrow(tr('Kashf qilish')),
                      const SizedBox(height: 3),
                      Text(tr('Odamlar, bizneslar, mahsulotlar'),
                          style: T.caption.copyWith(fontSize: 11.5)),
                    ],
                  ),
                ),
                const SizedBox(width: S.x12),
                const IdChip(),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x16),
            child: _SearchBar(controller: _query, onChanged: _onQueryChanged),
          ),
          if (hasQuery)
            Padding(
              padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x12),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (var i = 0; i < _filters.length; i++) ...[
                      if (i > 0) const SizedBox(width: 6),
                      Chip(_filters[i], active: i == _filter, onTap: () => setState(() => _filter = i)),
                    ],
                  ],
                ),
              ),
            ),
          Expanded(
            child: hasQuery ? _buildResults() : _buildBrowse(),
          ),
        ],
      ),
      ),
    );
  }

  Widget _buildResults() {
    if (_searching) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: S.gutter),
        child: Column(children: [SkeletonRow(), SkeletonRow(), SkeletonRow(), SkeletonRow()]),
      );
    }
    final err = _searchError;
    if (err != null) {
      return ErrorState(err, onRetry: () => _search(_query.text.trim()));
    }
    final people = _results.where((r) => !r.isBusiness && !_isFreeId(r)).toList();
    final ids = _results.where(_isFreeId).toList();
    final rows = <Widget>[];

    if (_filter == 0 || _filter == 1) {
      rows.addAll(people.map((r) => _RecordRow(record: r)));
    }
    if (_filter == 0 || _filter == 2) {
      rows.addAll(_companies.map((c) => _CompanyRow(company: c)));
      rows.addAll(_results.where((r) => r.isBusiness).map((r) => _RecordRow(record: r)));
    }
    if (_filter == 0 || _filter == 3) {
      rows.addAll(ids.map((r) => _RecordRow(record: r, freeId: true)));
    }

    if (rows.isEmpty) {
      return EmptyState(
        tr('Boshqa so‘z bilan yoki ID kodi bo‘yicha qidirib ko‘ring.'),
        title: tr('Hech narsa topilmadi'),
        icon: Ico.search,
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
      itemCount: rows.length + 1,
      separatorBuilder: (_, __) => const SizedBox(height: S.x8),
      itemBuilder: (_, i) => i == 0
          ? Padding(
              padding: const EdgeInsets.only(bottom: S.x4),
              child: Eyebrow('${rows.length} natija'),
            )
          : rows[i - 1],
    );
  }

  Widget _buildBrowse() {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: S.gutter),
        child: Column(children: [SkeletonRow(), SkeletonRow(), SkeletonRow(), SkeletonRow()]),
      );
    }
    if (_error != null) return ErrorState(humanError(_error), onRetry: _loadCatalog);

    final profiles = _catalog.where((r) => !_isFreeId(r)).take(8).toList();
    final freeIds = _catalog.where(_isFreeId).toList()
      ..sort((a, b) => a.price.compareTo(b.price));

    return RefreshIndicator(
      onRefresh: () => _loadCatalog(force: true),
      color: C.champagne,
      backgroundColor: C.slate,
      child: ListView(
        padding: const EdgeInsets.only(bottom: S.x32),
        children: [
          // BIZNESLAR — rasmli qator (handoff: "Bizneslar").
          //
          // Muqova rasmi bo'lgan kompaniya birinchi turadi: rasmli
          // blok bo'sh o'rindan ancha jonli ko'rinadi.
          if (_allCompanies.isNotEmpty) ...[
            SectionHeader(tr('Bizneslar')),
            SizedBox(
              height: 140,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                itemCount: _allCompanies.length > 10 ? 10 : _allCompanies.length,
                separatorBuilder: (_, __) => const SizedBox(width: S.x12),
                itemBuilder: (_, i) => _CompanyCard(company: _allCompanies[i]),
              ),
            ),
            const SizedBox(height: S.x24),
          ],
          if (freeIds.isNotEmpty) ...[
            SectionHeader(tr('Bo‘sh NFC ID‘lar')),
            SizedBox(
              height: 92,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                itemCount: freeIds.take(10).length,
                separatorBuilder: (_, __) => const SizedBox(width: S.x8),
                itemBuilder: (_, i) => _FreeIdCard(record: freeIds[i]),
              ),
            ),
            const SizedBox(height: S.x24),
          ],
          SectionHeader(tr('Mashhur profillar')),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: Column(
              children: [
                for (var i = 0; i < profiles.length; i++) ...[
                  if (i > 0) const SizedBox(height: S.x8),
                  _RecordRow(record: profiles[i]),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// QIDIRUV MAYDONI.
///
/// IKKITA NOSOZLIK TUZATILDI (vizual audit topdi):
///   1) `EditableText` da HINT YO'Q edi — maydon bo'm-bo'sh turardi
///      va nima qidirish mumkinligi bilinmasdi;
///   2) `focusNode: FocusNode()` HAR QAYTA CHIZISHDA yangi tugun
///      yasardi — fokus yo'qolardi va eski tugunlar tozalanmasdi.
class _SearchBar extends StatefulWidget {
  const _SearchBar({required this.controller, required this.onChanged});
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  State<_SearchBar> createState() => _SearchBarState();
}

class _SearchBarState extends State<_SearchBar> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
    widget.controller.addListener(_onText);
  }

  void _onText() => setState(() {});

  @override
  void dispose() {
    widget.controller.removeListener(_onText);
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasText = widget.controller.text.isNotEmpty;
    return AnimatedContainer(
      duration: M.fade,
      // 50 -> 56: bu ekranning BOSH elementi, shuning uchun u
      // oddiy maydon emas, "hero" o'lchamida.
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: C.graphite,
        borderRadius: BorderRadius.circular(R.input),
        border: Border.all(
          color: _focus.hasFocus ? C.champagne.withValues(alpha: .4) : C.hairline,
        ),
      ),
      child: Row(
        children: [
          const _SearchGlyph(),
          const SizedBox(width: S.x8),
          Expanded(
            child: Material(
              type: MaterialType.transparency,
              child: TextField(
                controller: widget.controller,
                focusNode: _focus,
                onChanged: widget.onChanged,
                textInputAction: TextInputAction.search,
                cursorColor: C.champagne,
                cursorWidth: 1.6,
                style: T.cardTitle.copyWith(fontWeight: FontWeight.w500, fontSize: 14.5),
                decoration: InputDecoration(
                  isDense: true,
                  border: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                  hintText: tr('ID, ism, biznes yoki mahsulot'),
                  hintStyle: T.cardTitle.copyWith(
                    fontWeight: FontWeight.w400, fontSize: 14.5, color: C.muted,
                  ),
                ),
              ),
            ),
          ),
          if (hasText)
            Press(
              onTap: () {
                widget.controller.clear();
                widget.onChanged('');
              },
              child: const Padding(
                padding: EdgeInsets.only(left: S.x8),
                child: NIcon(Ico.close, size: 17, color: C.muted),
              ),
            ),
        ],
      ),
    );
  }
}

class _SearchGlyph extends StatelessWidget {
  const _SearchGlyph();

  @override
  Widget build(BuildContext context) =>
      const SizedBox(width: 18, height: 18, child: _Magnifier());
}

class _Magnifier extends StatelessWidget {
  const _Magnifier();

  @override
  Widget build(BuildContext context) => CustomPaint(painter: _MagPainter());
}

class _MagPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = C.muted
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(Offset(size.width * .42, size.height * .42), size.width * .32, p);
    canvas.drawLine(
      Offset(size.width * .66, size.height * .66),
      Offset(size.width * .95, size.height * .95),
      p,
    );
  }

  @override
  bool shouldRepaint(_MagPainter old) => false;
}

class _RecordRow extends StatelessWidget {
  const _RecordRow({required this.record, this.freeId = false});
  final Record record;
  final bool freeId;

  @override
  Widget build(BuildContext context) => Press(
        onTap: () => push(context, (_) => ProfileScreen(code: record.code)),
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          shadow: E.e1,
          child: Row(
            children: [
              if (freeId)
                Container(
                  width: 44, height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: C.metalSurface,
                    borderRadius: BorderRadius.circular(R.tile),
                    border: Border.all(color: C.metalBorder),
                  ),
                  child: Text('ID', style: T.eyebrow),
                )
              else
                Avatar(url: record.avatarUrl, name: record.name, size: 44),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            freeId ? record.code : (record.name.isEmpty ? record.code : record.name),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: T.cardTitle,
                          ),
                        ),
                        if (record.verified) ...[
                          const SizedBox(width: 5),
                          const VerifiedBadge(size: 13),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      freeId
                          ? 'Bo‘sh ID · ${TierStyle.of(record.tier).label}'
                          : [
                              record.isBusiness ? tr('Biznes') : (record.isExpert ? tr('Ekspert') : tr('Shaxsiy')),
                              if (record.city.isNotEmpty) record.city,
                            ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: S.x8),
              if (freeId)
                Text(som(record.price), style: T.price.copyWith(fontSize: 11.5))
              else
                Text(record.code, style: T.code.copyWith(fontSize: 10.5, color: C.muted)),
            ],
          ),
        ),
      );
}

class _CompanyRow extends StatelessWidget {
  const _CompanyRow({required this.company});
  final Company company;

  @override
  Widget build(BuildContext context) => Press(
        onTap: () => push(context, (_) => ProfileScreen(companyId: company.id)),
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          shadow: E.e1,
          child: Row(
            children: [
              Avatar(url: company.logoUrl, name: company.name, size: 44),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(company.name,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: T.cardTitle),
                    const SizedBox(height: 2),
                    Text(
                      [
                        tr('Biznes'),
                        if (company.city.isNotEmpty) company.city,
                      ].join(' · '),
                      style: T.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              if (company.isOpen != null)
                StatusChip(
                  company.isOpen! ? tr('Ochiq') : tr('Yopiq'),
                  tone: company.isOpen! ? StatusTone.ok : StatusTone.neutral,
                ),
            ],
          ),
        ),
      );
}

class _FreeIdCard extends StatelessWidget {
  const _FreeIdCard({required this.record});
  final Record record;

  @override
  Widget build(BuildContext context) => Press(
        onTap: () => push(context, (_) => ProfileScreen(code: record.code)),
        child: Container(
          width: 128,
          padding: const EdgeInsets.all(S.x12),
          decoration: BoxDecoration(
            gradient: C.metalSurface,
            borderRadius: BorderRadius.circular(R.card),
            border: Border.all(color: C.metalBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(record.code, style: T.nfcId(20)),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Eyebrow(TierStyle.of(record.tier).label),
                  const SizedBox(height: 2),
                  Text('${som(record.price)} so‘m', style: T.price.copyWith(fontSize: 11)),
                ],
              ),
            ],
          ),
        ),
      );
}

/// Biznes kartochkasi — muqova, logotip, nom, kategoriya.
///
/// `RepaintBoundary`: gorizontal ro'yxat aylanganda har kartochka
/// alohida qatlamda qayta chiziladi va qo'shnilarini qayta
/// chizishga majburlamaydi.
class _CompanyCard extends StatelessWidget {
  const _CompanyCard({required this.company});
  final Company company;

  @override
  Widget build(BuildContext context) => RepaintBoundary(
        child: Press(
          onTap: () => push(context, (_) => ProfileScreen(companyId: company.id)),
          child: SizedBox(
            width: 168,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Stack(
                  children: [
                    SizedBox(
                      height: 92,
                      width: double.infinity,
                      child: NetImage(
                        company.coverUrl,
                        slotLabel: 'COVER',
                        cacheWidth: 200,
                      ),
                    ),
                    Positioned(
                      left: S.x8,
                      bottom: S.x8,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          color: C.obsidian,
                          shape: BoxShape.circle,
                        ),
                        child: Avatar(url: company.logoUrl, name: company.name, size: 30),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: S.x8),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        company.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.cardTitle.copyWith(fontSize: 13),
                      ),
                    ),
                    if (company.verified) ...[
                      const SizedBox(width: 4),
                      const VerifiedBadge(size: 12),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    if (company.city.isNotEmpty) company.city,
                    if (company.itemCount > 0) '${company.itemCount} mahsulot',
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.caption.copyWith(fontSize: 11),
                ),
              ],
            ),
          ),
        ),
      );
}
