import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/logo.dart';
import '../../design/components/press.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_lock.dart';

/// QULF EKRANI — PIN va barmoq izi / yuz.
///
/// Klaviatura ilovaning O'ZIDA chiziladi, tizimniki emas: raqamli
/// qulf ekranida katta, aniq tugmalar kerak va bu telefon qulfi bilan
/// bir xil odatni takrorlaydi.
///
/// YORUG'LIK MARKAZDAN: ekranda bitta ish bor va u o'rtada turadi.
class LockScreen extends StatefulWidget {
  const LockScreen({super.key, required this.lock, this.onUnlocked});

  final AppLock lock;
  final VoidCallback? onUnlocked;

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  String _pin = '';
  bool _error = false;
  bool _busy = false;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    // Barmoq izi yoqilgan bo'lsa — ekran ochilishi bilan so'raymiz,
    // odam PIN terishga majbur bo'lmasin.
    WidgetsBinding.instance.addPostFrameCallback((_) => _biometric());
    // Kutish vaqti sanog'i.
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && widget.lock.lockoutLeft > 0) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _biometric() async {
    if (!widget.lock.biometricEnabled || _busy) return;
    setState(() => _busy = true);
    final ok = await widget.lock.unlockWithBiometric();
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) widget.onUnlocked?.call();
  }

  Future<void> _add(String d) async {
    if (widget.lock.lockoutLeft > 0 || _pin.length >= AppLock.pinLength) return;
    HapticFeedback.selectionClick();
    setState(() {
      _pin += d;
      _error = false;
    });
    if (_pin.length < AppLock.pinLength) return;

    final ok = await widget.lock.verifyPin(_pin);
    if (!mounted) return;
    if (ok) {
      widget.onUnlocked?.call();
    } else {
      HapticFeedback.heavyImpact();
      setState(() {
        _error = true;
        _pin = '';
      });
    }
  }

  void _back() {
    if (_pin.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() {
      _pin = _pin.substring(0, _pin.length - 1);
      _error = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final wait = widget.lock.lockoutLeft;
    final left = widget.lock.attemptsLeft;

    return ScreenBackdrop(
      aura: Aura.center,
      child: SafeArea(
        child: Column(
          children: [
            const Spacer(),
            const BrandMark(size: 72, glow: true),
            const SizedBox(height: S.x24),
            Text(
              wait > 0 ? tr('Biroz kuting') : tr('PIN kodni kiriting'),
              textAlign: TextAlign.center,
              style: T.titleSm,
            ),
            const SizedBox(height: S.x12),

            // HOLAT — matn VA raqam. Faqat rang bilan bildirilmaydi.
            if (wait > 0) ...[
              Text(
                tr('Qayta urinib ko‘rishdan oldin kuting'),
                textAlign: TextAlign.center,
                style: T.caption.copyWith(color: C.warn),
              ),
              const SizedBox(height: 6),
              Text('$wait', style: T.statValue.copyWith(color: C.warn)),
            ] else if (_error) ...[
              Text(
                tr('Kod xato. Qaytadan kiriting.'),
                textAlign: TextAlign.center,
                style: T.caption.copyWith(color: C.fail),
              ),
              const SizedBox(height: 6),
              Text(
                '${tr('Qolgan urinish')}  $left / ${AppLock.maxAttempts}',
                style: T.meta.copyWith(color: C.fail),
              ),
            ] else
              Text(
                tr('NFCSTORE ni ochish uchun'),
                textAlign: TextAlign.center,
                style: T.caption.copyWith(color: C.ink3),
              ),

            const SizedBox(height: S.x32),
            PinDots(filled: _pin.length, error: _error),
            const Spacer(),
            Opacity(
              opacity: wait > 0 ? .35 : 1,
              child: PinPad(
                onDigit: _add,
                onBack: _back,
                onBiometric: widget.lock.biometricEnabled ? _biometric : null,
                busy: _busy,
              ),
            ),
            const SizedBox(height: S.x24),
          ],
        ),
      ),
    );
  }
}

/// PIN NUQTALARI — to'lgani oltin, bo'shi qirra bilan.
class PinDots extends StatelessWidget {
  const PinDots({
    super.key,
    required this.filled,
    this.length = AppLock.pinLength,
    this.error = false,
  });

  final int filled;
  final int length;
  final bool error;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < length; i++)
            AnimatedContainer(
              duration: M.press,
              curve: M.curve,
              margin: const EdgeInsets.symmetric(horizontal: 9),
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                gradient: i < filled && !error ? C.actionFace : null,
                color: i < filled && error ? C.fail : null,
                shape: BoxShape.circle,
                border: Border.all(
                  color: error
                      ? C.fail
                      : i < filled
                          ? C.accent
                          : C.lineStrong,
                  width: 1.6,
                ),
              ),
            ),
        ],
      );
}

/// RAQAMLI KLAVIATURA — 3×4.
///
/// Har tugma alohida yuza: qorong'i ekranda "bosiladigan joy"
/// ko'rinib turishi kerak. Pastki chapda barmoq izi (faqat
/// yoqilgan bo'lsa), pastki o'ngda o'chirish.
class PinPad extends StatelessWidget {
  const PinPad({
    super.key,
    required this.onDigit,
    required this.onBack,
    this.onBiometric,
    this.busy = false,
  });

  final ValueChanged<String> onDigit;
  final VoidCallback onBack;
  final VoidCallback? onBiometric;
  final bool busy;

  static const List<List<String>> _rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.x32),
        child: Column(
          children: [
            for (final row in _rows) ...[
              Row(
                children: [
                  for (final d in row)
                    Expanded(
                      child: _Key(
                        onTap: () => onDigit(d),
                        child: Text(d, style: T.statValue),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: S.x8),
            ],
            Row(
              children: [
                Expanded(
                  child: onBiometric == null
                      ? const SizedBox(height: 52)
                      : _Key(
                          onTap: busy ? null : onBiometric,
                          child: busy
                              ? const Spinner(size: 20)
                              : NIcon(
                                  Ico.fingerprint,
                                  size: 23,
                                  color: C.accent,
                                ),
                        ),
                ),
                Expanded(
                  child: _Key(
                    onTap: () => onDigit('0'),
                    child: Text('0', style: T.statValue),
                  ),
                ),
                Expanded(
                  child: _Key(
                    onTap: onBack,
                    child: NIcon(Ico.backspace, size: 21, color: C.ink2),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
}

/// Bitta tugma — eng kichigi 64×52 dp.
class _Key extends StatelessWidget {
  const _Key({required this.child, required this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .94,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 5),
          child: Container(
            constraints: const BoxConstraints(minWidth: 64, minHeight: 52),
            height: 56,
            decoration: BoxDecoration(
              gradient: C.raisedSurface,
              borderRadius: BorderRadius.circular(R.tile),
              border: Border.all(color: C.line),
              boxShadow: C.e1,
            ),
            alignment: Alignment.center,
            child: child,
          ),
        ),
      );
}
