import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import '../../design/components/icons.dart';
import '../../design/components/press.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_lock.dart';
import '../common/top_bar.dart';

/// PIN O'RNATISH — ikki qadam: kiriting, keyin tasdiqlang.
///
/// Tasdiqlash QADAMI SHART: bitta marta terilgan kodda xato bo'lsa,
/// odam o'z ilovasidan chiqib qolardi va uni faqat qayta o'rnatish
/// bilan ochish mumkin bo'lardi.
class SetPinScreen extends StatefulWidget {
  const SetPinScreen({super.key, required this.lock});
  final AppLock lock;

  @override
  State<SetPinScreen> createState() => _SetPinScreenState();
}

class _SetPinScreenState extends State<SetPinScreen> {
  String _first = '';
  String _pin = '';
  bool _error = false;

  bool get _confirming => _first.isNotEmpty;

  Future<void> _add(String d) async {
    if (_pin.length >= AppLock.pinLength) return;
    HapticFeedback.selectionClick();
    setState(() {
      _pin += d;
      _error = false;
    });
    if (_pin.length < AppLock.pinLength) return;

    if (!_confirming) {
      // Birinchi qadam tugadi — tasdiqlashga o'tamiz.
      setState(() {
        _first = _pin;
        _pin = '';
      });
      return;
    }
    if (_pin != _first) {
      HapticFeedback.heavyImpact();
      setState(() {
        _error = true;
        _pin = '';
        _first = '';
      });
      return;
    }
    await widget.lock.setPin(_pin);
    if (mounted) Navigator.of(context).pop(true);
  }

  void _back() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: C.obsidian,
        body: SafeArea(
          child: Column(
            children: [
              const TopBar(title: 'PIN kod'),
              const Spacer(),
              Text(_confirming ? 'Kodni takrorlang' : 'Yangi kod', style: T.displaySm),
              const SizedBox(height: S.x8),
              Text(
                _error
                    ? 'Kodlar mos kelmadi. Qaytadan boshlang.'
                    : _confirming
                        ? 'Xato bo‘lmasligi uchun yana bir marta'
                        : '${AppLock.pinLength} xonali kod o‘ylab toping',
                style: T.caption.copyWith(color: _error ? C.signal : C.ash),
              ),
              const SizedBox(height: S.x32),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < AppLock.pinLength; i++)
                    AnimatedContainer(
                      duration: M.press,
                      margin: const EdgeInsets.symmetric(horizontal: 9),
                      width: 13,
                      height: 13,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i < _pin.length ? C.champagne : const Color(0x00000000),
                        border: Border.all(
                          color: i < _pin.length ? C.champagne : C.hairline,
                          width: 1.6,
                        ),
                      ),
                    ),
                ],
              ),
              const Spacer(),
              _Pad(onDigit: _add, onBack: _back),
              const SizedBox(height: S.x24),
            ],
          ),
        ),
      );
}

class _Pad extends StatelessWidget {
  const _Pad({required this.onDigit, required this.onBack});
  final ValueChanged<String> onDigit;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    Widget key(Widget child, VoidCallback? onTap) => Press(
          onTap: onTap,
          scale: .9,
          child: Container(height: 66, alignment: Alignment.center, child: child),
        );
    Widget digit(String d) => key(
          Text(
            d,
            style: T.displaySm.copyWith(fontFamily: 'Manrope', fontWeight: FontWeight.w500),
          ),
          () => onDigit(d),
        );
    const rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 44),
      child: Column(
        children: [
          for (final row in rows)
            Row(children: [for (final d in row) Expanded(child: digit(d))]),
          Row(
            children: [
              const Expanded(child: SizedBox(height: 66)),
              Expanded(child: digit('0')),
              Expanded(
                child: key(
                  const NIcon(Ico.backspace, size: 22, color: C.ash),
                  onBack,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
