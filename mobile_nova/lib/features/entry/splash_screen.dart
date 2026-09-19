import 'package:flutter/material.dart';

import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/backdrop.dart';
import '../../design/widgets/brand_logo.dart';

/// Saqlangan sessiya tekshirilayotgan paytdagi ekran.
///
/// Bu yerda hech qanday tarmoq so'rovi YO'Q — u `SessionController`
/// ichida allaqachon ketmoqda. Splash faqat shu kutishni ko'rsatadi.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
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
            ],
          ),
        ),
      ),
    );
  }
}
