import 'package:flutter/services.dart'
    show FilteringTextInputFormatter, TextInputAction, TextInputType;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/media.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

/// Katalogdan buyurtma.
///
/// NARX SERVERDA hisoblanadi: bu ekran faqat ko'rsatadi. Mijoz
/// yuborgan summa e'tiborga olinmaydi (backend katalogdan oladi) —
/// shuning uchun bu yerda narxni "tahrirlash" imkoniyati yo'q.
class OrderFlowScreen extends StatefulWidget {
  const OrderFlowScreen({
    super.key,
    required this.product,
    required this.companyId,
    this.companyName = '',
  });

  final Product product;
  final String companyId;
  final String companyName;

  @override
  State<OrderFlowScreen> createState() => _OrderFlowScreenState();
}

class _OrderFlowScreenState extends State<OrderFlowScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _note = TextEditingController();
  int _qty = 1;
  bool _busy = false;
  String? _error;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    // Ism va telefon hisobdan oldindan to'ldiriladi — odam uchinchi
    // marta o'z raqamini yozmasin.
    final state = AppScope.read(context);
    final card = state.active?.record;
    _name.text = card?.name ?? '';
    _phone.text = _local(
      (card?.phone.isNotEmpty ?? false) ? card!.phone : (state.user?.phone ?? ''),
    );
  }

  /// MAYDONDA FAQAT MAHALLIY QISM turadi — `+998` maydonning o'zida
  /// doimiy yozuv bo'lib qoladi (dizayn talabi). Serverga esa
  /// raqam butun holda, kod bilan birga yuboriladi.
  static String _local(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    return digits.startsWith('998') ? digits.substring(3) : digits;
  }

  /// Serverga ketadigan to'liq raqam.
  String get _phoneValue => '+998${_phone.text.replaceAll(RegExp(r'\D'), '')}';

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty ||
        _phone.text.replaceAll(RegExp(r'\D'), '').length < 7) {
      setState(() => _error = tr('Ism va telefon raqamini to‘liq kiriting.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repo.placeCompanyOrder(
            widget.companyId,
            name: _name.text.trim(),
            phone: _phoneValue,
            itemId: widget.product.id,
            qty: _qty,
            note: _note.text.trim(),
          );
      if (mounted) {
        setState(() => _done = true);
        successHaptic();
      }
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // KO'RSATISH UCHUN: haqiqiy summani server katalogdan hisoblaydi.
    final total = widget.product.effectivePrice * _qty;

    if (_done) return _Done(companyName: widget.companyName);

    return ScreenBackdrop(
      aura: Aura.none,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, 0),
                children: [
                  ScreenTitle(
                    tr('Buyurtma'),
                    subtitle: tr('Ism va telefon qoldiring — sotuvchi o‘zi '
                        'bog‘lanadi.'),
                  ),
                  _ProductCard(
                    product: widget.product,
                    companyName: widget.companyName,
                  ),
                  const SizedBox(height: S.x24),
                  Field(
                    label: tr('Ism'),
                    controller: _name,
                    hint: tr('Ismingiz'),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: tr('Telefon'),
                    controller: _phone,
                    hint: '90 123 45 67',
                    prefix: '+998',
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9\s]')),
                    ],
                    error: _error,
                  ),
                  const SizedBox(height: S.x16),
                  _QtyField(
                    value: _qty,
                    onChange: (v) => setState(() => _qty = v),
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: tr('Izoh · ixtiyoriy'),
                    controller: _note,
                    hint: tr('Yetkazish manzili yoki qo‘shimcha so‘rov'),
                    helper: tr('Manzil, vaqt yoki o‘lcham — sotuvchi shuni '
                        'o‘qiydi.'),
                    maxLines: 3,
                    maxLength: 200,
                    counter: true,
                  ),
                  SizedBox(height: StickyBar.inset(context)),
                ],
              ),
            ),
            // Klaviatura ochilganda panel uning USTIGA chiqadi:
            // ilovada `Scaffold` yo'q, ya'ni bu o'z-o'zidan bo'lmaydi.
            Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: StickyBar(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Eyebrow(tr('Jami')),
                          const SizedBox(height: 4),
                          Text('${som(total)} so‘m', style: T.amount),
                        ],
                      ),
                    ),
                    const SizedBox(width: S.x16),
                    PrimaryButton(
                      tr('Buyurtma berish'),
                      expand: false,
                      loading: _busy,
                      onTap: _busy ? null : _submit,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Nima buyurtma qilinayotgani — rasm, nom, narx.
class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.companyName});

  final Product product;
  final String companyName;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x8),
        glow: product.discountPct != null,
        child: Row(
          children: [
            SizedBox(
              width: 80,
              height: 80,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  NetImage(
                    product.imageUrl,
                    radius: R.tile,
                    cacheWidth: 160,
                    slotIcon: Ico.bag,
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0x00000000), Color(0x85000000)],
                      ),
                      borderRadius: BorderRadius.all(Radius.circular(R.tile)),
                    ),
                  ),
                  Positioned(
                    right: 6,
                    bottom: 6,
                    child: NIcon(Ico.bag, size: 14, color: C.onMediaAccent),
                  ),
                ],
              ),
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Eyebrow(tr('Buyurtma tarkibi')),
                  const SizedBox(height: 5),
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: T.cardTitle,
                  ),
                  if (companyName.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(companyName, style: T.caption),
                  ],
                  const SizedBox(height: 6),
                  Text('${som(product.effectivePrice)} so‘m', style: T.amount),
                ],
              ),
            ),
          ],
        ),
      );
}

