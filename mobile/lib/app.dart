import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'design/theme.dart';
import 'design/tokens.dart';
import 'design/type.dart';
import 'screens/entry/login.dart';
import 'screens/entry/onboarding.dart';
import 'screens/entry/splash.dart';
import 'screens/lock/lock_screen.dart';
import 'screens/shell.dart';
import 'state/app_lock.dart';
import 'state/app_state.dart';

/// Ilova ildizi.
///
/// Ildiz FAQAT uchta holatni biladi: yuklanmoqda, kirilmagan, kirilgan.
/// Ekranlar orasidagi qolgan navigatsiya har bo'limning o'z
/// `Navigator`ida qoladi.
class NfcstoreApp extends StatefulWidget {
  const NfcstoreApp({super.key, required this.state, this.lock});
  final AppState state;

  /// Testda soxta qulf berish uchun. Odatda `null` — o'zi yaratiladi.
  final AppLock? lock;

  @override
  State<NfcstoreApp> createState() => _NfcstoreAppState();
}

class _NfcstoreAppState extends State<NfcstoreApp> with WidgetsBindingObserver {
  late final AppLock _lock = widget.lock ?? AppLock();
  /// Tanishtiruv faqat BIRINCHI ochilishda. Keyin to'g'ridan-to'g'ri
  /// kirish ekrani chiqadi.
  bool _onboarded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.state.boot();
    _lock.load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// ILOVA FONGA O'TSA — QAYTA QULFLANADI.
  ///
  /// Aks holda qulf faqat birinchi ochilishda so'ralardi va telefon
  /// birov qo'liga tushganda ilova allaqachon ochiq bo'lardi.
  /// `paused` — ekran o'chdi yoki boshqa ilovaga o'tildi.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      _lock.lock();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: widget.state,
      child: AppLockScope(
        lock: _lock,
        child: MaterialApp(
        title: 'NFCSTORE',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        // Ekran matnlari o'zbekcha va shrift o'lchamlari dizaynda
        // qat'iy belgilangan. Tizimdagi juda katta shrift maketni
        // buzmasligi uchun masshtab 1.3 bilan cheklanadi — butunlay
        // o'chirib qo'yish esa ko'rish qiyinchiligi bor odamga
        // adolatsizlik bo'lardi.
        builder: (context, child) => MediaQuery.withClampedTextScaling(
          minScaleFactor: 1,
          maxScaleFactor: 1.3,
          child: AnnotatedRegion<SystemUiOverlayStyle>(
            value: systemOverlay,
            // MATERIAL AJDODI — BUTUN ILOVA UCHUN SHU YERDA.
            //
            // Ekranlar `Scaffold` ishlatmaydi (ular o'z maketini o'zi
            // quradi), `MaterialApp` esa Material qatlamini O'ZI
            // qo'shmaydi. Natijada har bir `Text` "uslub meros
            // qilinmagan" deb SARIQ IKKI CHIZIQ bilan chiziladi —
            // ya'ni ilovaning HAMMA ekrani buzuq ko'rinardi. Buni
            // faqat ilovani haqiqatan ochib ko'rgandagina bilish
            // mumkin edi: testlar ham, `flutter analyze` ham buni
            // xato deb hisoblamaydi.
            //
            // Bitta joyda hal qilinadi: shu builder `Navigator` ni
            // o'raydi, demak barcha ekranlar uning ichida.
            child: Material(
              type: MaterialType.canvas,
              color: C.obsidian,
              // Standart matn uslubi ham shu yerdan — uslubsiz
              // qolgan `Text` ilovaning o'z shriftini oladi.
              textStyle: T.body.copyWith(color: C.offWhite),
              child: child ?? const SizedBox(),
            ),
          ),
        ),
        home: _Root(onboarded: _onboarded, onOnboarded: () => setState(() => _onboarded = true)),
        ),
      ),
    );
  }
}

/// Qulf holatiga kirish — `AppLockScope.of(context)`.
class AppLockScope extends InheritedNotifier<AppLock> {
  const AppLockScope({super.key, required AppLock lock, required super.child})
      : super(notifier: lock);

  static AppLock of(BuildContext context) {
    final s = context.dependOnInheritedWidgetOfExactType<AppLockScope>();
    assert(s?.notifier != null, 'AppLockScope topilmadi.');
    return s!.notifier!;
  }

  static AppLock read(BuildContext context) {
    final s = context.getInheritedWidgetOfExactType<AppLockScope>();
    assert(s?.notifier != null, 'AppLockScope topilmadi.');
    return s!.notifier!;
  }
}

class _Root extends StatelessWidget {
  const _Root({required this.onboarded, required this.onOnboarded});
  final bool onboarded;
  final VoidCallback onOnboarded;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final lock = AppLockScope.of(context);
    // QULF ENG USTIDA: hisobga kirilgan bo'lsa va qulf yopiq bo'lsa,
    // boshqa hech narsa ko'rinmaydi.
    if (state.phase == AuthPhase.signedIn && lock.locked) {
      return LockScreen(lock: lock);
    }
    final child = switch (state.phase) {
      AuthPhase.loading => const SplashScreen(),
      AuthPhase.signedIn => const Shell(),
      AuthPhase.signedOut =>
        onboarded ? const LoginScreen() : OnboardingScreen(onDone: onOnboarded),
    };
    // Holat almashganda yumshoq o'tish — splashdan ilovaga "sakrash"
    // bo'lmaydi.
    return AnimatedSwitcher(
      duration: M.fade,
      // MAKETNI EKRANGA TO'LDIRAMIZ.
      //
      // `AnimatedSwitcher` ning standart joylashuvi bolani `Stack`
      // ichida MARKAZGA qo'yadi va unga bo'sh (loose) o'lcham beradi.
      // Natijada ekranlar o'z tarkibi bo'yicha kichrayib, ekran
      // o'rtasida osilib qolardi — kirish ekrani aynan shunday
      // ko'rinardi. `StackFit.expand` bilan har bir ekran to'liq
      // balandlikni oladi.
      layoutBuilder: (current, previous) => Stack(
        fit: StackFit.expand,
        children: [...previous, if (current != null) current],
      ),
      child: KeyedSubtree(key: ValueKey(state.phase.name + (onboarded ? '1' : '0')), child: child),
    );
  }
}
