import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

import '../../app/providers.dart';
import '../../core/storage/secure_store.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';

/// Lokal ilova qulfi.
///
/// ## Bu AKKAUNT PAROLI EMAS
///
/// Server bu haqda umuman bilmaydi. Qulf faqat SHU qurilmada, shu
/// o'rnatilgan ilovani ochishni to'sadi: telefon boshqa birovning
/// qo'liga tushsa, NFC ID'lar va yozishmalar darhol ochilib
/// qolmasligi uchun. Parolni tiklash ham serverdan emas — qulfni
/// Sozlamalardan o'chirish orqali.
///
/// ## Qarorlar
///
/// * Standart holat — O'CHIQ. Hech kimga majburlanmaydi.
/// * PIN `flutter_secure_storage` da (Keystore/Keychain), oddiy
///   `SharedPreferences` da EMAS: u oddiy fayl va root olingan
///   qurilmada o'qiladi.
/// * Biometrika — QULAYLIK, ishonch emas. Qurilmada yo'q bo'lsa
///   yoki muvaffaqiyatsiz bo'lsa, PIN har doim ishlaydi.
/// * Ilova fonga ketganda darhol emas, [_graceDelay] dan keyin
///   qulflanadi: kamera yoki fayl tanlash oynasi ham ilovani fonga
///   chiqaradi va har safar PIN so'ralsa, ishlatib bo'lmasdi.

/// Fonga ketgandan keyin qulf yoqiladigan vaqt.
const _graceDelay = Duration(seconds: 25);

/// PIN uzunligi — qat'iy, shuning uchun "tasdiqlash" tugmasi kerak emas.
const kPinLength = 4;

class AppLockState {
  const AppLockState({
    required this.enabled,
    required this.biometric,
    required this.locked,
  });

  /// Qulf yoqilganmi.
  final bool enabled;

  /// Biometrika bilan ochishga ruxsat berilganmi.
  final bool biometric;

  /// Ayni damda ekran qulflanganmi.
  final bool locked;

  AppLockState copyWith({bool? enabled, bool? biometric, bool? locked}) =>
      AppLockState(
        enabled: enabled ?? this.enabled,
        biometric: biometric ?? this.biometric,
        locked: locked ?? this.locked,
      );
}

class AppLock extends StateNotifier<AppLockState> with WidgetsBindingObserver {
  AppLock(this._prefs, this._store)
      : super(AppLockState(
          enabled: _prefs.appLock,
          biometric: _prefs.appLockBiometric,
          // Yoqilgan bo'lsa ilova QULFLANGAN holda ochiladi.
          locked: _prefs.appLock,
        )) {
    WidgetsBinding.instance.addObserver(this);
  }

  final Prefs _prefs;
  final SecureStore _store;

  DateTime? _leftAt;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!this.state.enabled) return;
    if (state == AppLifecycleState.resumed) {
      final left = _leftAt;
      _leftAt = null;
      // Qisqa chiqib kelish (kamera, galereya, ulashish) qulflamaydi.
      if (left != null && DateTime.now().difference(left) >= _graceDelay) {
        this.state = this.state.copyWith(locked: true);
      }
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      _leftAt ??= DateTime.now();
    }
  }

  /// PIN o'rnatish va qulfni yoqish.
  Future<void> enable(String pin) async {
    await _store.writePin(pin);
    await _prefs.setAppLock(true);
    state = state.copyWith(enabled: true, locked: false);
  }

  /// Qulfni o'chirish — PIN ham o'chiriladi.
  Future<void> disable() async {
    await _store.deletePin();
    await _prefs.setAppLock(false);
    state = state.copyWith(enabled: false, locked: false);
  }

  Future<void> setBiometric(bool v) async {
    await _prefs.setAppLockBiometric(v);
    state = state.copyWith(biometric: v);
  }

  Future<bool> verify(String pin) async {
    final saved = await _store.readPin();
    if (saved == null || saved != pin) return false;
    state = state.copyWith(locked: false);
    return true;
  }

  void unlock() => state = state.copyWith(locked: false);

  /// Faqat sinov uchun: qulfni majburan yoqish.
  void lockNow() {
    if (state.enabled) state = state.copyWith(locked: true);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}

