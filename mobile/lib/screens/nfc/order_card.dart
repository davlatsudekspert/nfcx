import 'package:flutter/services.dart'
    show FilteringTextInputFormatter, TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/input.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';

/// JISMONIY KARTA BUYURTMASI.
///
/// NARX SERVERDAN (`/api/settings/physical-nfc-pricing` javobidagi
/// `physicalCardFee`). Mijozda narx jadvali yozilmaydi: saytda narx
/// o'zgarsa ilova eski summani ko'rsatib turardi.
///
/// KARTADA NIMA CHOP ETILADI — PROFILDAN. Buyurtma endpointida bosma
/// ism yoki lavozim uchun maydon YO'Q (`shippingName` — yetkazib
/// berish uchun, bosma uchun emas). Shuning uchun bu ekranda "kartada
/// yoziladigan ism" kiritish maydoni ham chizilmaydi: u hech qayerga
/// bormasdi va odam chop etilgan kartani ko'rgach aldanganday
/// his qilardi.
///
/// BOSMA MAKET ham bu ekranda YO'Q. Sayt kartaning old va orqa
/// tomonini 600 DPI PNG qilib chizib yuklaydi; ilovada bu alohida
/// chizma dvigatelini talab qiladi. Backend maketsiz buyurtmani ham
/// qabul qiladi — admin mijoz bilan bog'lanib kelishadi.
///
/// YETKAZISH MUDDATI faqat server aytsa yoziladi
/// (`physicalPricing()['delivery']`). Aks holda hech qanday muddat
/// ko'rsatilmaydi — o'ylab topilgan "3–5 kun" va'da bo'lib qolardi.
class OrderCardScreen extends StatefulWidget {
  const OrderCardScreen({super.key, required this.record});

  final Record record;

  @override
  State<OrderCardScreen> createState() => _OrderCardScreenState();
}

class _OrderCardScreenState extends State<OrderCardScreen> {
  final _city = TextEditingController();
  final _address = TextEditingController();
  final _phone = TextEditingController();

  int _qty = 1;
  int? _fee;

  /// Serverdan kelgan yetkazish muddati. `null` — server aytmadi,
  /// demak ekranda ham yozilmaydi.
  int? _minDays;
  int? _maxDays;

  bool _loading = true;
  bool _busy = false;
  String? _error;
  Order? _order;

  /// Backenddagi `PHYSICAL_CARD_MAX_QTY` bilan bir xil.
  static const _maxQty = 50;

  @override
  void initState() {
    super.initState();
    final state = AppScope.read(context);
    _city.text = widget.record.city;
    _phone.text = widget.record.phone.isNotEmpty
        ? widget.record.phone
        : (state.user?.phone ?? '');
    _loadPricing();
  }

  @override
  void dispose() {
    _city.dispose();
    _address.dispose();
    _phone.dispose();
    super.dispose();
  }

  /// KARTA YUZASI — mijoz tanlaydigan material (prototip:
  /// "Karta dizayni" qatoridagi Qora mat · Xrom · Oltin · Titan).
  ///
  /// Kalitlar SERVERDAGI ro'yxat bilan bir xil
  /// (`hosting/api/account.js: FINISHES`) — ular buyurtma ichida
  /// saqlanadi va bosmaxonaga shu bilan boradi.
  static const _finishes = <({String key, String label, List<Color> colors})>[
    (key: 'matte_black', label: 'Qora mat', colors: [Color(0xFF2A2E36), Color(0xFF16181D)]),
    (key: 'chrome', label: 'Xrom', colors: [Color(0xFFB9C1CA), Color(0xFF6E7680)]),
    (key: 'gold', label: 'Oltin', colors: [Color(0xFFF0C419), Color(0xFF9C7A0E)]),
    (key: 'titanium', label: 'Titan', colors: [Color(0xFFD4AF37), Color(0xFF6B5411)]),
  ];
  String _finish = 'matte_black';

