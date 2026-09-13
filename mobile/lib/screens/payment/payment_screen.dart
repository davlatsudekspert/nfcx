import 'dart:async';
import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/buttons.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../common/top_bar.dart';

/// TO'LOV.
///
/// ENG MUHIM QOIDA: mijoz ilovasi to'lov muvaffaqiyatli bo'lganini
/// O'ZI BELGILAMAYDI. Oqim:
///   1) ilova band qilish so'rovini yuboradi — server `pending`
///      buyurtma va `payLink` qaytaradi;
///   2) ilova Payme/Click ni TASHQI ilovada ochadi;
///   3) provayder to'lovni tasdiqlaydi va backend'ga webhook yuboradi;
///   4) ilova buyurtma holatini SERVERDAN so'rab turadi.
///
/// Ya'ni ekrandagi "To'lov qabul qilindi" faqat server `paid` degandan
/// keyin chiqadi. Mavjud Payme/Click oqimiga umuman tegilmagan.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, required this.record});
  final Record record;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

enum _Phase { choose, waiting, paid, failed }

class _PaymentScreenState extends State<PaymentScreen> {
  _Phase _phase = _Phase.choose;
  Order? _order;
  String? _error;
  bool _busy = false;
  Timer? _poll;
  int _method = 0; // 0 — Payme, 1 — Click
  Map<String, dynamic> _enabled = const {};

  @override
  void initState() {
    super.initState();
    _loadMethods();
  }

  Future<void> _loadMethods() async {
    try {
      final e = await AppScope.read(context).repo.paymentsEnabled();
      if (mounted) setState(() => _enabled = e);
    } catch (_) {}
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final repo = AppScope.read(context).repo;
    try {
      final order = await repo.reserveRecord(widget.record.code);
      if (!mounted) return;
      setState(() {
        _order = order;
        _phase = _Phase.waiting;
      });
      final link = order.payLink;
      if (link != null && link.isNotEmpty) {
        await openExternal(Uri.parse(link));
      }
      _startPolling();
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = _payError(e));
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Holatni SERVERDAN so'rab turish. 3 soniyada bir marta, 5 daqiqa
  /// davomida: Payme tasdig'i odatda bir necha soniyada keladi, lekin
  /// bank sekin bo'lishi mumkin.
  void _startPolling() {
    _poll?.cancel();
    var ticks = 0;
    _poll = Timer.periodic(const Duration(seconds: 3), (t) async {
      ticks++;
      if (ticks > 100 || !mounted) return t.cancel();
      final id = _order?.id;
      if (id == null || id == 0) return t.cancel();
      try {
        final fresh = await AppScope.read(context).repo.order(id);
        if (!mounted) return;
        if (fresh.isPaid) {
          t.cancel();
          setState(() {
            _order = fresh;
            _phase = _Phase.paid;
          });
          // Yangi ID egalik ro'yxatiga qo'shildi — shaxslarni yangilaymiz.
          AppScope.read(context).refreshIdentities().catchError((_) {});
        } else if (fresh.status == 'cancelled' || fresh.status == 'failed') {
          t.cancel();
          setState(() {
            _order = fresh;
            _phase = _Phase.failed;
          });
        }
      } catch (_) {
        // Tarmoq uzilishi so'rovni to'xtatmaydi — keyingi urinishda
        // qayta so'raladi.
      }
    });
  }

  String _payError(ApiError e) => switch (e.key) {
        'payments_disabled' => 'To‘lov tizimi hozir o‘chirilgan.',
        'already_taken' => 'Bu ID allaqachon band qilingan.',
        'reserved_pending_payment' =>
          'Bu ID uchun tugallanmagan to‘lov bor. Buyurtmalar bo‘limidan davom ettiring.',
        'not_purchasable' => 'Bu ID sotuvda emas.',
        _ => humanError(e),
      };

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: C.obsidian,
        body: SafeArea(
          bottom: false,
          child: switch (_phase) {
            _Phase.choose => _buildChoose(),
            _Phase.waiting => _buildWaiting(),
            _Phase.paid => _buildPaid(),
            _Phase.failed => _buildFailed(),
          },
        ),
      );

