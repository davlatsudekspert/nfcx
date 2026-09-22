import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/motion/motion.dart';
import '../design/theme/app_theme.dart';
import '../l10n/gen/app_localizations.dart';
import '../routing/router.dart';
import 'providers.dart';
import '../features/settings/app_lock.dart';
import '../features/auth/session.dart';

class NovaApp extends ConsumerWidget {
  const NovaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 401 -> sessiya yopiladi -> router kirish ekraniga ko'chiradi.
    // Bu ulanish ILGARI YO'Q edi: signal chiqardi, uni hech kim
    // eshitmasdi. `watch` shu yerda turishi kerak — kuzatuvchi
    // ilovaning umri davomida tirik bo'lishi uchun.
    ref.watch(sessionExpiryWatcherProvider);

    final tokens = ref.watch(themeProvider);
    final locale = ref.watch(localeProvider);
    final router = ref.watch(routerProvider);

    return AnimatedTheme(
      // Mavzu almashuvi bir zumda emas, yarim soniyada oqib o'tadi —
      // `NfcTokens.lerp` tufayli har bir rang alohida interpolatsiya
      // qilinadi.
      data: buildTheme(tokens),
      duration: Motion.theme,
      curve: Motion.smooth,
      child: Builder(
        builder: (context) => MaterialApp.router(
          title: 'NFCSTORE',
          debugShowCheckedModeBanner: false,
          theme: Theme.of(context),
          locale: locale,
          supportedLocales: LocaleController.supported,
          localizationsDelegates: const [
            L.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          routerConfig: router,
          builder: (context, child) {
            // Tizim shrifti juda katta qilib qo'yilganda maket buzilmasligi
            // uchun yuqori chegara: 1.3 dan ortig'ida kapsulalardagi matn
            // sig'may qolardi.
            final mq = MediaQuery.of(context);
            return MediaQuery(
              data: mq.copyWith(
                textScaler: mq.textScaler.clamp(minScaleFactor: .85, maxScaleFactor: 1.3),
              ),
              // Qulf butun ilovaning USTIGA chiziladi va marshrutni
              // almashtirmaydi: ochilganda foydalanuvchi qayerda edi,
              // o'sha yerda qoladi.
              child: AppLockGate(child: child ?? const SizedBox.shrink()),
            );
          },
        ),
      ),
    );
  }
}
