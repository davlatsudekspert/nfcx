import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../design/components/backdrop.dart';
import '../../design/components/logo.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_lock.dart';
import 'lock_screen.dart';

/// PIN O'RNATISH — ikki qadam: kiriting, keyin tasdiqlang.
///
/// Tasdiqlash QADAMI SHART: bitta marta terilgan kodda xato bo'lsa,
/// odam o'z ilovasidan chiqib qolardi va uni faqat qayta o'rnatish
/// bilan ochish mumkin bo'lardi.
///
/// Klaviatura va nuqtalar QULF EKRANIDAGI bilan bir xil
/// (`PinPad`, `PinDots`): kod o'rnatish va kod kiritish bir xil
/// harakat bo'lishi kerak.
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
    successHaptic();
    if (mounted) Navigator.of(context).pop(true);
  }

  void _back() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.center,
        child: SafeArea(
          child: Column(
            children: [
              const TopBar(),
              const Spacer(),
              const BrandMark(size: 72, glow: true),
              const SizedBox(height: S.x24),
              Text(
                _confirming
                    ? tr('Kodni takrorlang')
                    : tr('Yangi PIN kod o‘ylab toping'),
                textAlign: TextAlign.center,
                style: T.titleSm,
              ),
              const SizedBox(height: S.x12),
              if (_error)
                Text(
                  tr('Kodlar mos kelmadi. Qaytadan boshlang.'),
                  textAlign: TextAlign.center,
                  style: T.caption.copyWith(color: C.fail),
                )
              else if (_confirming)
                Text(
                  tr('Xato bo‘lmasligi uchun yana bir marta'),
                  textAlign: TextAlign.center,
                  style: T.caption.copyWith(color: C.ink3),
                )
              else
                Text(
                  '${AppLock.pinLength} ${tr('xonali kod')}',
                  textAlign: TextAlign.center,
                  style: T.caption.copyWith(color: C.ink3),
                ),
              const SizedBox(height: S.x32),
              PinDots(filled: _pin.length, error: _error),
              const Spacer(),
              PinPad(onDigit: _add, onBack: _back),
              const SizedBox(height: S.x24),
            ],
          ),
        ),
      );
}