  Widget _buildChoose() {
    final paymeOn = _enabled['payme'] != false;
    final clickOn = _enabled['click'] == true;
    final price = widget.record.price;

    return Column(
      children: [
        const TopBar(title: 'To‘lov'),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x24),
            children: [
              const Eyebrow('To‘lov'),
              const SizedBox(height: 6),
              const Text('Buyurtmani\ntasdiqlash', style: T.display),
              const SizedBox(height: S.x24),
              Surface(
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(widget.record.code, style: T.code.copyWith(fontSize: 15)),
                              const SizedBox(height: 3),
                              Text('${TierStyle.of(widget.record.tier).label} · NFC ID',
                                  style: T.caption),
                            ],
                          ),
                        ),
                        Text(som(price), style: T.price.copyWith(fontSize: 14)),
                      ],
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: S.x12),
                      child: Divider(),
                    ),
                    Row(
                      children: [
                        const Text('Jami', style: T.cardTitle),
                        const Spacer(),
                        Text('${som(price)} so‘m', style: T.price.copyWith(fontSize: 16)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: S.x24),
              const Eyebrow('To‘lov usuli'),
              const SizedBox(height: S.x12),
              _MethodTile(
                name: 'Payme',
                note: 'Payme ilovasi orqali',
                color: C.payme,
                selected: _method == 0,
                enabled: paymeOn,
                onTap: () => setState(() => _method = 0),
              ),
              const SizedBox(height: S.x8),
              _MethodTile(
                name: 'Click',
                note: clickOn ? 'Click ilovasi orqali' : 'Hozir mavjud emas',
                color: C.click,
                selected: _method == 1,
                enabled: clickOn,
                onTap: clickOn ? () => setState(() => _method = 1) : null,
              ),
              if (_error != null) ...[
                const SizedBox(height: S.x16),
                Text(_error!, style: T.caption.copyWith(color: C.signal)),
              ],
            ],
          ),
        ),
        Container(
          padding: EdgeInsets.fromLTRB(
            S.gutter, S.x12, S.gutter,
            MediaQuery.paddingOf(context).bottom + S.x12,
          ),
          decoration: const BoxDecoration(
            color: C.obsidian,
            border: Border(top: BorderSide(color: C.hairline)),
          ),
          child: Column(
            children: [
              PrimaryButton(
                '${som(price)} so‘m to‘lash',
                loading: _busy,
                onTap: _busy ? null : _start,
              ),
              const SizedBox(height: 7),
              Text(
                'To‘lov ${_method == 0 ? 'Payme' : 'Click'} tomonidan himoyalangan',
                style: T.caption.copyWith(fontSize: 11, color: C.muted),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildWaiting() => Padding(
        padding: const EdgeInsets.all(S.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Spacer(),
            const Text('To‘lov\nkutilmoqda', style: T.display),
            const SizedBox(height: S.x12),
            Text(
              'To‘lovni ${_method == 0 ? 'Payme' : 'Click'} ilovasida yakunlang. '
              'Tasdiq kelishi bilan shu ekran o‘zi yangilanadi.',
              style: T.body,
            ),
            const SizedBox(height: S.x24),
            const Row(
              children: [
                Spinner(size: 16),
                SizedBox(width: S.x12),
                Text('Bankdan javob olinmoqda…', style: T.caption),
              ],
            ),
            const Spacer(),
            if ((_order?.payLink ?? '').isNotEmpty)
              SecondaryButton(
                'To‘lov sahifasini qayta ochish',
                onTap: () => openExternal(Uri.parse(_order!.payLink!)),
              ),
            const SizedBox(height: S.x8),
            GhostButton('Keyinroq', onTap: () => Navigator.of(context).maybePop()),
            const SizedBox(height: S.x24),
          ],
        ),
      );

  Widget _buildPaid() => Padding(
        padding: const EdgeInsets.all(S.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Spacer(),
            const Text('To‘lov\nqabul qilindi', style: T.display),
            const SizedBox(height: S.x12),
            Text(
              '${widget.record.code} sizga biriktirildi. Endi profilingizni '
              'to‘ldirib, kartani ulashishingiz mumkin.',
              style: T.body,
            ),
            const SizedBox(height: S.x24),
            Surface(
              child: Column(
                children: [
                  _Line('To‘langan', '${som(_order?.price ?? widget.record.price)} so‘m'),
                  const SizedBox(height: S.x8),
                  _Line('Usul', _method == 0 ? 'Payme' : 'Click'),
                  const SizedBox(height: S.x8),
                  _Line('Buyurtma', '#${_order?.id ?? '—'}'),
                ],
              ),
            ),
            const Spacer(),
            PrimaryButton('Profilni sozlash', onTap: () => Navigator.of(context).maybePop()),
            const SizedBox(height: S.x24),
          ],
        ),
      );

  Widget _buildFailed() => Padding(
        padding: const EdgeInsets.all(S.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Spacer(),
            const Text('To‘lov\namalga oshmadi', style: T.display),
            const SizedBox(height: S.x12),
            const Text(
              'To‘lov yakunlanmadi. Qayta urinib ko‘ring yoki boshqa usul tanlang.',
              style: T.body,
            ),
            const Spacer(),
            PrimaryButton('Qayta urinish', onTap: () => setState(() => _phase = _Phase.choose)),
            const SizedBox(height: S.x8),
            GhostButton('Yopish', onTap: () => Navigator.of(context).maybePop()),
            const SizedBox(height: S.x24),
          ],
        ),
      );
}

class _Line extends StatelessWidget {
  const _Line(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Text(label, style: T.caption),
          const Spacer(),
          Text(value, style: T.meta.copyWith(color: C.offWhite)),
        ],
      );
}

class _MethodTile extends StatelessWidget {
  const _MethodTile({
    required this.name,
    required this.note,
    required this.color,
    required this.selected,
    required this.enabled,
    this.onTap,
  });

  final String name;
  final String note;
  final Color color;
  final bool selected;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        child: Opacity(
          opacity: enabled ? 1 : .45,
          child: Surface(
            border: selected ? C.champagne.withValues(alpha: .4) : null,
            child: Row(
              children: [
                Container(
                  width: 38, height: 38,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: .14),
                    borderRadius: BorderRadius.circular(R.tile),
                  ),
                  child: Text(
                    name[0],
                    style: T.cardTitle.copyWith(color: color, fontSize: 17),
                  ),
                ),
                const SizedBox(width: S.x12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: T.cardTitle),
                      const SizedBox(height: 2),
                      Text(note, style: T.caption.copyWith(fontSize: 11)),
                    ],
                  ),
                ),
                Container(
                  width: 19, height: 19,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: selected ? C.champagne : C.hairline, width: 1.6),
                    color: selected ? C.champagne : null,
                  ),
                  child: selected
                      ? const Center(
                          child: NIcon(Ico.check, size: 12, color: C.ink))
                      : null,
                ),
              ],
            ),
          ),
        ),
      );
}

/// Ingichka ajratgich — Material Divider'ining o'z rangini olmaydi.
class Divider extends StatelessWidget {
  const Divider({super.key});

  @override
  Widget build(BuildContext context) => Container(height: 1, color: C.hairline);
}
