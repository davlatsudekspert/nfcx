import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nfc_orb.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final size = MediaQuery.sizeOf(context);

    // Orb ekran kengligiga moslashadi, lekin 300px dan oshmaydi: katta
    // telefonlarda u matnni pastga siqib yuborardi.
    final orb = (size.width * .62).clamp(180.0, 300.0);

    return NovaScaffold(
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Gap.xxl, 0, Gap.xxl, Gap.xxl),
          child: Column(
            children: [
              const Spacer(flex: 2),
              NfcOrb(
                size: orb,
                child: BrandLogo(size: orb * .34, halo: false),
              ),
              const Spacer(),
              Text(
                l.welcomeTitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.displayLarge?.copyWith(
                      fontSize: (size.width * .105).clamp(30.0, 44.0),
                    ),
              ),
              const SizedBox(height: Gap.md),
              Text(
                l.welcomeSubtitle,
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: t.text2),
              ),
              const Spacer(flex: 2),
              NovaButton(
                label: l.welcomeRegister,
                onPressed: () => context.push(Routes.register),
              ),
              const SizedBox(height: Gap.md),
              NovaButton(
                label: l.welcomeLogin,
                tone: ButtonTone.quiet,
                onPressed: () => context.push(Routes.login),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