  Future<void> _loadPricing() async {
    try {
      final p = await AppScope.read(context).repo.physicalPricing();
      if (!mounted) return;
      final delivery = p['delivery'];
      setState(() {
        final fee = p['physicalCardFee'];
        _fee = fee is num ? fee.round() : null;
        if (delivery is Map) {
          final min = delivery['minDays'];
          final max = delivery['maxDays'];
          _minDays = min is num ? min.round() : null;
          _maxDays = max is num ? max.round() : null;
        }
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = humanError(e);
        _loading = false;
      });
    }
  }

  /// Yetkazish muddati satri — faqat server bergan qiymatdan.
  String? get _deliveryNote {
    final min = _minDays;
    final max = _maxDays;
    if (min == null && max == null) return null;
    final range = max == null || max == min ? '${min ?? max}' : '$min–$max';
    return trf('Yetkazish {kun} kun', {'kun': range});
  }

  Future<void> _submit() async {
    if (_phone.text.replaceAll(RegExp(r'\D'), '').length < 7) {
      setState(() => _error = tr('Aloqa raqamini to‘liq kiriting.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // `shippingName` SERVERDA MAJBURIY, lekin u bosma ism emas —
      // pochta uchun qabul qiluvchi nomi. Uni profildan olamiz,
      // shuning uchun ekranda alohida maydon yo'q.
      final receiver = widget.record.name.trim().isEmpty
          ? widget.record.code
          : widget.record.name.trim();
      final address = [
        _city.text.trim(),
        _address.text.trim(),
      ].where((s) => s.isNotEmpty).join(', ');

      final res = await AppScope.read(context).repo.orderPhysicalCard(
        widget.record.code,
        {
          'shippingName': receiver,
          'shippingPhone': _phone.text.trim(),
          'shippingAddress': address,
          'quantity': _qty,
          'finish': _finish,
        },
      );
      if (!mounted) return;
      setState(() {
        _order = Order.fromJson({
          ...res,
          'id': res['orderId'] ?? res['id'],
          'code': widget.record.code,
          'price': res['amount'] ?? res['price'],
          'status': 'pending',
          'kind': 'physical_card_order',
        });
      });
      // Buyurtma serverda yaratildi — to'lovga o'tishdan oldin
      // tasdiq sezilsin.
      successHaptic();
      final link = _order?.linkFor('payme') ?? _order?.linkFor('click');
      if (link != null) await openExternal(Uri.parse(link));
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = _cardError(e));
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _cardError(ApiError e) => switch (e.key) {
        'feature_locked' =>
          tr('Jismoniy karta Silver va undan yuqori ID uchun. ID tarifingizni ko‘taring.'),
        'payments_disabled' => tr('To‘lov tizimi hozir o‘chirilgan.'),
        'shipping_required' => tr('Ism va telefon raqami kerak.'),
        'bad_quantity' => tr('Sonni tekshiring.'),
        'forbidden' => tr('Bu ID sizga tegishli emas.'),
        _ => humanError(e),
      };

  @override
  Widget build(BuildContext context) =>
      _order != null ? _created(_order!) : _form();

  // ── BUYURTMA YARATILDI ───────────────────────────────────────

  Widget _created(Order order) {
    final note = _deliveryNote;
    return ScreenBackdrop(
      aura: Aura.center,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(S.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Text(tr('Buyurtma yaratildi'), style: T.title),
              const SizedBox(height: S.x12),
              Text(
                tr('To‘lovni yakunlang — shundan keyin karta chop etishga '
                    'ketadi.'),
                style: T.body,
              ),
              if (note != null) ...[
                const SizedBox(height: S.x8),
                Text(note, style: T.meta),
              ],
              const SizedBox(height: S.x24),
              Surface(
                child: Row(
                  children: [
                    Text(tr('Summa'), style: T.caption),
                    const Spacer(),
                    Text(
                      trf('{son} so‘m', {'son': som(order.price)}),
                      style: T.amount.copyWith(fontSize: 17),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              if (order.linkFor('payme') != null || order.linkFor('click') != null)
                PrimaryButton(
                  tr('To‘lov sahifasini ochish'),
                  onTap: () {
                    final link = order.linkFor('payme') ?? order.linkFor('click');
                    if (link != null) openExternal(Uri.parse(link));
                  },
                ),
              const SizedBox(height: S.x12),
              SecondaryButton(
                tr('Yopish'),
                onTap: () => Navigator.of(context).pop(),
              ),
              const SizedBox(height: S.x24),
            ],
          ),
        ),
      ),
    );
  }

  // ── FORMA ────────────────────────────────────────────────────

  Widget _form() {
    final fee = _fee;
    final total = fee == null ? null : fee * _qty;
    final note = _deliveryNote;

    return ScreenBackdrop(
      aura: Aura.spotlight,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: S.x24),
                children: [
                  ScreenTitle(tr('NFC karta buyurtmasi')),

                  // MAHSULOT HERO — buyurtma sahifasida metall karta
                  // faqat forma ustidagi preview emas, mahsulotning o'zi.
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: _OrderHero(
                      record: widget.record,
                    ),
                  ),

                  const SizedBox(height: S.x32),

                  // ── KARTADA CHOP ETILADI ───────────────────────
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Eyebrow(tr('Kartada chop etiladi')),
                        const SizedBox(height: S.x12),
                        Surface(
                          padding: const EdgeInsets.symmetric(
                            horizontal: S.x16,
                            vertical: S.x12,
                          ),
                          shadow: C.e1,
                          child: Row(
                            children: [
                              TierDot(widget.record.tier, size: 14),
                              const SizedBox(width: S.x12),
                              Expanded(
                                child: Text(
                                  widget.record.code,
                                  style: T.code(18),
                                ),
                              ),
                              Text(
                                TierStyle.of(widget.record.tier).label,
                                style: T.meta,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: S.x8),
                        Text(
                          tr('Ism va lavozim profilingizdan olinadi — '
                              'kartani buyurtma qilishdan oldin profilni '
                              'tekshiring.'),
                          style: T.caption.copyWith(
                            fontSize: 12.5,
                            color: C.ink3,
                          ),
                        ),

                        const SizedBox(height: S.x24),

                        // ── KARTA DIZAYNI ─────────────────────
                        //
                        // To'rtta yuza — prototipdagi tartibda.
                        // Namuna rangi materialning o'zi: yozuvdan
                        // ko'ra rang tezroq tanitadi.
                        Eyebrow(tr('Karta dizayni')),
                        const SizedBox(height: S.x12),
                        Row(
                          children: [
                            for (final f in _finishes) ...[
                              Expanded(
                                child: Press(
                                  onTap: () => setState(() => _finish = f.key),
                                  minSize: 0,
                                  scale: .96,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: S.x8),
                                    decoration: BoxDecoration(
                                      color: C.surface,
                                      borderRadius: BorderRadius.circular(R.tile),
                                      border: Border.all(
                                        color: _finish == f.key ? C.accent : C.line,
                                        width: _finish == f.key ? 2 : 1,
                                      ),
                                    ),
                                    child: Column(
                                      children: [
                                        Container(
                                          width: 34,
                                          height: 22,
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(6),
                                            gradient: LinearGradient(
                                              begin: const Alignment(-.9, -1),
                                              end: const Alignment(.9, 1),
                                              colors: f.colors,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          tr(f.label),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: T.caption.copyWith(
                                            fontSize: 11,
                                            color: _finish == f.key ? C.accent : C.ink2,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                              if (f != _finishes.last) const SizedBox(width: 6),
                            ],
                          ],
                        ),

                        const SizedBox(height: S.x24),

                        // ── SONI ──────────────────────────────
                        Row(
                          children: [
                            Expanded(child: Eyebrow(tr('Soni'))),
                            _Stepper(
                              value: _qty,
                              max: _maxQty,
                              onChange: (v) => setState(() => _qty = v),
                            ),
                          ],
                        ),

                        const SizedBox(height: S.x32),

                        // ── YETKAZISH MANZILI ─────────────────
                        Eyebrow(tr('Yetkazish manzili')),
                        const SizedBox(height: S.x12),
                        Field(
                          label: tr('Shahar'),
                          controller: _city,
                          hint: tr('Toshkent'),
                          keyboardType: TextInputType.text,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: S.x16),
                        Field(
                          label: tr('Manzil'),
                          controller: _address,
                          hint: tr('Ko‘cha, uy, mo‘ljal'),
                          maxLines: 2,
                          keyboardType: TextInputType.streetAddress,
                        ),
                        const SizedBox(height: S.x16),
                        Field(
                          label: tr('Aloqa raqami'),
                          controller: _phone,
                          hint: '+998 90 123 45 67',
                          keyboardType: TextInputType.phone,
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp(r'[0-9+\s]'),
                            ),
                          ],
                          helper: note,
                          error: _error,
                        ),

                        const SizedBox(height: S.x24),

                        // ── IZOH ──────────────────────────────
                        Surface(
                          padding: const EdgeInsets.all(S.x16),
                          shadow: C.e1,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              NIcon(Ico.info, size: 18, color: C.ink3),
                              const SizedBox(width: S.x12),
                              Expanded(
                                child: Text(
                                  tr('Bu jismoniy karta buyurtmasi. ID tarifi '
                                      'va Profil Premium bundan alohida — '
                                      'ular o‘zgarmaydi.'),
                                  style: T.caption,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            StickyBar(
              child: Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(tr('Jami'), style: T.statLabel),
                      const SizedBox(height: 3),
                      if (_loading)
                        const Spinner(size: 16)
                      else
                        Text(
                          total == null
                              ? '—'
                              : trf('{son} so‘m', {'son': som(total)}),
                          style: T.amount.copyWith(fontSize: 17),
                        ),
                    ],
                  ),
                  const SizedBox(width: S.x16),
                  Expanded(
                    child: PrimaryButton(
                      tr('Buyurtma berish'),
                      loading: _busy,
                      onTap: _busy || _loading ? null : _submit,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Qora NFC karta uchun fotografik mahsulot vitrinası. Pastdagi
/// ma'lumotlar va to'lov formasi o'z holicha qoladi — bu qism faqat
/// mahsulotni ko'rsatish uchun.
class _OrderHero extends StatelessWidget {
  const _OrderHero({required this.record});

  final Record record;

  @override
  Widget build(BuildContext context) => Container(
        height: 286,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(R.card),
          border: Border.all(color: C.accent.withValues(alpha: .32)),
          boxShadow: C.e2,
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(
              'assets/img/premium_contact_sheet.png',
              fit: BoxFit.cover,
              alignment: const Alignment(1, 1),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x18000000), Color(0xE8000000)],
                ),
              ),
            ),
            Positioned(
              left: S.x16,
              right: S.x16,
              bottom: S.x16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'NFCSTORE Black Edition',
                    style: T.section.copyWith(
                      color: C.onMedia,
                      shadows: C.mediaText,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${record.code} · metall karta · NFC ulanish',
                    style: T.caption.copyWith(
                      color: C.onMedia2,
                      shadows: C.mediaText,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

/// Son tanlagich — bosish maydoni `RoundButton` ichida 48 dp.
class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.value,
    required this.max,
    required this.onChange,
  });

  final int value;
  final int max;
  final ValueChanged<int> onChange;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          RoundButton(
            Ico.minus,
            size: 38,
            iconSize: 16,
            onTap: value > 1 ? () => onChange(value - 1) : null,
          ),
          SizedBox(
            width: 44,
            child: Text(
              '$value',
              textAlign: TextAlign.center,
              style: T.code(17),
            ),
          ),
          RoundButton(
            Ico.plus,
            size: 38,
            iconSize: 16,
            onTap: value < max ? () => onChange(value + 1) : null,
          ),
        ],
      );
}
