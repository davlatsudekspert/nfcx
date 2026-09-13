import 'dart:async';
import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import '../identity/id_chip.dart';
import '../identity/profile_screen.dart';

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
  bool _loading = true;
  bool _searching = false;
  Object? _error;
  int _filter = 0;

  static const _filters = ['Hammasi', 'Odamlar', 'Biznes', 'ID'];

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

  Future<void> _loadCatalog() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await AppScope.read(context).repo.catalog();
      if (!mounted) return;
      setState(() {
        _catalog = list;
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
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 320), () => _search(v.trim()));
  }

  Future<void> _search(String q) async {
    setState(() => _searching = true);
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
      });
    } catch (_) {
      if (mounted) setState(() => _searching = false);
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
    return SafeArea(
      bottom: false,
      child: Column(
        children: [
          ScreenTitle(
            'Discover',
            subtitle: 'Odamlar, bizneslar, mahsulotlar',
            trailing: const IdChip(),
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
    );
  }

  Widget _buildResults() {
    if (_searching) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: S.gutter),
        child: Column(children: [SkeletonRow(), SkeletonRow(), SkeletonRow(), SkeletonRow()]),
      );
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
      return const EmptyState('Hech narsa topilmadi. Boshqa so‘z bilan qidirib ko‘ring.');
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
      onRefresh: _loadCatalog,
      color: C.champagne,
      backgroundColor: C.slate,
      child: ListView(
        padding: const EdgeInsets.only(bottom: S.x32),
        children: [
          if (freeIds.isNotEmpty) ...[
            const SectionHeader('Bo‘sh NFC ID‘lar'),
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
          const SectionHeader('Mashhur profillar'),
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

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.controller, required this.onChanged});
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Container(
        height: 50,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: C.graphite,
          borderRadius: BorderRadius.circular(R.input),
          border: Border.all(color: C.hairline),
        ),
        child: Row(
          children: [
            const _SearchGlyph(),
            const SizedBox(width: S.x8),
            Expanded(
              child: EditableText(
                controller: controller,
                focusNode: FocusNode(),
                style: T.cardTitle.copyWith(fontWeight: FontWeight.w500, fontSize: 14.5),
                cursorColor: C.champagne,
                backgroundCursorColor: C.muted,
                onChanged: onChanged,
              ),
            ),
          ],
        ),
      );
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
                  child: const Text('ID', style: T.eyebrow),
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
                              record.isBusiness ? 'Biznes' : (record.isExpert ? 'Ekspert' : 'Shaxsiy'),
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
                        'Biznes',
                        if (company.city.isNotEmpty) company.city,
                      ].join(' · '),
                      style: T.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              if (company.isOpen != null)
                StatusChip(
                  company.isOpen! ? 'Ochiq' : 'Yopiq',
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
