import 'package:flutter/widgets.dart';

import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';

/// BUYURTMALAR — EGA UCHUN.
///
/// Holatlar backenddagi qiymatlar bilan bir xil: `new`, `done`,
/// `cancelled`. Boshqa nom o'ylab topilmaydi — aks holda ilova va
/// admin paneli har xil gapirardi.
class OwnerOrdersScreen extends StatefulWidget {
  const OwnerOrdersScreen({
    super.key,
    required this.companyId,
    this.companyName = '',
  });

  final String companyId;
  final String companyName;

  @override
  State<OwnerOrdersScreen> createState() => _OwnerOrdersScreenState();
}

class _OwnerOrdersScreenState extends State<OwnerOrdersScreen> {
  List<Map<String, dynamic>>? _orders;
  Object? _error;
  bool _loading = true;
  String _filter = 'new';
  final _busy = <int>{};

  // Getter: tarjima til almashganda qayta hisoblansin.
  static List<({String key, String label})> get _tabs => [
        (key: 'new', label: tr('Yangi')),
        (key: 'done', label: tr('Bajarilgan')),
        (key: 'cancelled', label: tr('Bekor')),
      ];

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
      final list =
          await AppScope.read(context).repo.companyOrders(widget.companyId);
      if (!mounted) return;
      setState(() {
        _orders = list;
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

  Future<void> _setStatus(int id, String status) async {
    setState(() => _busy.add(id));
    try {
      await AppScope.read(context)
          .repo
          .setCompanyOrderStatus(widget.companyId, id, status);
      // Ro'yxatni SERVERDAN qayta o'qiymiz: holatni faqat mahalliy
      // o'zgartirsak, boshqa qurilmadagi o'zgarish ko'rinmay qolardi.
      await _load();
    } catch (e) {
      // JIM YIQILMAYDI. Ilgari bu yerda `_error = null` turardi:
      // so'rov tushsa ekranda MUTLAQO hech narsa o'zgarmasdi va
      // ega buyurtma holati almashdi deb o'ylab ketaverardi.
      if (mounted) await showError(context, humanError(e));
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  /// BEKOR QILISH — oqibati bilan so'raladi.
  ///
  /// Mijoz allaqachon kutayotgan bo'lishi mumkin, qaytarish esa
  /// serverda yo'q: bu bir tomonlama amal.
  Future<void> _cancel(int id) async {
    final sure = await confirmSheet(
      context,
      title: tr('Bekor qilish'),
      message: tr('Buyurtma bekor qilinadi va mijoz uni tayyor deb kutib '
          'qolmaydi. Holatni ilovadan qaytarib bo‘lmaydi.'),
      confirmLabel: tr('Ha, bekor qilinsin'),
    );
    if (!sure || !mounted) return;
    await _setStatus(id, 'cancelled');
  }

  @override
  Widget build(BuildContext context) {
    final all = _orders ?? const [];
    final counts = <String, int>{
      for (final t in _tabs)
        t.key: all.where((o) => '${o['status']}' == t.key).length,
    };
    final shown = all.where((o) => '${o['status']}' == _filter).toList();

    return ScreenBackdrop(
      aura: Aura.none,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(),
            ScreenTitle(
              tr('Buyurtmalar'),
              eyebrow: widget.companyName.isEmpty
                  ? widget.companyId
                  : widget.companyName,
              subtitle: tr('Yangi buyurtmani bajarilgan deb belgilang yoki '
                  'bekor qiling.'),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x16),
              child: Row(
                children: [
                  for (var i = 0; i < _tabs.length; i++) ...[
                    if (i > 0) const SizedBox(width: S.x8),
                    FilterChip(
                      counts[_tabs[i].key] == 0
                          ? _tabs[i].label
                          : '${_tabs[i].label} · ${counts[_tabs[i].key]}',
                      active: _filter == _tabs[i].key,
                      onTap: () => setState(() => _filter = _tabs[i].key),
                    ),
                  ],
                ],
              ),
            ),
            Expanded(
              child: AsyncView<List<Map<String, dynamic>>>(
                loading: _loading,
                error: _error,
                data: _orders == null ? null : shown,
                onRetry: _load,
                isEmpty: (d) => d.isEmpty,
                emptyIcon: Ico.bag,
                emptyMessage: _filter == 'new'
                    ? tr('Yangi buyurtma yo‘q.')
                    : tr('Bu ro‘yxat bo‘sh.'),
                // SKELET — RO'YXAT, ustun emas.
                //
                // Ustun bo'lsa, past ekranda (yoki kartalar keng
                // bo'lganda) u joyga sig'masdan "RenderFlex
                // overflowed" berardi. Ro'yxat esa ortiqchasini
                // shunchaki kesadi — tayyor kontent ham aynan
                // shunday ko'rinadi, ya'ni skelet almashganda
                // maket sakramaydi.
                skeleton: ListView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: S.gutter,
                  ),
                  children: const [
                    SkeletonCard(aspect: 2.6),
                    SizedBox(height: S.x8),
                    SkeletonCard(aspect: 2.6),
                    SizedBox(height: S.x8),
                    SkeletonCard(aspect: 2.6),
                  ],
                ),
                builder: (data) => ListView.separated(
                  padding: EdgeInsets.fromLTRB(
                    S.gutter,
                    0,
                    S.gutter,
                    MediaQuery.paddingOf(context).bottom + S.x32,
                  ),
                  itemCount: data.length,
                  separatorBuilder: (_, __) => const SizedBox(height: S.x8),
                  itemBuilder: (_, i) => _OrderCard(
                    order: data[i],
                    busy: _busy.contains((data[i]['id'] as num?)?.round() ?? -1),
                    onDone: _setStatus,
                    onCancel: _cancel,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({
    required this.order,
    required this.busy,
    required this.onDone,
    required this.onCancel,
  });

  final Map<String, dynamic> order;
  final bool busy;
  final void Function(int id, String status) onDone;
  final void Function(int id) onCancel;

  @override
  Widget build(BuildContext context) {
    final id = (order['id'] as num?)?.round() ?? 0;
    final status = '${order['status']}';
    final phone = '${order['phone'] ?? ''}';
    final name = '${order['name'] ?? ''}';
    final note = '${order['note'] ?? ''}';
    final qty = (order['qty'] as num?)?.round() ?? 1;
    final price = (order['price'] as num?)?.round() ?? 0;

    return Surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  name.isEmpty ? tr('Mijoz') : name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.cardTitle,
                ),
              ),
              const SizedBox(width: S.x12),
              StatusChip(
                switch (status) {
                  'new' => tr('Yangi'),
                  'done' => tr('Bajarildi'),
                  'cancelled' => tr('Bekor'),
                  _ => status,
                },
                tone: switch (status) {
                  'new' => StatusTone.pending,
                  'done' => StatusTone.ok,
                  'cancelled' => StatusTone.fail,
                  _ => StatusTone.neutral,
                },
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text('#$id', style: T.meta),
          if (phone.isNotEmpty) ...[
            const SizedBox(height: 4),
            // RAQAM BOSILADI: eng ko'p qilinadigan ish — mijozga
            // qo'ng'iroq qilish. Bosish maydoni 48 dp (`Press`).
            Press(
              onTap: () => openExternal(
                Uri.parse('tel:${phone.replaceAll(RegExp(r'[^0-9+]'), '')}'),
              ),
              scale: .98,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  NIcon(Ico.phone, size: 13, color: C.accent),
                  const SizedBox(width: 6),
                  Text(phone, style: T.meta.copyWith(color: C.accent)),
                ],
              ),
            ),
          ],
          const SizedBox(height: S.x12),
          Text(
            '${order['itemName'] ?? 'Mahsulot'} · $qty dona',
            style: T.bodyStrong,
          ),
          if (note.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(note, style: T.caption),
          ],
          const SizedBox(height: S.x8),
          Text('${som(price)} so‘m', style: T.amount),
          if (status == 'new') ...[
            const SizedBox(height: S.x16),
            Row(
              children: [
                Expanded(
                  child: SecondaryButton(
                    tr('Bajarildi'),
                    size: BtnSize.m,
                    icon: Ico.check,
                    loading: busy,
                    onTap: busy ? null : () => onDone(id, 'done'),
                  ),
                ),
                const SizedBox(width: S.x8),
                GhostButton(
                  tr('Bekor'),
                  size: BtnSize.m,
                  color: C.fail,
                  onTap: busy ? null : () => onCancel(id),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
