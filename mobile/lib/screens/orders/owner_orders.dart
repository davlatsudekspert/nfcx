import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../design/components/buttons.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../common/top_bar.dart';

/// BUYURTMALAR — EGA UCHUN.
///
/// Holatlar backenddagi qiymatlar bilan bir xil: `new`, `done`,
/// `cancelled`. Boshqa nom o'ylab topilmaydi — aks holda ilova va
/// admin paneli har xil gapirardi.
class OwnerOrdersScreen extends StatefulWidget {
  const OwnerOrdersScreen({super.key, required this.companyId, this.companyName = ''});

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

  static const _tabs = [
    (key: 'new', label: 'Yangi'),
    (key: 'done', label: 'Bajarilgan'),
    (key: 'cancelled', label: 'Bekor'),
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
      final list = await AppScope.read(context).repo.companyOrders(widget.companyId);
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
      await AppScope.read(context).repo.setCompanyOrderStatus(widget.companyId, id, status);
      // Ro'yxatni SERVERDAN qayta o'qiymiz: holatni faqat mahalliy
      // o'zgartirsak, boshqa qurilmadagi o'zgarish ko'rinmay qolardi.
      await _load();
    } catch (_) {
      if (mounted) {
        setState(() => _error = null);
      }
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final all = _orders ?? const [];
    final counts = <String, int>{
      for (final t in _tabs) t.key: all.where((o) => '${o['status']}' == t.key).length,
    };
    final shown = all.where((o) => '${o['status']}' == _filter).toList();

    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(
              title: 'Buyurtmalar',
              subtitle: widget.companyName.isEmpty ? widget.companyId : widget.companyName,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x12),
              child: Row(
                children: [
                  for (var i = 0; i < _tabs.length; i++) ...[
                    if (i > 0) const SizedBox(width: 6),
                    Chip(
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
                emptyMessage: _filter == 'new'
                    ? 'Yangi buyurtma yo‘q.'
                    : 'Bu ro‘yxat bo‘sh.',
                skeleton: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: S.gutter),
                  child: Column(children: [SkeletonRow(), SkeletonRow(), SkeletonRow()]),
                ),
                builder: (data) => ListView.separated(
                  padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                  itemCount: data.length,
                  separatorBuilder: (_, __) => const SizedBox(height: S.x8),
                  itemBuilder: (_, i) => _OrderCard(
                    order: data[i],
                    busy: _busy.contains((data[i]['id'] as num?)?.round() ?? -1),
                    onStatus: _setStatus,
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
  const _OrderCard({required this.order, required this.busy, required this.onStatus});

  final Map<String, dynamic> order;
  final bool busy;
  final void Function(int id, String status) onStatus;

  @override
  Widget build(BuildContext context) {
    final id = (order['id'] as num?)?.round() ?? 0;
    final status = '${order['status']}';
    final phone = '${order['phone'] ?? ''}';
    final qty = (order['qty'] as num?)?.round() ?? 1;
    final price = (order['price'] as num?)?.round() ?? 0;

    return Surface(
      shadow: E.e1,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('#$id', style: T.code.copyWith(fontSize: 12, color: C.ash)),
              const Spacer(),
              StatusChip(
                switch (status) {
                  'new' => 'Yangi',
                  'done' => 'Bajarildi',
                  'cancelled' => 'Bekor',
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
          const SizedBox(height: S.x12),
          Text(
            '${order['itemName'] ?? 'Mahsulot'} · $qty dona',
            style: T.cardTitle.copyWith(fontSize: 13.5),
          ),
          const SizedBox(height: 3),
          Text(
            [
              '${order['name'] ?? ''}',
              if (phone.isNotEmpty) phone,
            ].where((s) => s.isNotEmpty).join(' · '),
            style: T.caption,
          ),
          if ('${order['note'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('${order['note']}', style: T.caption.copyWith(color: C.muted)),
          ],
          const SizedBox(height: S.x8),
          Text('${som(price)} so‘m', style: T.price),
          if (status == 'new') ...[
            const SizedBox(height: S.x12),
            Row(
              children: [
                Expanded(
                  child: SecondaryButton(
                    'Bajarildi',
                    height: 42,
                    onTap: busy ? null : () => onStatus(id, 'done'),
                  ),
                ),
                const SizedBox(width: S.x8),
                if (phone.isNotEmpty)
                  Expanded(
                    child: GhostButton(
                      'Qo‘ng‘iroq',
                      onTap: () => openExternal(
                        Uri.parse('tel:${phone.replaceAll(RegExp(r'[^0-9+]'), '')}'),
                      ),
                    ),
                  ),
                const SizedBox(width: S.x8),
                Expanded(
                  child: GhostButton(
                    'Bekor',
                    color: C.signal,
                    onTap: busy ? null : () => onStatus(id, 'cancelled'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
