import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import '../../design/feedback.dart';

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
    _phone.text = (card?.phone.isNotEmpty ?? false) ? card!.phone : (state.user?.phone ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _note.dispose();
    super.dispose();
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
      await AppScope.read(context).repo.placeCompanyOrder(
            widget.companyId,
            name: _name.text.trim(),
            phone: _phone.text.trim(),
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
    final total = widget.product.effectivePrice * _qty;

    if (_done) {
      return Scaffold(
        backgroundColor: C.obsidian,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                const Text('Buyurtma\nyuborildi', style: T.display),
                const SizedBox(height: S.x12),
                Text(
                  '${widget.companyName.isEmpty ? 'Sotuvchi' : widget.companyName} '
                  'siz bilan bog‘lanadi. Buyurtma holatini shu yerdan kuzatasiz.',
                  style: T.body,
                ),
                const Spacer(),
                PrimaryButton('Tayyor', onTap: () => Navigator.of(context).pop()),
                const SizedBox(height: S.x32),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(title: 'Buyurtma'),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x24),
                children: [
                  Surface(
                    padding: const EdgeInsets.all(S.x12),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 54, height: 54,
                          child: NetImage(widget.product.imageUrl, radius: R.tile, cacheWidth: 120),
                        ),
                        const SizedBox(width: S.x12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(widget.product.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: T.cardTitle.copyWith(fontSize: 13)),
                              const SizedBox(height: 3),
                              Text(widget.companyName, style: T.caption.copyWith(fontSize: 11)),
                            ],
                          ),
                        ),
                        _QtyStepper(
                          value: _qty,
                          onChange: (v) => setState(() => _qty = v),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: S.x20),
                  Field(label: 'Ism', controller: _name, hint: 'Ismingiz'),
                  const SizedBox(height: S.x16),
                  Field(
                    label: 'Telefon', controller: _phone, hint: '+998 90 123 45 67',
                    keyboardType: TextInputType.phone,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s]')),
                    ],
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: 'Izoh · ixtiyoriy',
                    controller: _note,
                    hint: 'Yetkazish manzili yoki qo‘shimcha so‘rov',
                    maxLines: 3,
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
                      const Text('Jami', style: T.caption),
                      const Spacer(),
                      Text('${som(total)} so‘m', style: T.price.copyWith(fontSize: 16)),
                    ],
                  ),
                  const SizedBox(height: S.x12),
                  PrimaryButton('Buyurtmani yuborish', loading: _busy, onTap: _busy ? null : _submit),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QtyStepper extends StatelessWidget {
  const _QtyStepper({required this.value, required this.onChange});
  final int value;
  final ValueChanged<int> onChange;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          _btn(Ico.minus, () => onChange(value > 1 ? value - 1 : 1)),
          SizedBox(
            width: 30,
            child: Text('$value', textAlign: TextAlign.center, style: T.cardTitle),
          ),
          _btn(Ico.plus, () => onChange(value < 999 ? value + 1 : 999)),
        ],
      );

  Widget _btn(Ico icon, VoidCallback onTap) => Press(
        onTap: onTap,
        child: Container(
          width: 30, height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: C.hairline),
          ),
          child: NIcon(icon, size: 15, color: C.champagne),
        ),
      );
}
