import 'dart:async';
import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/buttons.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../common/top_bar.dart';
import '../../design/feedback.dart';
import '../../l10n/strings.dart';

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
  /// Payme yoqilganmi — SERVER aytadi. `null` — hali so'ralmagan.
  bool? _paymeOn;

  /// So'rov 5 daqiqa davomida javob bermadi.
  ///
  /// Ilgari bu holatda taymer jimgina to'xtardi va ekranda
  /// "Bankdan javob olinmoqda…" aylanmasi ABADIY qolib ketardi —
  /// odam uchun bu ilova osilib qolgani bilan bir xil.
  bool _stalled = false;

  @override
  void initState() {
    super.initState();
    _loadMethods();
  }

  Future<void> _loadMethods() async {
    try {
      final e = await AppScope.read(context).repo.paymentsEnabled();
      if (mounted) {
        setState(() => _paymeOn = _providerOn(e, 'payme'));
      }
    } catch (_) {
      // Jimgina: to'lov usullari ro'yxati kelmasa ham tugma
      // ishlaydi va haqiqiy javobni server beradi.
    }
  }

  /// `/api/settings/payments-enabled` javobini O'QISH.
  ///
  /// Javob shakli: `{enabled, sandbox, providers: {payme: {enabled},
  /// click: {enabled}}}`. Ilova ilgari YUQORI QAVATDAN `e['payme']`
  /// va `e['click']` ni izlardi — bunday kalitlar umuman yo'q.
  /// Natijada Payme server tomonda O'CHIRILGAN bo'lsa ham ekranda
  /// ishlaydigan "to'lash" tugmasi turardi va faqat bosgandan keyin
  /// `payments_disabled` xatosi chiqardi.
  ///
  /// `providers` bo'lmasa (eski server) eski `enabled` kalitiga
  /// qaytamiz — aks holda yangilanmagan serverda to'lov butunlay
  /// bloklanib qolardi.
  static bool _providerOn(Map<String, dynamic> e, String name) {
    final p = e['providers'];
    if (p is Map && p[name] is Map) return (p[name] as Map)['enabled'] == true;
    return e['enabled'] != false;
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
      if (!mounted) return t.cancel();
      if (ticks > 100) {
        t.cancel();
        // Aylanmani TO'XTATAMIZ va nima bo'lganini AYTAMIZ. To'lov
        // baribir o'tgan bo'lishi mumkin (webhook kechikkan) —
        // shuning uchun "amalga oshmadi" demaymiz, qo'lda
        // tekshirish tugmasini beramiz.
        setState(() => _stalled = true);
        return;
      }
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
          // To'lov o'tdi — telefonda ham sezilsin: odam bu paytda
          // ko'pincha ekranga qaramaydi (bank ilovasidan qaytyapti).
          successHaptic();
          // Yangi ID egalik ro'yxatiga qo'shildi — shaxslarni yangilaymiz.
          AppScope.read(context).refreshIdentities().catchError((_) {});
        } else if (fresh.status == 'cancelled' || fresh.status == 'failed') {
          t.cancel();
          setState(() {
            _order = fresh;
            _phase = _Phase.failed;
          });
          errorHaptic();
        }
      } catch (_) {
        // Tarmoq uzilishi so'rovni to'xtatmaydi — keyingi urinishda
        // qayta so'raladi.
      }
    });
  }

  /// QO'LDA TEKSHIRISH — kutish cho'zilib ketganda.
  Future<void> _recheck() async {
    final id = _order?.id;
    if (id == null || id == 0 || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final fresh = await AppScope.read(context).repo.order(id);
      if (!mounted) return;
      setState(() {
        _order = fresh;
        if (fresh.isPaid) {
          _phase = _Phase.paid;
          _stalled = false;
        } else if (fresh.status == 'cancelled' || fresh.status == 'failed') {
          _phase = _Phase.failed;
          _stalled = false;
        } else {
          // Hali `pending` — kuzatishni QAYTA boshlaymiz.
          _stalled = false;
        }
      });
      if (fresh.isPaid) {
        successHaptic();
        AppScope.read(context).refreshIdentities().catchError((_) {});
      } else if (!_stalled && _phase == _Phase.waiting) {
        _startPolling();
      }
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _payError(ApiError e) => switch (e.key) {
        'payments_disabled' => tr('To‘lov tizimi hozir o‘chirilgan.'),
        'already_taken' => tr('Bu ID allaqachon band qilingan.'),
        'reserved_pending_payment' =>
          tr('Bu ID uchun tugallanmagan to‘lov bor. Buyurtmalar bo‘limidan davom ettiring.'),
        'not_purchasable' => tr('Bu ID sotuvda emas.'),
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
    // `null` — hali so'ralmagan: tugma bloklanmaydi, aks holda
    // sekin tarmoqda ekran bir necha soniya "o'lik" ko'rinardi.
    final paymeOn = _paymeOn ?? true;
    final price = widget.record.price;

    return Column(
      children: [
        TopBar(title: tr('To‘lov')),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x24),
            children: [
              Eyebrow(tr('To‘lov')),
              const SizedBox(height: 6),
              Text(tr('Buyurtmani\ntasdiqlash'), style: T.display),
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
                              Text(widget.record.code, style: T.code.copyWith(fontSize: 16.5)),
                              const SizedBox(height: 3),
                              Text('${TierStyle.of(widget.record.tier).label} · NFC ID',
                                  style: T.caption),
                            ],
                          ),
                        ),
                        Text(som(price), style: T.price.copyWith(fontSize: 15.5)),
                      ],
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: S.x12),
                      child: Divider(),
                    ),
                    Row(
                      children: [
                        Text(tr('Jami'), style: T.cardTitle),
                        const Spacer(),
                        Text('${som(price)} so‘m', style: T.price.copyWith(fontSize: 17.5)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: S.x24),
              Eyebrow(tr('To‘lov usuli')),
              const SizedBox(height: S.x12),
              // BITTA USUL — TANLOV YO'Q.
              //
              // Ilgari bu yerda "Click" ham tanlanadigan qatorda
              // turardi va kvitansiyada "Usul: Click" deb yozilardi.
              // Lekin server ID xaridi uchun FAQAT Payme havolasini
              // yasaydi — ya'ni tanlov soxta edi va odamga noto'g'ri
              // ma'lumot ko'rsatilardi. Click qatori qoldi, lekin
              // ochiqchasiga "hozir mavjud emas" deb turadi.
              _MethodTile(
                name: 'Payme',
                note: paymeOn
                    ? tr('Payme ilovasi orqali')
                    : tr('Hozir vaqtincha o‘chirilgan'),
                color: C.payme,
                selected: paymeOn,
                enabled: paymeOn,
              ),
              const SizedBox(height: S.x8),
              _MethodTile(
                name: 'Click',
                note: tr('Hozir mavjud emas'),
                color: C.click,
                selected: false,
                enabled: false,
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
          decoration: BoxDecoration(
            color: C.obsidian,
            border: Border(top: BorderSide(color: C.hairline)),
          ),
          child: Column(
            children: [
              PrimaryButton(
                paymeOn
                    ? '${som(price)} so‘m to‘lash'
                    : tr('To‘lov hozir ishlamayapti'),
                loading: _busy,
                onTap: (_busy || !paymeOn) ? null : _start,
              ),
              const SizedBox(height: 7),
              Text(
                trf('To‘lov {tizim} tomonidan himoyalangan', {'tizim': 'Payme'}),
                style: T.caption.copyWith(fontSize: 12.5, color: C.muted),
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
            Text(tr('To‘lov\nkutilmoqda'), style: T.display),
            const SizedBox(height: S.x12),
            Text(
              _stalled
                  ? tr('Bankdan tasdiq hali kelmadi. To‘lovni qilgan '
                      'bo‘lsangiz, u biroz kechikishi mumkin — quyidagi '
                      'tugma bilan tekshiring.')
                  : '${trf('To‘lovni {tizim} ilovasida yakunlang.', {'tizim': 'Payme'})} '
                      '${tr('Tasdiq kelishi bilan shu ekran o‘zi yangilanadi.')}',
              style: T.body,
            ),
            const SizedBox(height: S.x24),
            if (!_stalled)
              Row(
                children: [
                  const Spinner(size: 16),
                  const SizedBox(width: S.x12),
                  Text(tr('Bankdan javob olinmoqda…'), style: T.caption),
                ],
              ),
            if (_error != null)
              Text(_error!, style: T.caption.copyWith(color: C.signal)),
            const Spacer(),
            if (_stalled) ...[
              PrimaryButton(
                tr('Holatni tekshirish'),
                loading: _busy,
                onTap: _busy ? null : _recheck,
              ),
              const SizedBox(height: S.x8),
            ],
            if ((_order?.payLink ?? '').isNotEmpty)
              SecondaryButton(
                tr('To‘lov sahifasini qayta ochish'),
                onTap: () => openExternal(Uri.parse(_order!.payLink!)),
              ),
            const SizedBox(height: S.x8),
            GhostButton(tr('Keyinroq'), onTap: () => Navigator.of(context).maybePop()),
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
            Text(tr('To‘lov\nqabul qilindi'), style: T.display),
            const SizedBox(height: S.x12),
            Text(
              trf(
                '{kod} sizga biriktirildi. Endi profilingizni to‘ldirib, '
                'kartani ulashishingiz mumkin.',
                {'kod': widget.record.code},
              ),
              style: T.body,
            ),
            const SizedBox(height: S.x24),
            Surface(
              child: Column(
                children: [
                  _Line(tr('To‘langan'), '${som(_order?.price ?? widget.record.price)} so‘m'),
                  const SizedBox(height: S.x8),
                  _Line(tr('Usul'), 'Payme'),
                  const SizedBox(height: S.x8),
                  _Line(tr('Buyurtma'), '#${_order?.id ?? '—'}'),
                ],
              ),
            ),
            const Spacer(),
            PrimaryButton(tr('Profilni sozlash'), onTap: () => Navigator.of(context).maybePop()),
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
            Text(tr('To‘lov\namalga oshmadi'), style: T.display),
            const SizedBox(height: S.x12),
            Text(
              tr('To‘lov yakunlanmadi. Qayta urinib ko‘ring yoki boshqa usul tanlang.'),
              style: T.body,
            ),
            const Spacer(),
            PrimaryButton(tr('Qayta urinish'), onTap: () => setState(() => _phase = _Phase.choose)),
            const SizedBox(height: S.x8),
            GhostButton(tr('Yopish'), onTap: () => Navigator.of(context).maybePop()),
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
  });

  final String name;
  final String note;
  final Color color;
  final bool selected;
  final bool enabled;

  @override
  Widget build(BuildContext context) => Opacity(
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
                    Text(note, style: T.caption.copyWith(fontSize: 12.5)),
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
                    ? Center(
                        child: NIcon(Ico.check, size: 12, color: C.ink))
                    : null,
              ),
            ],
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