final appLockProvider = StateNotifierProvider<AppLock, AppLockState>(
  (ref) => AppLock(ref.watch(prefsProvider), ref.watch(secureStoreProvider)),
);

/// Qurilmada biometrika bormi.
final biometricAvailableProvider = FutureProvider<bool>((ref) async {
  try {
    final auth = LocalAuthentication();
    return await auth.canCheckBiometrics || await auth.isDeviceSupported();
  } on PlatformException {
    return false;
  } on MissingPluginException {
    // Sinov muhitida plagin yo'q — biometrika "yo'q" deb qaraladi.
    return false;
  }
});

/// Qulf ekrani.
///
/// Ilovaning ustiga chiziladi, marshrutni ALMASHTIRMAYDI: qulf
/// ochilganda foydalanuvchi qayerda edi — o'sha yerda qoladi.
class AppLockGate extends ConsumerWidget {
  const AppLockGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locked = ref.watch(appLockProvider).locked;
    return Stack(
      children: [
        child,
        if (locked)
          const Positioned.fill(
            child: _LockScreen(),
          ),
      ],
    );
  }
}

class _LockScreen extends ConsumerStatefulWidget {
  const _LockScreen();

  @override
  ConsumerState<_LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<_LockScreen> {
  String _pin = '';
  bool _wrong = false;
  bool _triedBiometric = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryBiometric());
  }

  Future<void> _tryBiometric() async {
    if (_triedBiometric) return;
    _triedBiometric = true;
    if (!ref.read(appLockProvider).biometric) return;
    final l = L.of(context);
    try {
      final ok = await LocalAuthentication().authenticate(
        localizedReason: l.lockBiometricReason,
        // Tizim PIN/parolini so'ramaymiz — bizda o'z PIN'imiz bor.
        biometricOnly: true,
      );
      if (ok && mounted) ref.read(appLockProvider.notifier).unlock();
    } on PlatformException {
      // Biometrika yo'q, o'chirilgan yoki bloklangan — PIN qoladi.
    } on MissingPluginException {
      // Sinov muhiti.
    }
  }

  Future<void> _push(String d) async {
    if (_pin.length >= kPinLength) return;
    setState(() {
      _pin += d;
      _wrong = false;
    });
    if (_pin.length == kPinLength) {
      final ok = await ref.read(appLockProvider.notifier).verify(_pin);
      if (!ok && mounted) {
        setState(() {
          _wrong = true;
          _pin = '';
        });
      }
    }
  }

  void _back() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final bio = ref.watch(appLockProvider).biometric;

    return ColoredBox(
      color: t.bg1,
      child: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const BrandLogo(size: 64, style: BrandLogoStyle.badge),
            const SizedBox(height: Gap.xl),
            Text(l.lockTitle, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: Gap.sm),
            Text(
              _wrong ? l.lockWrong : l.lockHint,
              style: Theme.of(context).textTheme.bodySmall!.copyWith(
                    color: _wrong ? t.error : t.text3,
                  ),
            ),
            const SizedBox(height: Gap.section),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < kPinLength; i++)
                  Container(
                    width: 13,
                    height: 13,
                    margin: const EdgeInsets.symmetric(horizontal: Gap.sm),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i < _pin.length ? t.accent2 : Colors.transparent,
                      border: Border.all(
                        color: i < _pin.length ? t.accent2 : t.border2,
                        width: 1.4,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: Gap.section),
            _Keypad(
              onDigit: _push,
              onBack: _back,
              onBiometric: bio ? () {
                _triedBiometric = false;
                _tryBiometric();
              } : null,
            ),
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
    this.onBiometric,
  });

  final ValueChanged<String> onDigit;
  final VoidCallback onBack;
  final VoidCallback? onBiometric;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    Widget key(Widget child, VoidCallback? onTap) => PressableScale(
          onTap: onTap,
          child: Container(
            width: 72,
            height: 72,
            margin: const EdgeInsets.all(Gap.sm),
            decoration: BoxDecoration(
              color: t.surface2,
              shape: BoxShape.circle,
              border: Border.all(color: t.border2),
            ),
            alignment: Alignment.center,
            child: child,
          ),
        );

    Widget digit(String d) => key(
          Text(d, style: AppType.displayStyle(color: t.text1, size: 25)),
          () => onDigit(d),
        );

    return Column(
      children: [
        for (final row in const [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ])
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [for (final d in row) digit(d)],
          ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            onBiometric == null
                ? key(const SizedBox.shrink(), null)
                : key(
                    Icon(Icons.fingerprint_rounded, size: 27, color: t.accent2),
                    onBiometric,
                  ),
            digit('0'),
            key(
              Icon(Icons.backspace_outlined, size: 21, color: t.text2),
              onBack,
            ),
          ],
        ),
      ],
    );
  }
}

