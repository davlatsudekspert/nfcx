import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/backdrop.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/states.dart';
import '../../l10n/gen/app_localizations.dart';
import '../auth/session.dart';

/// Saqlangan sessiya tekshirilayotgan paytdagi ekran.
///
/// Bu yerda hech qanday tarmoq so'rovi YO'Q — u `SessionController`
/// ichida allaqachon ketmoqda. Splash faqat shu kutishni ko'rsatadi.
///
/// Internet yo'q bo'lsa (sessiya saqlangan, lekin tekshirib bo'lmadi)
/// sabab va "Qayta urinish" ko'rsatiladi — odam cheksiz aylanayotgan
/// belgiga qarab qolmaydi va chiqarib ham yuborilmaydi.
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final s = ref.watch(sessionProvider);
    final error = s is SessionRestoring ? s.error : null;
    return Scaffold(
      backgroundColor: t.bg1,
      body: AmbientBackdrop(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const BrandLockup(size: 112),
              const SizedBox(height: Gap.section),
              SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: t.accent2,
                ),
              ),
              if (error != null) ...[
                const SizedBox(height: Gap.lg),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: Gap.xl),
                  child: Text(
                    describeError(L.of(context), error),
                    key: const ValueKey('splash-error'),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
                const SizedBox(height: Gap.md),
                NovaButton(
                  label: L.of(context).actionRetry,
                  expand: false,
                  onPressed: () =>
                      ref.read(sessionProvider.notifier).restore(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
