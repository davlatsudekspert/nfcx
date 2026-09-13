import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../common/top_bar.dart';

/// JISMONIY KARTA BUYURTMASI.
///
/// NARX SERVERDAN (`/api/settings/physical-nfc-pricing` javobidagi
/// `physicalCardFee`). Mijozda narx jadvali yozilmaydi: saytda narx
/// o'zgarsa ilova eski summani ko'rsatib turardi.
///
/// BOSMA MAKET bu ekranda YO'Q. Sayt kartaning old va orqa tomonini
/// 600 DPI PNG qilib chizib yuklaydi; ilovada bu alohida chizma
/// dvigatelini talab qiladi. Backend maketsiz buyurtmani ham qabul
/// qiladi — admin mijoz bilan bog'lanib kelishadi. Soxta "dizayn
/// tanlash" ekrani yasamaymiz.
class OrderCardScreen extends StatefulWidget {
  const OrderCardScreen({super.key, required this.record});
  final Record record;

  @override
  State<OrderCardScreen> createState() => _OrderCardScreenState();
}

class _OrderCardScreenState extends State<OrderCardScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();

  int _qty = 1;
  int? _fee;
  int _minDays = 3;
  int _maxDays = 5;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  Order? _order;

  @override
  void initState() {
    super.initState();
    final state = AppScope.read(context);
    _name.text = widget.record.name;
    _phone.text = widget.record.phone.isNotEmpty
        ? widget.record.phone
        : (state.user?.phone ?? '');
    _loadPricing();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
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
          _minDays = (delivery['minDays'] as num? ?? 3).round();
          _maxDays = (delivery['maxDays'] as num? ?? 5).round();
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

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty || _phone.text.replaceAll(RegExp(r'\D'), '').length < 7) {
      setState(() => _error = 'Ism va telefon raqamini to‘liq kiriting.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await AppScope.read(context).repo.orderPhysicalCard(
        widget.record.code,
        {
          'shippingName': _name.text.trim(),
          'shippingPhone': _phone.text.trim(),
          'shippingAddress': _address.text.trim(),
          'quantity': _qty,
        },
      );
      if (!mounted) return;
      setState(() {
        _order = Order(
          id: (res['orderId'] as num?)?.round() ?? 0,
          code: widget.record.code,
          price: (res['amount'] as num?)?.round() ?? 0,
          status: 'pending',
          kind: 'physical_card_order',
          payLink: '${res['payLink'] ?? ''}'.isEmpty ? null : '${res['payLink']}',
        );
      });
      final link = _order?.payLink;
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
          'Jismoniy karta Silver va undan yuqori ID uchun. ID tarifingizni ko‘taring.',
        'payments_disabled' => 'To‘lov tizimi hozir o‘chirilgan.',
        'shipping_required' => 'Ism va telefon raqami kerak.',
        'bad_quantity' => 'Sonni tekshiring.',
        'forbidden' => 'Bu ID sizga tegishli emas.',
        _ => humanError(e),
      };

  @override
  Widget build(BuildContext context) {
    if (_order != null) {
      return Scaffold(
        backgroundColor: C.obsidian,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                const Text('Buyurtma\nyaratildi', style: T.display),
                const SizedBox(height: S.x12),
                Text(
                  'To‘lovni yakunlang — shundan keyin karta chop etishga '
                  'ketadi. Yetkazish $_minDays–$_maxDays kun.',
                  style: T.body,
                ),
                const SizedBox(height: S.x24),
                Surface(
                  child: Row(
                    children: [
                      const Text('Summa', style: T.caption),
                      const Spacer(),
                      Text('${som(_order!.price)} so‘m', style: T.price.copyWith(fontSize: 15)),
                    ],
                  ),
                ),
                const Spacer(),
                if (_order!.payLink != null)
                  PrimaryButton(
                    'To‘lov sahifasini ochish',
                    onTap: () => openExternal(Uri.parse(_order!.payLink!)),
                  ),
                const SizedBox(height: S.x8),
                GhostButton('Yopish', onTap: () => Navigator.of(context).pop()),
                const SizedBox(height: S.x24),
              ],
            ),
          ),
        ),
      );
    }

    final fee = _fee;
    final total = fee == null ? null : fee * _qty;

    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(title: 'Jismoniy karta'),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x24),
                children: [
                  // Karta ko'rinishi — dizayndagi maket.
                  AspectRatio(
                    aspectRatio: 1.586,
                    child: Container(
                      padding: const EdgeInsets.all(S.x20),
                      decoration: BoxDecoration(
                        gradient: C.metalSurface,
                        borderRadius: BorderRadius.circular(R.hero),
                        border: Border.all(color: C.metalBorder),
                        boxShadow: E.e3,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Eyebrow('NFCSTORE.UZ'),
                          const Spacer(),
                          Text(
                            widget.record.name.isEmpty
                                ? widget.record.code
                                : widget.record.name.toUpperCase(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: T.cardTitle.copyWith(fontSize: 15, letterSpacing: 1.2),
                          ),
                          const SizedBox(height: 4),
                          Text(widget.record.code, style: T.nfcId(20)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: S.x20),
                  Surface(
                    shadow: E.e1,
                    child: Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Karta maketi (ism va logotip joylashuvi) buyurtmadan '
                            'keyin siz bilan kelishiladi.',
                            style: T.caption,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: S.x20),
                  Row(
                    children: [
                      const Eyebrow('Soni'),
                      const Spacer(),
                      _Stepper(value: _qty, onChange: (v) => setState(() => _qty = v)),
                    ],
                  ),
                  const SizedBox(height: S.x20),
                  Field(label: 'Ism', controller: _name, hint: 'Kartada yoziladigan ism'),
                  const SizedBox(height: S.x16),
                  Field(
                    label: 'Telefon',
                    controller: _phone,
                    hint: '+998 90 123 45 67',
                    keyboardType: TextInputType.phone,
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]'))],
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: 'Manzil · ixtiyoriy',
                    controller: _address,
                    maxLines: 2,
                    hint: 'Yetkazish manzili',
                    helper: 'Yetkazish $_minDays–$_maxDays kun',
                    error: _error,
                  ),
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
                  Row(
                    children: [
                      const Text('Karta narxi', style: T.caption),
                      const Spacer(),
                      if (_loading)
                        const Spinner(size: 13)
                      else
                        Text(
                          total == null ? '—' : '${som(total)} so‘m',
                          style: T.price.copyWith(fontSize: 16),
                        ),
                    ],
                  ),
                  const SizedBox(height: S.x12),
                  PrimaryButton(
                    'Buyurtma berish',
                    loading: _busy,
                    onTap: _busy || _loading ? null : _submit,
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

class _Stepper extends StatelessWidget {
  const _Stepper({required this.value, required this.onChange});
  final int value;
  final ValueChanged<int> onChange;

  /// Yuqori chegara backenddagi bilan bir xil (`PHYSICAL_CARD_MAX_QTY`).
  static const max = 50;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          _btn(Ico.minus, () => onChange(value > 1 ? value - 1 : 1)),
          SizedBox(
            width: 36,
            child: Text('$value', textAlign: TextAlign.center, style: T.cardTitle),
          ),
          _btn(Ico.plus, () => onChange(value < max ? value + 1 : max)),
        ],
      );

  Widget _btn(Ico icon, VoidCallback onTap) => Press(
        onTap: onTap,
        child: Container(
          width: 32, height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(9),
            border: Border.all(color: C.hairline),
          ),
          child: NIcon(icon, size: 16, color: C.champagne),
        ),
      );
}
