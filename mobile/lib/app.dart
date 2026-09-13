import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'design/theme.dart';
import 'design/tokens.dart';
import 'screens/entry/login.dart';
import 'screens/entry/onboarding.dart';
import 'screens/entry/splash.dart';
import 'screens/shell.dart';
import 'state/app_state.dart';

/// Ilova ildizi.
///
/// Ildiz FAQAT uchta holatni biladi: yuklanmoqda, kirilmagan, kirilgan.
/// Ekranlar orasidagi qolgan navigatsiya har bo'limning o'z
/// `Navigator`ida qoladi.
class NfcstoreApp extends StatefulWidget {
  const NfcstoreApp({super.key, required this.state});
  final AppState state;

  @override
  State<NfcstoreApp> createState() => _NfcstoreAppState();
}

class _NfcstoreAppState extends State<NfcstoreApp> {
  /// Tanishtiruv faqat BIRINCHI ochilishda. Keyin to'g'ridan-to'g'ri
  /// kirish ekrani chiqadi.
  bool _onboarded = false;

  @override
  void initState() {
    super.initState();
    widget.state.boot();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: widget.state,
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
            child: ColoredBox(color: C.obsidian, child: child ?? const SizedBox()),
          ),
        ),
        home: _Root(onboarded: _onboarded, onOnboarded: () => setState(() => _onboarded = true)),
      ),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root({required this.onboarded, required this.onOnboarded});
  final bool onboarded;
  final VoidCallback onOnboarded;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
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
      child: KeyedSubtree(key: ValueKey(state.phase.name + (onboarded ? '1' : '0')), child: child),
    );
  }
}
