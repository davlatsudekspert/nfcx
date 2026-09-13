import 'dart:async';
import 'package:flutter/material.dart' show Scaffold, RefreshIndicator;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../common/top_bar.dart';
import '../../l10n/strings.dart';

/// MENING BUYURTMALARIM — va TO'LOVNI DAVOM ETTIRISH.
///
/// NIMA UCHUN BU EKRAN KERAK: to'lovni yarmida tashlab ketgan odam
/// qulflanib qolardi. Kod uning nomiga 24 soat band bo'ladi, ya'ni u
/// qaytadan urinsa "reserved_pending_payment" xatosini oladi.
/// Backend aynan shu holat uchun `payLink` ni qaytaradi — bu ekran
/// uni ko'rsatadi.
class MyOrdersScreen extends StatefulWidget {
  const MyOrdersScreen({super.key});

  @override
  State<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

class _MyOrdersScreenState extends State<MyOrdersScreen> {
  List<Order>? _orders;
  Object? _error;
  bool _loading = true;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _load();
    // Teskari hisob uchun sekundlik qayta chizish. FAQAT kutilayotgan
    // buyurtma bo'lganda ishlaydi — aks holda ekran behuda yangilanib
    // batareyani yeydi.
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_orders?.any((o) => o.isPending && o.expiresAtMs != null) ?? false) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await AppScope.read(context).repo.orders();
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

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: C.obsidian,
        body: SafeArea(
          bottom: false,
          child: Column(
            children: [
              TopBar(title: tr('Buyurtmalarim')),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  color: C.champagne,
                  backgroundColor: C.slate,
                  child: AsyncView<List<Order>>(
                    loading: _loading,
                    error: _error,
                    data: _orders,
                    onRetry: _load,
                    isEmpty: (d) => d.isEmpty,
                    emptyMessage: tr('Hali buyurtmangiz yo‘q.'),
                    skeleton: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                      children: const [SkeletonRow(), SkeletonRow(), SkeletonRow()],
                    ),
                    builder: (data) => ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                      itemCount: data.length,
                      separatorBuilder: (_, __) => const SizedBox(height: S.x8),
                      itemBuilder: (_, i) => _OrderCard(order: data[i]),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});
  final Order order;

  /// Buyurtma turi — odam tilida.
  String get _kind => switch (order.kind) {
        'physical_card_order' => tr('Jismoniy karta'),
        'premium_upgrade' => tr('Premium obuna'),
        _ => tr('NFC ID'),
      };

  ({String label, StatusTone tone}) get _status => switch (order.status) {
        'paid' => (label: tr('To‘langan'), tone: StatusTone.ok),
        'pending' => (label: tr('Kutilmoqda'), tone: StatusTone.pending),
        'cancelled' => (label: tr('Bekor qilingan'), tone: StatusTone.neutral),
        'failed' => (label: tr('Amalga oshmadi'), tone: StatusTone.fail),
        _ => (label: order.status, tone: StatusTone.neutral),
      };

  /// Qolgan vaqt. `null` — muddat ma'lum emas yoki allaqachon o'tgan.
  String? get _left {
    final ms = order.expiresAtMs;
    if (ms == null || !order.isPending) return null;
    final d = DateTime.fromMillisecondsSinceEpoch(ms).difference(DateTime.now());
    if (d.isNegative) return null;
    final h = d.inHours;
    final m = d.inMinutes % 60;
    final s = d.inSeconds % 60;
    return h > 0
        ? '$h soat $m daqiqa'
        : '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final st = _status;
    final left = _left;
    final link = order.payLink;

    return Surface(
      shadow: E.e1,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('#${order.id}', style: T.code.copyWith(fontSize: 11.5, color: C.ash)),
              const SizedBox(width: S.x8),
              Text(_kind, style: T.caption.copyWith(fontSize: 11)),
              const Spacer(),
              StatusChip(st.label, tone: st.tone),
            ],
          ),
          const SizedBox(height: S.x12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(child: Text(order.code, style: T.nfcId(22))),
              Text('${som(order.price)} so‘m', style: T.price.copyWith(fontSize: 14)),
            ],
          ),
          if (order.isPending) ...[
            const SizedBox(height: S.x12),
            if (left != null)
              Text(
                'Band qilish tugashi: $left',
                style: T.caption.copyWith(fontSize: 11, color: C.champagne),
              )
            else
              Text(
                tr('To‘lov yakunlanmagan.'),
                style: T.caption.copyWith(fontSize: 11, color: C.champagne),
              ),
            if (link != null) ...[
              const SizedBox(height: S.x12),
              SecondaryButton(
                tr('To‘lovni davom ettirish'),
                height: 44,
                onTap: () => openExternal(Uri.parse(link)),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
