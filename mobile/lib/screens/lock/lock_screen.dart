import 'dart:async';
import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/press.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_lock.dart';

/// QULF EKRANI — PIN va barmoq izi / yuz.
///
/// Klaviatura ilovaning O'ZIDA chiziladi, tizimniki emas: raqamli
/// qulf ekranida katta, aniq tugmalar kerak va bu telefon qulfi bilan
/// bir xil odatni takrorlaydi.
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
    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(),
            const Image(image: AssetImage('assets/img/logo.png'), width: 54, height: 54),
            const SizedBox(height: S.x20),
            Text(wait > 0 ? 'Biroz kuting' : 'Kodni kiriting', style: T.displaySm),
            const SizedBox(height: S.x8),
            Text(
              wait > 0
                  ? '$wait soniyadan so‘ng qayta urinib ko‘ring'
                  : _error
                      ? 'Kod xato. Qaytadan kiriting.'
                      : 'NFCSTORE ni ochish uchun',
              style: T.caption.copyWith(color: _error && wait == 0 ? C.signal : C.ash),
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
                      color: i < _pin.length
                          ? (_error ? C.signal : C.champagne)
                          : const Color(0x00000000),
                      border: Border.all(
                        color: _error ? C.signal : (i < _pin.length ? C.champagne : C.hairline),
                        width: 1.6,
                      ),
                    ),
                  ),
              ],
            ),
            const Spacer(),
            Opacity(
              opacity: wait > 0 ? .35 : 1,
              child: _Keypad(
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

class _Keypad extends StatelessWidget {
  const _Keypad({
    required this.onDigit,
    required this.onBack,
    required this.onBiometric,
    required this.busy,
  });

  final ValueChanged<String> onDigit;
  final VoidCallback onBack;
  final VoidCallback? onBiometric;
  final bool busy;

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
              Expanded(
                child: onBiometric == null
                    ? const SizedBox(height: 66)
                    : key(
                        busy
                            ? const Spinner(size: 22)
                            : const NIcon(Ico.user, size: 25, color: C.champagne),
                        busy ? null : onBiometric,
                      ),
              ),
              Expanded(child: digit('0')),
              Expanded(child: key(const NIcon(Ico.close, size: 22, color: C.ash), onBack)),
            ],
          ),
        ],
      ),
    );
  }
}
