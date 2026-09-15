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

                  // KARTA KO'RINISHI — o'girilmaydi: bu buyurtma
                  // qilinayotgan mahsulotning ko'rinishi, o'yinchoq
                  // emas.
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: IdentityCard(
                      code: widget.record.code,
                      tier: widget.record.tier,
                      holder: widget.record.name,
                      url: 'nfcstore.uz/${widget.record.code.toLowerCase()}',
                      flippable: false,
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

                        const SizedBox(height: S.x32),

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