/// MIQDOR — o'z maydoni, boshqa maydonlar bilan bir tekisda.
///
/// Klaviatura ochilmaydi: bittalab o'zgaradigan son uchun raqam
/// terish ortiqcha ish.
class _QtyField extends StatelessWidget {
  const _QtyField({required this.value, required this.onChange});

  final int value;
  final ValueChanged<int> onChange;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr('Miqdor').toUpperCase(), style: T.label),
          const SizedBox(height: 7),
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: S.x8),
            decoration: BoxDecoration(
              gradient: C.raisedSurface,
              borderRadius: BorderRadius.circular(R.input),
              border: Border.all(color: C.line),
            ),
            child: Row(
              children: [
                RoundButton(
                  Ico.minus,
                  size: 40,
                  iconSize: 16,
                  // Eng kami — bitta. Nolinchi buyurtma ma'nosiz.
                  onTap: value > 1 ? () => onChange(value - 1) : null,
                  color: value > 1 ? null : C.ink3,
                ),
                Expanded(
                  child: Text(
                    '$value',
                    textAlign: TextAlign.center,
                    style: T.statValue,
                  ),
                ),
                RoundButton(
                  Ico.plus,
                  size: 40,
                  iconSize: 16,
                  onTap: value < 999 ? () => onChange(value + 1) : null,
                  color: value < 999 ? null : C.ink3,
                ),
              ],
            ),
          ),
        ],
      );
}

/// YUBORILDI — buyurtma serverga tushdi.
class _Done extends StatelessWidget {
  const _Done({required this.companyName});

  final String companyName;

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.center,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                Text(tr('Buyurtma\nyuborildi'), style: T.display),
                const SizedBox(height: S.x12),
                const AccentRule(),
                const SizedBox(height: S.x16),
                Text(
                  trf(
                    '{sotuvchi} siz bilan bog‘lanadi. Buyurtma holatini shu '
                    'yerdan kuzatasiz.',
                    {
                      'sotuvchi':
                          companyName.isEmpty ? tr('Sotuvchi') : companyName,
                    },
                  ),
                  style: T.body,
                ),
                const Spacer(),
                PrimaryButton(
                  tr('Tayyor'),
                  onTap: () => Navigator.of(context).pop(),
                ),
                const SizedBox(height: S.x32),
              ],
            ),
          ),
        ),
      );
}
