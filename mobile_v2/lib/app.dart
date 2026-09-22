import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'core/session.dart';
import 'core/theme.dart';
import 'screens/login_screen.dart';
import 'screens/shell.dart';

class NfcstoreV2App extends StatelessWidget {
  const NfcstoreV2App({super.key, required this.session, required this.theme});

  final AppSession session;
  final BrandThemeController theme;

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      session: session,
      child: BrandThemeScope(
        controller: theme,
        child: ListenableBuilder(
          listenable: Listenable.merge([session, theme]),
          builder: (context, _) {
            final palette = theme.palette;
            SystemChrome.setSystemUIOverlayStyle(brandOverlay(palette));
            return MaterialApp(
              title: 'NFCSTORE V2',
              debugShowCheckedModeBanner: false,
              theme: buildBrandTheme(palette),
              home: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                child: switch (session.phase) {
                  SessionPhase.loading => const _BootScreen(key: ValueKey('boot')),
                  SessionPhase.signedOut => const LoginScreen(key: ValueKey('login')),
                  SessionPhase.signedIn => const V2Shell(key: ValueKey('shell')),
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

class _BootScreen extends StatelessWidget {
  const _BootScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'NFCSTORE',
              style: TextStyle(
                color: p.ink,
                fontSize: 30,
                fontWeight: FontWeight.w600,
                letterSpacing: 4,
              ),
            ),
            const SizedBox(height: 10),
            Text('More than a link', style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 26),
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 1.7, color: p.accent),
            ),
          ],
        ),
      ),
    );
  }
}