/// Sozlamalardagi PIN o'rnatish varag'i.
Future<void> showPinSetup(BuildContext context, WidgetRef ref) async {
  final l = L.of(context);
  final pin = await showModalBottomSheet<String>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (_) => const _PinSetupSheet(),
  );
  if (pin == null || !context.mounted) return;
  await ref.read(appLockProvider.notifier).enable(pin);
  if (!context.mounted) return;
  ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(l.lockEnabled)));
}

class _PinSetupSheet extends StatefulWidget {
  const _PinSetupSheet();

  @override
  State<_PinSetupSheet> createState() => _PinSetupSheetState();
}

class _PinSetupSheetState extends State<_PinSetupSheet> {
  String _first = '';
  String _pin = '';
  bool _mismatch = false;

  void _push(String d) {
    if (_pin.length >= kPinLength) return;
    setState(() {
      _pin += d;
      _mismatch = false;
    });
    if (_pin.length < kPinLength) return;

    if (_first.isEmpty) {
      // Birinchi kiritish — tasdiqlash uchun ikkinchi marta so'raladi.
      setState(() {
        _first = _pin;
        _pin = '';
      });
    } else if (_first == _pin) {
      Navigator.of(context).pop(_pin);
    } else {
      setState(() {
        _mismatch = true;
        _first = '';
        _pin = '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);

    return Padding(
      padding: EdgeInsets.only(
        left: Gap.lg,
        right: Gap.lg,
        bottom: MediaQuery.viewPaddingOf(context).bottom + Gap.lg,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: R.soft,
          border: Border.all(color: t.border2),
        ),
        padding: const EdgeInsets.all(Gap.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _first.isEmpty ? l.lockSetPin : l.lockRepeatPin,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (_mismatch) ...[
              const SizedBox(height: Gap.sm),
              Text(l.lockMismatch,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall!
                      .copyWith(color: t.error)),
            ],
            const SizedBox(height: Gap.xl),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < kPinLength; i++)
                  Container(
                    width: 13,
                    height: 13,
                    margin: const EdgeInsets.symmetric(horizontal: Gap.sm),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i < _pin.length ? t.accent2 : Colors.transparent,
                      border: Border.all(
                        color: i < _pin.length ? t.accent2 : t.border2,
                        width: 1.4,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: Gap.xl),
            _Keypad(
              onDigit: _push,
              onBack: () {
                if (_pin.isEmpty) return;
                setState(() => _pin = _pin.substring(0, _pin.length - 1));
              },
            ),
            const SizedBox(height: Gap.sm),
            NovaButton(
              label: l.actionCancel,
              tone: ButtonTone.quiet,
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }
}
