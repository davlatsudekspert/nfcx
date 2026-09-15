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
import 'pattern_pad.dart';

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
  const SetPinScreen({super.key, required this.lock, this.pattern = false});
  final AppLock lock;

  /// GRAFIK KALIT REJIMI. Bir xil ekran ATAYLAB: ikki qadam
  /// (kiriting → takrorlang), bir xil xato matni va bir xil
  /// tugash. Ikki alohida ekran yasalsa, biridagi tuzatish
  /// ikkinchisida unutilib qolardi.
  final bool pattern;

  @override
  State<SetPinScreen> createState() => _SetPinScreenState();
}

class _SetPinScreenState extends State<SetPinScreen> {
  String _first = '';
  String _pin = '';
  bool _error = false;
  String? _hint;

  bool get _confirming => _first.isNotEmpty;

  /// GRAFIK KALIT chizib bo'lingach.
  Future<void> _drawn(String dots) async {
    if (dots.length < AppLock.patternMinDots) {
      HapticFeedback.heavyImpact();
      setState(() {
        _error = true;
        _hint = trf('Kamida {n} ta nuqta ulansin.',
            {'n': '${AppLock.patternMinDots}'});
        _first = '';
      });
      return;
    }
    if (!_confirming) {
      setState(() {
        _first = dots;
        _error = false;
        _hint = null;
      });
      return;
    }
    if (dots != _first) {
      HapticFeedback.heavyImpact();
      setState(() {
        _error = true;
        _hint = null;
        _first = '';
      });
      return;
    }
    await widget.lock.setPattern(dots);
    successHaptic();
    if (mounted) Navigator.of(context).pop(true);
  }

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
                    ? (widget.pattern
                        ? tr('Naqshni takrorlang')
                        : tr('Kodni takrorlang'))
                    : (widget.pattern
                        ? tr('Yangi grafik kalit chizing')
                        : tr('Yangi PIN kod o‘ylab toping')),
                textAlign: TextAlign.center,
                style: T.titleSm,
              ),
              const SizedBox(height: S.x12),
              if (_hint != null)
                Text(
                  _hint!,
                  textAlign: TextAlign.center,
                  style: T.caption.copyWith(color: C.fail),
                )
              else if (_error)
                Text(
                  widget.pattern
                      ? tr('Naqshlar mos kelmadi. Qaytadan boshlang.')
                      : tr('Kodlar mos kelmadi. Qaytadan boshlang.'),
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
                  widget.pattern
                      ? trf('Kamida {n} ta nuqta',
                          {'n': '${AppLock.patternMinDots}'})
                      : '${AppLock.pinLength} ${tr('xonali kod')}',
                  textAlign: TextAlign.center,
                  style: T.caption.copyWith(color: C.ink3),
                ),
              const SizedBox(height: S.x32),
              if (widget.pattern) ...[
                const Spacer(),
                Center(child: PatternPad(onDone: _drawn, error: _error)),
                const Spacer(),
              ] else ...[
                PinDots(filled: _pin.length, error: _error),
                const Spacer(),
                PinPad(onDigit: _add, onBack: _back),
              ],
              const SizedBox(height: S.x24),
            ],
          ),
        ),
      );
}
