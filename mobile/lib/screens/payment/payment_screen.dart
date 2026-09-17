import 'dart:async';

import 'package:qr_flutter/qr_flutter.dart';
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../identity/profile_screen.dart';
import '../nfc/nfc_write.dart';
import '../settings/support.dart';

/// TO'LOV.
///
/// ENG MUHIM QOIDA: mijoz ilovasi to'lov muvaffaqiyatli bo'lganini
/// O'ZI BELGILAMAYDI. Oqim:
///   1) ilova band qilish so'rovini yuboradi — server `pending`
///      buyurtma va `payLink` qaytaradi;
///   2) ilova Payme'ni TASHQI ilovada ochadi;
///   3) provayder to'lovni tasdiqlaydi va backend'ga webhook yuboradi;
///   4) ilova buyurtma holatini SERVERDAN so'rab turadi.
///
/// Ya'ni ekrandagi "ID sizniki" faqat server `paid` degandan keyin
/// chiqadi. Provayderdan qaytishning o'zi hech narsani bildirmaydi
/// va dizayn buni alohida ta'kidlaydi.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, required this.record, this.provider});

  final Record record;

  /// ID tafsilotidan tanlangan to'lov usuli (prototip: kartaning
  /// o'zida Payme va Click tugmalari turadi). Berilmasa — shu
  /// ekranda tanlanadi.
  final String? provider;

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

  /// Click yoqilganmi — SERVER aytadi.
  ///
  /// Kalitlar (`CLICK_SERVICE_ID`, `CLICK_SECRET_KEY`) qo'yilmagan
  /// bo'lsa server `false` deydi va tugma o'chiq turadi. Ilova
  /// hech narsani o'zi taxmin qilmaydi.
  bool? _clickOn;

  /// Odam tanlagan to'lov tizimi.
  late String _provider = widget.provider ?? 'payme';

  /// QR ko'rsatilyaptimi.
  bool _qr = false;

  /// Joriy buyurtmaning tanlangan tizim uchun havolasi.
  String? get _payLink {
    final link = _order?.linkFor(_provider);
    return (link == null || link.isEmpty) ? null : link;
  }

  /// So'rov 5 daqiqa davomida javob bermadi.
  ///
  /// Ilgari bu holatda taymer jimgina to'xtardi va ekranda
  /// aylanma ABADIY qolib ketardi — odam uchun bu ilova osilib
  /// qolgani bilan bir xil.
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
        setState(() {
          _paymeOn = _providerOn(e, 'payme');
          _clickOn = _providerOn(e, 'click');
          // Payme o'chiq, Click yoqiq bo'lsa — tanlov o'zi Click'ka
          // o'tadi, aks holda odam o'chiq tugmaga qarab turardi.
          // Tanlangan usul o'chiq bo'lsa — ishlaydiganiga o'tamiz.
          if (_provider == 'payme' && _paymeOn == false && _clickOn == true) {
            _provider = 'click';
          }
          if (_provider == 'click' && _clickOn == false && _paymeOn == true) {
            _provider = 'payme';
          }
        });

        // USUL OLDINDAN TANLANGAN BO'LSA — QADAM TAKRORLANMAYDI.
        //
        // ID tafsilotida odam Payme yoki Click tugmasini bosgan.
        // Shu ekranda yana "usulni tanlang" ko'rsatish o'sha
        // tanlovni ikkinchi marta so'rash bo'lardi.
        if (widget.provider != null &&
            _phase == _Phase.choose &&
            !_busy &&
            ((_provider == 'payme' && _paymeOn == true) ||
                (_provider == 'click' && _clickOn == true))) {
          _start();
        }
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
  /// ishlaydigan "to'lash" tugmasi turardi.
  ///
  /// `providers` bo'lmasa (eski server) eski `enabled` kalitiga
  /// qaytamiz.
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
      final order = await repo.reserveRecord(widget.record.code, provider: _provider);
      if (!mounted) return;
      setState(() {
        _order = order;
        _phase = _Phase.waiting;
      });
      // TANLANGAN TIZIM HAVOLASI.
      //
      // Server javobida `payLinks: {payme, click}` keladi; eski
      // serverda faqat `payLink` (Payme) bo'ladi va `linkFor()`
      // o'shanga qaytadi.
      final link = order.linkFor(_provider);
      if (link == null || link.isEmpty) {
        // HAVOLA KELMADI — JIM QOLMAYMIZ.
        //
        // Buyurtma ochildi, lekin tanlangan tizim uchun checkout
        // havolasi yo'q (masalan Click kalitlari to'liq emas).
        // Ilgari ekran shu holatda ham "kutilmoqda" ga o'tardi va
        // odam nimani kutayotganini bilmasdi. Endi sabab aytiladi
        // va buyurtma o'z holicha qoladi — uni "Buyurtmalarim" dan
        // boshqa tizim bilan davom ettirish mumkin.
        setState(() {
          _phase = _Phase.choose;
          _error = trf('{tizim} orqali to‘lov havolasi kelmadi. Boshqa '
              'usulni tanlang yoki birozdan so‘ng urinib ko‘ring.', {
            'tizim': _provider == 'click' ? 'Click' : 'Payme',
          });
        });
        return;
      }
      await openExternal(Uri.parse(link));
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
  /// davomida: Payme tasdig'i odatda bir necha soniyada keladi,
  /// lekin bank sekin bo'lishi mumkin.
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
          // Yangi ID egalik ro'yxatiga qo'shildi.
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
        'reserved_pending_payment' => tr(
            'Bu ID uchun tugallanmagan to‘lov bor. Buyurtmalar bo‘limidan '
            'davom ettiring.'),
        'not_purchasable' => tr('Bu ID sotuvda emas.'),
        _ => humanError(e),
      };

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: _phase == _Phase.choose ? Aura.spotlight : Aura.center,
        child: SafeArea(
          bottom: false,
          child: switch (_phase) {
            _Phase.choose => _buildChoose(),
            _Phase.waiting => _buildWaiting(),
            _Phase.paid => _buildPaid(),
            _Phase.failed => _buildFailed(),
          },
        ),
      );

  // ── 1. USULNI TANLASH (dizayn 3c) ───────────────────────────

  Widget _buildChoose() {
    // `null` — hali so'ralmagan: tugma bloklanmaydi, aks holda
    // sekin tarmoqda ekran ishlamaydigandek ko'rinardi.
    final paymeOn = _paymeOn ?? true;
    // Click uchun standart — O'CHIQ. Sabab: Payme'ni eski server ham
    // qo'llaydi, Click esa faqat kalitlar qo'yilgach ishlaydi va
    // ishonch hosil qilmasdan uni yoqib ko'rsatish odamni bo'sh
    // urinishga olib borardi.
    final clickOn = _clickOn ?? false;
    final record = widget.record;

    return Column(
      children: [
        TopBar(
          center: Text(
            '${tr('BUYURTMA')} · ${record.code}',
            style: T.meta.copyWith(letterSpacing: 1.4),
          ),
        ),
        Expanded(
          child: ListView(
            padding: EdgeInsets.only(bottom: StickyBar.inset(context)),
            children: [
              ScreenTitle(
                tr('To‘lov usuli'),
                subtitle: tr('Provayderni tanlang. To‘lov muvaffaqiyatini '
                    'faqat server tasdiqlaydi.'),
              ),

              // BUYURTMA XULOSASI.
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Surface(
                  padding: const EdgeInsets.all(S.x12),
                  child: Row(
                    children: [
                      MiniIdCard(
                        code: record.code,
                        tier: record.tier,
                        width: 92,
                      ),
                      const SizedBox(width: S.x12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '${TierStyle.of(record.tier).label} · '
                              '${record.code}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: T.cardTitle,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              tr('Bir marta to‘lov'),
                              style: T.caption.copyWith(fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      Text(som(record.price), style: T.amount.copyWith(
                        fontSize: 17,
                      )),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: S.x20),

              // PROVAYDERLAR. Brend ranglari o'zgarmaydi.
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Column(
                  children: [
                    _Provider(
                      name: 'Payme',
                      color: C.payme,
                      title: tr('Payme orqali'),
                      note: paymeOn
                          ? tr('Payme ilovasiga o‘tiladi')
                          : tr('Hozir o‘chirilgan'),
                      selected: paymeOn && _provider == 'payme',
                      enabled: paymeOn,
                      onTap: paymeOn
                          ? () => setState(() => _provider = 'payme')
                          : null,
                    ),
                    const SizedBox(height: S.x8),
                    _Provider(
                      name: 'Click',
                      color: C.click,
                      title: tr('Click orqali'),
                      note: clickOn
                          ? tr('Click ilovasiga o‘tiladi')
                          : tr('Hozir o‘chirilgan'),
                      selected: clickOn && _provider == 'click',
                      enabled: clickOn,
                      onTap: clickOn
                          ? () => setState(() => _provider = 'click')
                          : null,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: S.x16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: _Note(
                  tr('To‘lovdan qaytganingizdan keyin ID darhol berilmaydi — '
                      'server javobi kutiladi.'),
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: S.x16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  child: _ErrorNote(_error!),
                ),
              ],
            ],
          ),
        ),

        // YOPISHGAN JAMI VA HARAKAT.
        StickyBar(
          child: Column(
            children: [
              Row(
                children: [
                  Text(tr('Jami'), style: T.cardTitle),
                  const Spacer(),
                  Text(som(widget.record.price), style: T.price.copyWith(
                    fontSize: 30,
                  )),
                  const SizedBox(width: 6),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(tr('so‘m'), style: T.meta),
                  ),
                ],
              ),
              const SizedBox(height: S.x12),
              PrimaryButton(
                tr('Payme bilan to‘lash'),
                loading: _busy,
                onTap: (_busy || !paymeOn) ? null : _start,
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ── 2. KUTISH (dizayn 3d yuqori) ────────────────────────────

  Widget _buildWaiting() => Column(
        children: [
          const TopBar(showBack: false),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Spinner(size: 62, stroke: 2.5),
                    const SizedBox(height: S.x32),
                    Text(
                      _stalled
                          ? tr('Javob kechikmoqda')
                          : tr('To‘lov tekshirilmoqda'),
                      textAlign: TextAlign.center,
                      style: T.title,
                    ),
                    const SizedBox(height: S.x12),
                    Text(
                      _stalled
                          ? tr('Server hali javob bermadi. To‘lov o‘tgan '
                              'bo‘lishi ham mumkin — holatni tekshiring.')
                          : tr('Ilovani yopmang. Server to‘lovni tasdiqlashi '
                              'bilan kartangiz faollashadi.'),
                      textAlign: TextAlign.center,
                      style: T.body,
                    ),
                    const SizedBox(height: S.x20),
                    // PROTOTIPDAGI CHIP: tizim · kod · summa. Odam
                    // nima uchun to'layotganini kutish paytida ham
                    // ko'rib turadi.
                    StatusChip(
                      '${_provider == 'click' ? 'Click' : 'Payme'} · '
                      '${widget.record.code} · ${som(widget.record.price)} ${tr('so‘m')}',
                      tone: StatusTone.pending,
                    ),
                    const SizedBox(height: S.x32),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SecondaryButton(
                          tr('Holatni yangilash'),
                          size: BtnSize.m,
                          expand: false,
                          loading: _busy,
                          onTap: _busy ? null : _recheck,
                        ),
                        const SizedBox(width: S.x8),
                        GhostButton(
                          tr('Bekor qilish'),
                          color: C.ink2,
                          onTap: () => Navigator.of(context).maybePop(),
                        ),
                      ],
                    ),
                    const SizedBox(height: S.x16),
                    Text(
                      tr('Qayta to‘lash talab qilinmaydi'),
                      style: T.meta,
                    ),

                    // QR — ZAXIRA YO'L.
                    //
                    // To'lov ilovasi (Payme/Click) shu telefonda
                    // o'rnatilmagan bo'lsa, havola brauzerda ochiladi va
                    // bu ba'zan noqulay. QR esa boshqa telefondan yoki
                    // karta ilovasidan skanerlab to'lash imkonini beradi
                    // — saytdagi "QR kod bilan to'lash" bilan bir xil.
                    if (_payLink != null) ...[
                      const SizedBox(height: S.x24),
                      GhostButton(
                        _qr ? tr('QR kodni yashirish') : tr('QR kod bilan to‘lash'),
                        icon: Ico.qr,
                        color: C.ink2,
                        onTap: () => setState(() => _qr = !_qr),
                      ),
                      if (_qr) ...[
                        const SizedBox(height: S.x12),
                        Container(
                          padding: const EdgeInsets.all(S.x12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFFFFF),
                            borderRadius: BorderRadius.circular(R.card),
                          ),
                          child: QrImageView(
                            data: _payLink!,
                            size: 188,
                            padding: EdgeInsets.zero,
                            backgroundColor: const Color(0xFFFFFFFF),
                          ),
                        ),
                      ],
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: S.x16),
                      _ErrorNote(_error!),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      );

  // ── 3. SERVER TASDIQLADI (dizayn 3d past) ───────────────────

  Widget _buildPaid() => Column(
        children: [
          const TopBar(showBack: false),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IdentityCard(
                      code: widget.record.code,
                      tier: widget.record.tier,
                      flippable: false,
                    ),
                    const SizedBox(height: S.x32),
                    Text(tr('To‘lov qabul qilindi'), style: T.title),
                    const SizedBox(height: S.x12),
                    Text(
                      trf(
                        '{code} kodi endi sizniki. Profilni sozlang va '
                        'kartaga yozing.',
                        {'code': widget.record.code},
                      ),
                      textAlign: TextAlign.center,
                      style: T.body,
                    ),
                    const SizedBox(height: S.x20),
                    StatusChip(
                      tr('To‘lov tasdiqlandi · server'),
                      tone: StatusTone.ok,
                    ),
                    const SizedBox(height: S.x32),
                    // PROTOTIPDAGI IKKI TUGMA: keyingi qadam
                    // ikkita va ikkalasi ham kerak — profilni
                    // to'ldirish va kartaga yozish.
                    Row(
                      children: [
                        Expanded(
                          child: PrimaryButton(
                            tr('Profilni sozlash'),
                            onTap: () => push<void>(
                              context,
                              (_) => ProfileScreen(code: widget.record.code),
                            ),
                          ),
                        ),
                        const SizedBox(width: S.x8),
                        Expanded(
                          child: SecondaryButton(
                            tr('Kartaga yozish'),
                            onTap: () => push<void>(
                              context,
                              (_) => const NfcWriteScreen(),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      );

  // ── 4. BEKOR QILINDI ────────────────────────────────────────

  Widget _buildFailed() => Column(
        children: [
          const TopBar(),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: C.fail.withValues(alpha: .12),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: C.fail.withValues(alpha: .35),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: NIcon(Ico.close, size: 28, color: C.fail),
                    ),
                    const SizedBox(height: S.x24),
                    Text(tr('To‘lov bekor qilindi'), style: T.title),
                    const SizedBox(height: S.x12),
                    Text(
                      tr('Pul yechilmadi. Xohlasangiz qaytadan urinib '
                          'ko‘rishingiz mumkin.'),
                      textAlign: TextAlign.center,
                      style: T.body,
                    ),
                    const SizedBox(height: S.x32),
                    PrimaryButton(
                      tr('Qayta urinish'),
                      onTap: () => setState(() {
                        _phase = _Phase.choose;
                        _order = null;
                        _error = null;
                      }),
                    ),
                    // YORDAMGA YOZISH (prototip: "To'lov o'tmadi"
                    // ekrani).
                    //
                    // "Qayta urinish" yagona yo'l bo'lsa, ekran boshi
                    // BERK bo'ladi: pul kartadan yechilgan, lekin
                    // buyurtma o'tmagan odam qayta-qayta urinadan
                    // boshqa hech narsa qila olmaydi. Aynan o'sha odam
                    // tirik odamga yozishi kerak.
                    const SizedBox(height: S.x12),
                    GhostButton(
                      tr('Yordamga yozish'),
                      onTap: () => push<void>(
                        context,
                        (_) => const SupportScreen(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      );
}

// ─────────────────────────────────────────────────────────────

/// To'lov provayderi qatori.
///
/// Tanlov RADIO belgisi bilan ko'rsatiladi — faqat rang bilan emas.
class _Provider extends StatelessWidget {
  const _Provider({
    required this.name,
    required this.color,
    required this.title,
    required this.note,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String name;
  final Color color;
  final String title;
  final String note;
  final bool selected;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        border: Border.all(
          color: selected ? color.withValues(alpha: .7) : C.line,
          width: selected ? 1.4 : 1,
        ),
        onTap: enabled ? onTap : null,
        child: Row(
          children: [
            // Brend belgisi — rangi O'ZGARMAYDI.
            Container(
              width: 56,
              height: 34,
              decoration: BoxDecoration(
                color: enabled ? color : color.withValues(alpha: .35),
                borderRadius: BorderRadius.circular(R.status),
              ),
              alignment: Alignment.center,
              child: Text(
                name,
                style: T.buttonSm.copyWith(
                  color: const Color(0xFF07131A),
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: T.cardTitle.copyWith(
                      color: enabled ? C.ink : C.ink3,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(note, style: T.caption.copyWith(fontSize: 12)),
                ],
              ),
            ),
            const SizedBox(width: S.x8),
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? color : C.ink3,
                  width: selected ? 6 : 1.4,
                ),
              ),
            ),
          ],
        ),
      );
}

class _Note extends StatelessWidget {
  const _Note(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NIcon(Ico.info, size: 16, color: C.ink3),
            const SizedBox(width: S.x12),
            Expanded(
              child: Text(text, style: T.caption.copyWith(fontSize: 12.5)),
            ),
          ],
        ),
      );
}

class _ErrorNote extends StatelessWidget {
  const _ErrorNote(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        border: Border.all(color: C.fail.withValues(alpha: .35)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NIcon(Ico.warning, size: 16, color: C.fail),
            const SizedBox(width: S.x12),
            Expanded(
              child: Text(
                text,
                style: T.caption.copyWith(fontSize: 12.5, color: C.fail),
              ),
            ),
          ],
        ),
      );
}
