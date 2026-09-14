import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/input.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import 'id_detail.dart';
import '../../l10n/strings.dart';

/// BO'SH NFC ID KATALOGI.
///
/// Ro'yxat `/api/records` dan keladi va faqat EGASI YO'Q, narxi bor
/// yozuvlar qoldiriladi. Narx SERVERDAN — mijozda hech qanday narx
/// jadvali yozilmagan, aks holda saytda narx o'zgarganda ilova eski
/// summani ko'rsatib turardi.
class IdCatalogScreen extends StatefulWidget {
  const IdCatalogScreen({super.key});

  @override
  State<IdCatalogScreen> createState() => _IdCatalogScreenState();
}

class _IdCatalogScreenState extends State<IdCatalogScreen> {
  List<Record>? _items;
  Object? _error;
  bool _loading = true;
  Tier? _filter;

  /// QIDIRUV — kod bo'yicha.
  ///
  /// NIMA UCHUN KERAK: katalogda yuzlab kod bo'ladi va odam ko'pincha
  /// AYNAN bittasini (o'z ismi harflari, tug'ilgan yili) qidiradi.
  /// Faqat tarif chiplari bilan uni topib bo'lmasdi — pastga
  /// aylantirishdan boshqa yo'l yo'q edi.
  ///
  /// Filtr MIJOZDA: katalog allaqachon to'liq yuklangan va keshda
  /// turadi, ya'ni har harfda serverga so'rov yuborish ortiqcha.
  final _query = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final all = await AppScope.read(context).repo.catalog();
      final free = all
          .where((r) => r.name.trim().isEmpty && r.price > 0 && !r.notForSale)
          .toList()
        ..sort((a, b) => a.price.compareTo(b.price));
      if (!mounted) return;
      setState(() {
        _items = free;
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

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const tiers = [Tier.bronze, Tier.silver, Tier.gold, Tier.premium, Tier.exclusive];
    final q = _query.text.trim().toUpperCase();
    final list = _items
        ?.where((r) => _filter == null || r.tier == _filter)
        .where((r) => q.isEmpty || r.code.contains(q))
        .toList();

    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(title: tr('Yangi NFC ID'), subtitle: tr('Bo‘sh ID‘lardan tanlang')),
            Padding(
              padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x12),
              child: Field(
                label: '',
                controller: _query,
                hint: tr('Kod bo‘yicha qidirish'),
                onChanged: (_) => setState(() {}),
              ),
            ),
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                children: [
                  Chip(tr('Hammasi'), active: _filter == null, onTap: () => setState(() => _filter = null)),
                  for (final t in tiers) ...[
                    const SizedBox(width: 6),
                    Chip(
                      TierStyle.of(t).label,
                      active: _filter == t,
                      onTap: () => setState(() => _filter = t),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: S.x12),
            Expanded(
              child: AsyncView<List<Record>>(
                loading: _loading,
                error: _error,
                data: list,
                onRetry: _load,
                isEmpty: (d) => d.isEmpty,
                emptyMessage: q.isEmpty
                    ? tr('Bu tarifda hozir bo‘sh ID yo‘q.')
                    : '«$q» bo‘yicha bo‘sh ID topilmadi.',
                skeleton: GridView.count(
                  crossAxisCount: 2,
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  crossAxisSpacing: S.x12,
                  mainAxisSpacing: S.x12,
                  childAspectRatio: 1.35,
                  children: const [SkeletonCard(), SkeletonCard(), SkeletonCard(), SkeletonCard()],
                ),
                builder: (data) => GridView.builder(
                  padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: S.x12,
                    mainAxisSpacing: S.x12,
                    childAspectRatio: 1.35,
                  ),
                  itemCount: data.length,
                  itemBuilder: (_, i) => _IdTile(record: data[i]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IdTile extends StatelessWidget {
  const _IdTile({required this.record});
  final Record record;

  @override
  Widget build(BuildContext context) {
    final t = TierStyle.of(record.tier);
    return Press(
      onTap: () => push(context, (_) => IdDetailScreen(record: record)),
      child: Container(
        padding: const EdgeInsets.all(S.x12),
        decoration: BoxDecoration(
          gradient: C.metalSurface,
          borderRadius: BorderRadius.circular(R.card),
          border: Border.all(color: C.metalBorder),
          boxShadow: E.e1,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(record.code, style: T.nfcId(26)),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 12, height: 12,
                      decoration: BoxDecoration(shape: BoxShape.circle, gradient: t.gradient),
                    ),
                    const SizedBox(width: 6),
                    Eyebrow(t.label),
                  ],
                ),
                const SizedBox(height: 4),
                Text('${som(record.price)} so‘m', style: T.price.copyWith(fontSize: 14)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
