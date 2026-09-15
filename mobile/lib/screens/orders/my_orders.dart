import 'dart:async';

import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';

/// MENING BUYURTMALARIM — va TO'LOVNI DAVOM ETTIRISH.
///
/// NIMA UCHUN BU EKRAN KERAK: to'lovni yarmida tashlab ketgan odam
/// qulflanib qolardi. Kod uning nomiga 24 soat band bo'ladi, ya'ni u
/// qaytadan urinsa "reserved_pending_payment" xatosini oladi.
/// Backend aynan shu holat uchun `payLink` ni qaytaradi — bu ekran
/// uni ko'rsatadi.
///
/// KO'RINISH (13c): har buyurtma bitta `Surface`. Birinchi qator —
/// nima sotib olingani va o'ngda holat chipi; ikkinchi qator — mono
/// meta (kod · sana); uchinchi — summa va yagona amal.
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
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.none,
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              const TopBar(),
              // Sarlavha ro'yxatdan TASHQARIDA: bo'sh holatda ham,
              // xatoda ham odam qaysi ekranda turganini ko'rib tursin.
              ScreenTitle(
                tr('Buyurtmalarim'),
                subtitle: tr('To‘lov holati va tugallanmagan buyurtmalar.'),
              ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _load,
                  color: C.accent,
                  backgroundColor: C.surface,
                  child: AsyncView<List<Order>>(
                    loading: _loading,
                    error: _error,
                    data: _orders,
                    onRetry: _load,
                    isEmpty: (d) => d.isEmpty,
                    emptyMessage: tr('Hali buyurtmangiz yo‘q.'),
                    emptyIcon: Ico.bag,
                    skeleton: ListView(
                      padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                      children: const [
                        SkeletonCard(aspect: 3.2),
                        SizedBox(height: S.x8),
                        SkeletonCard(aspect: 3.2),
                        SizedBox(height: S.x8),
                        SkeletonCard(aspect: 3.2),
                      ],
                    ),
                    builder: (data) => ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: EdgeInsets.fromLTRB(
                        S.gutter,
                        0,
                        S.gutter,
                        MediaQuery.paddingOf(context).bottom + S.x32,
                      ),
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
        'cancelled' => (label: tr('Bekor qilingan'), tone: StatusTone.fail),
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

  /// Muddati o'tgan yoki bekor bo'lgan buyurtma — amal "qayta
  /// urinish" bo'ladi, "davom ettirish" emas.
  ///
  /// Muddat NOMA'LUM bo'lsa (server sana bermadi) buyurtma o'tgan
  /// deb HISOBLANMAYDI: havola hali ham ishlashi mumkin.
  bool get _expired {
    if (order.status == 'cancelled' || order.status == 'failed') return true;
    final ms = order.expiresAtMs;
    if (ms == null) return false;
    return DateTime.fromMillisecondsSinceEpoch(ms).isBefore(DateTime.now());
  }

  @override
  Widget build(BuildContext context) {
    final st = _status;
    final left = _left;
    final link = order.linkFor('payme') ?? order.linkFor('click');
    final created = order.createdAt;

    // MONO META — kod va sana bitta qatorda. Sana bo'lmasa qator
    // faqat koddan iborat: bo'sh ajratgich osilib qolmaydi.
    final meta = [
      order.code,
      if (created != null) shortDate(created),
    ].where((s) => s.isNotEmpty).join(' · ');

    return Surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text(_kind, style: T.cardTitle)),
              const SizedBox(width: S.x12),
              StatusChip(st.label, tone: st.tone),
            ],
          ),
          const SizedBox(height: S.x8),
          Text(meta, style: T.meta),
          if (order.isPending) ...[
            const SizedBox(height: S.x8),
            Row(
              children: [
                NIcon(Ico.clock, size: 13, color: C.warn),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    // 24 soatlik band qilish — serverdan kelgan
                    // `expiresAtMs` dan hisoblanadi, o'ylab
                    // topilmaydi.
                    left != null
                        ? trf('Band qilish tugashi: {vaqt}', {'vaqt': left})
                        : tr('To‘lov yakunlanmagan.'),
                    style: T.meta.copyWith(color: C.warn),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: S.x12),
          Row(
            children: [
              Expanded(
                child: Text('${som(order.price)} so‘m', style: T.amount),
              ),
              if (link != null) ...[
                const SizedBox(width: S.x12),
                // YAGONA AMAL — serverdan kelgan to'lov havolasi.
                // Yorliq amalni ROSTGO'YLIK bilan aytadi: tugma
                // to'lov sahifasini ochadi.
                GhostButton(
                  _expired ? tr('Qayta urinish') : tr('To‘lovni davom ettirish'),
                  size: BtnSize.s,
                  onTap: () => openExternal(Uri.parse(link)),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
