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
              home: _LaunchGate(phase: session.phase),
            );
          },
        ),
      ),
    );
  }
}

class _LaunchGate extends StatefulWidget {
  const _LaunchGate({required this.phase});

  final SessionPhase phase;

  @override
  State<_LaunchGate> createState() => _LaunchGateState();
}

class _LaunchGateState extends State<_LaunchGate> {
  bool _minimumIntroDone = false;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 1050), () {
      if (mounted) setState(() => _minimumIntroDone = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final showBoot =
        !_minimumIntroDone || widget.phase == SessionPhase.loading;
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 420),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      child: showBoot
          ? const _BootScreen(key: ValueKey('boot'))
          : widget.phase == SessionPhase.signedIn
              ? const V2Shell(key: ValueKey('shell'))
              : const LoginScreen(key: ValueKey('login')),
    );
  }
}

class _BootScreen extends StatefulWidget {
  const _BootScreen({super.key});

  @override
  State<_BootScreen> createState() => _BootScreenState();
}

class _BootScreenState extends State<_BootScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _motion;

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1700),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0C),
      body: Stack(
        children: [
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _motion,
              builder: (context, _) {
                final t = Curves.easeInOutCubic.transform(_motion.value);
                return CustomPaint(
                  painter: _BootAura(
                    t: t,
                    color: p.heroInk,
                  ),
                );
              },
            ),
          ),
          Center(
            child: AnimatedBuilder(
              animation: _motion,
              builder: (context, child) {
                final t = Curves.easeInOut.transform(_motion.value);
                return Transform.translate(
                  offset: Offset(0, -3 + t * 6),
                  child: Transform.scale(
                    scale: .965 + t * .035,
                    child: child,
                  ),
                );
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 118,
                    height: 118,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: .025),
                      border: Border.all(
                        color: p.heroInk.withValues(alpha: .16),
                      ),
                    ),
                    child: ClipOval(
                      child: Image.asset(
                        'assets/images/nfcstore_logo_mark.png',
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  const SizedBox(height: 25),
                  const Text(
                    'NFCSTORE',
                    style: TextStyle(
                      color: Color(0xFFF8F6EF),
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 4.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'MORE THAN A LINK',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: .38),
                      fontSize: 8.5,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2.1,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            left: 28,
            right: 28,
            bottom: MediaQuery.paddingOf(context).bottom + 28,
            child: Row(
              children: [
                Text(
                  'DIGITAL IDENTITY',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: .3),
                    fontFamily: 'IBMPlexMono',
                    fontSize: 7.7,
                    letterSpacing: 1.25,
                  ),
                ),
                const Spacer(),
                SizedBox(
                  width: 42,
                  child: LinearProgressIndicator(
                    minHeight: 1.5,
                    color: p.heroInk,
                    backgroundColor: Colors.white.withValues(alpha: .08),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BootAura extends CustomPainter {
  const _BootAura({required this.t, required this.color});

  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width * .5, size.height * .45);
    for (var i = 0; i < 4; i++) {
      final r = 82 + i * 38 + t * 12;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = color.withValues(alpha: .07 - i * .012);
      canvas.drawCircle(center, r, paint);
    }
    final glow = Paint()
      ..color = color.withValues(alpha: .035 + t * .02)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 50);
    canvas.drawCircle(center, 92 + t * 8, glow);
  }

  @override
  bool shouldRepaint(covariant _BootAura oldDelegate) =>
      oldDelegate.t != t || oldDelegate.color != color;
}
