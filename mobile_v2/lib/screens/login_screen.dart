import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import 'auth_screens.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _login = TextEditingController();
  final _password = TextEditingController();
  late final AnimationController _motion;

  bool _busy = false;
  bool _obscure = true;
  bool _showForm = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 7),
    )..repeat();
  }

  @override
  void dispose() {
    _motion.dispose();
    _login.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    final login = _login.text.trim();
    final password = _password.text;

    if (login.isEmpty || password.isEmpty) {
      setState(() => _error = 'Email va parolni kiriting.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await SessionScope.read(context).signIn(login, password);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = switch (e.key) {
          'invalid_credentials' => 'Email yoki parol noto‘g‘ri.',
          'offline' => 'Internet bilan aloqa yo‘q.',
          'timeout' => 'Server javobi kechikdi.',
          _ => e.detail.isNotEmpty ? e.detail : 'Kirish amalga oshmadi.',
        };
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Kirish amalga oshmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _openForm() => setState(() => _showForm = true);

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _motion,
              builder: (context, _) => CustomPaint(
                painter: _LoginBackdrop(
                  t: _motion.value,
                  background: p.background,
                  ink: p.ink,
                  accent: p.accent,
                ),
              ),
            ),
          ),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, c) => SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(22, 18, 22, 28),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: c.maxHeight - 46),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Wordmark(),
                          const Spacer(),
                          _CircleButton(
                            icon: BrandThemeScope.of(context).mode ==
                                    BrandThemeMode.editorial
                                ? Icons.dark_mode_outlined
                                : Icons.light_mode_outlined,
                            onTap: () => BrandThemeScope.of(context).toggle(),
                          ),
                        ],
                      ),
                      const SizedBox(height: 26),
                      AnimatedBuilder(
                        animation: _motion,
                        builder: (context, child) {
                          final y = math.sin(_motion.value * math.pi * 2) * 7;
                          final rotate =
                              math.sin(_motion.value * math.pi * 2) * .012;
                          return Transform.translate(
                            offset: Offset(0, y),
                            child: Transform.rotate(
                              angle: rotate,
                              child: child,
                            ),
                          );
                        },
                        child: _OpeningObject(showForm: _showForm),
                      ),
                      const SizedBox(height: 28),
                      Text(
                        'More than\na link.',
                        style: Theme.of(context)
                            .textTheme
                            .displaySmall
                            ?.copyWith(fontSize: 48, height: .9),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'NFCSTORE — shaxsiy identity, biznes va kontentni bitta premium tajribaga birlashtiradi.',
                        style: Theme.of(context)
                            .textTheme
                            .bodyMedium
                            ?.copyWith(fontSize: 13.2),
                      ),
                      const SizedBox(height: 26),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 260),
                        switchInCurve: Curves.easeOutCubic,
                        switchOutCurve: Curves.easeInCubic,
                        child: _showForm
                            ? _LoginForm(
                                key: const ValueKey('form'),
                                login: _login,
                                password: _password,
                                obscure: _obscure,
                                busy: _busy,
                                error: _error,
                                onToggleObscure: () =>
                                    setState(() => _obscure = !_obscure),
                                onSubmit: _submit,
                              )
                            : _EntryActions(
                                key: const ValueKey('actions'),
                                onLogin: _openForm,
                                onRegister: () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => const RegisterScreen(),
                                  ),
                                ),
                              ),
                      ),
                      if (_showForm) ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            TextButton(
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => const RegisterScreen(),
                                ),
                              ),
                              child: const Text('Yangi hisob'),
                            ),
                            const Spacer(),
                            TextButton(
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) =>
                                      const ForgotPasswordScreen(),
                                ),
                              ),
                              child: const Text('Parolni unutdingizmi?'),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 30),
                      Wrap(
                        spacing: 7,
                        runSpacing: 7,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          const _FeatureDot(
                            icon: Icons.contactless_rounded,
                            label: 'NFC',
                          ),
                          const _FeatureDot(
                            icon: Icons.play_circle_outline_rounded,
                            label: 'Reels',
                          ),
                          const _FeatureDot(
                            icon: Icons.storefront_outlined,
                            label: 'Business',
                          ),
                          Text(
                            '2026',
                            style: TextStyle(
                              color: p.ink2,
                              fontFamily: 'IBMPlexMono',
                              fontSize: 9.5,
                              letterSpacing: 1.1,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OpeningObject extends StatelessWidget {
  const _OpeningObject({required this.showForm});
  final bool showForm;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      height: showForm ? 184 : 222,
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: const Color(0xFF10100F),
        borderRadius: BorderRadius.circular(34),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .2),
            blurRadius: 34,
            offset: const Offset(0, 17),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -22,
            top: -18,
            child: SizedBox(
              width: 180,
              height: 180,
              child: CustomPaint(
                painter: _OpeningSignal(p.heroInk.withValues(alpha: .22)),
              ),
            ),
          ),
          Positioned(
            left: 0,
            top: 0,
            child: Text(
              'NFC ID',
              style: TextStyle(
                color: Colors.white.withValues(alpha: .46),
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.6,
              ),
            ),
          ),
          Positioned(
            left: 0,
            bottom: showForm ? 8 : 12,
            right: 0,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'VIP001',
                  style: TextStyle(
                    color: p.heroInk,
                    fontFamily: 'IBMPlexMono',
                    fontSize: showForm ? 25 : 31,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 2.5,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  'Your Identity In One Touch',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: .86),
                    fontFamily: 'InstrumentSerif',
                    fontSize: showForm ? 20 : 24,
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: 49,
              height: 49,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: .055),
                border: Border.all(
                  color: Colors.white.withValues(alpha: .1),
                ),
              ),
              child: Icon(
                Icons.contactless_rounded,
                color: p.heroInk,
                size: 27,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EntryActions extends StatelessWidget {
  const _EntryActions({
    super.key,
    required this.onLogin,
    required this.onRegister,
  });

  final VoidCallback onLogin;
  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          height: 56,
          child: FilledButton(
            onPressed: onLogin,
            style: FilledButton.styleFrom(
              backgroundColor: p.ink,
              foregroundColor: p.background,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(19),
              ),
            ),
            child: const Text('Kirish'),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          height: 56,
          child: OutlinedButton(
            onPressed: onRegister,
            style: OutlinedButton.styleFrom(
              foregroundColor: p.ink,
              side: BorderSide(color: p.line),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(19),
              ),
            ),
            child: const Text('Personal yoki Business hisob ochish'),
          ),
        ),
      ],
    );
  }
}

class _LoginForm extends StatelessWidget {
  const _LoginForm({
    super.key,
    required this.login,
    required this.password,
    required this.obscure,
    required this.busy,
    required this.error,
    required this.onToggleObscure,
    required this.onSubmit,
  });

  final TextEditingController login;
  final TextEditingController password;
  final bool obscure;
  final bool busy;
  final String? error;
  final VoidCallback onToggleObscure;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      padding: const EdgeInsets.all(17),
      decoration: BoxDecoration(
        color: p.surface.withValues(alpha: .94),
        borderRadius: BorderRadius.circular(25),
        border: Border.all(color: p.line.withValues(alpha: .85)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .07),
            blurRadius: 20,
            offset: const Offset(0, 9),
          ),
        ],
      ),
      child: Column(
        children: [
          TextField(
            controller: login,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'Email',
              prefixIcon: Icon(Icons.alternate_email_rounded),
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 11),
          TextField(
            controller: password,
            obscureText: obscure,
            onSubmitted: (_) => onSubmit(),
            decoration: InputDecoration(
              labelText: 'Parol',
              prefixIcon: const Icon(Icons.lock_outline_rounded),
              suffixIcon: IconButton(
                onPressed: onToggleObscure,
                icon: Icon(
                  obscure
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                ),
              ),
              border: const OutlineInputBorder(),
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                error!,
                style: const TextStyle(
                  color: Color(0xFFC7524B),
                  fontSize: 11.5,
                ),
              ),
            ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              onPressed: busy ? null : onSubmit,
              style: FilledButton.styleFrom(
                backgroundColor: p.ink,
                foregroundColor: p.background,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(17),
                ),
              ),
              child: busy
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: p.background,
                      ),
                    )
                  : const Text('NFCSTORE ga kirish'),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureDot extends StatelessWidget {
  const _FeatureDot({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
      decoration: BoxDecoration(
        color: p.surface.withValues(alpha: .7),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: p.line.withValues(alpha: .7)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: p.ink, size: 13),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: p.ink2,
              fontSize: 8.7,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return InkWell(
      borderRadius: BorderRadius.circular(99),
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: p.surface.withValues(alpha: .82),
          border: Border.all(color: p.line.withValues(alpha: .8)),
        ),
        child: Icon(icon, color: p.ink, size: 19),
      ),
    );
  }
}

class _OpeningSignal extends CustomPainter {
  const _OpeningSignal(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1;
    final origin = Offset(size.width * .15, size.height * .88);
    for (var i = 0; i < 5; i++) {
      canvas.drawArc(
        Rect.fromCircle(center: origin, radius: 40 + i * 25),
        -math.pi / 2,
        math.pi / 2,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _OpeningSignal oldDelegate) =>
      oldDelegate.color != color;
}

class _LoginBackdrop extends CustomPainter {
  const _LoginBackdrop({
    required this.t,
    required this.background,
    required this.ink,
    required this.accent,
  });

  final double t;
  final Color background;
  final Color ink;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = background);
    final phase = t * math.pi * 2;

    final a = Paint()
      ..color = ink.withValues(alpha: .025)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 60);
    final b = Paint()
      ..color = accent.withValues(alpha: .035)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 60);

    canvas.drawCircle(
      Offset(
        size.width * .8 + math.sin(phase) * 24,
        size.height * .24 + math.cos(phase) * 18,
      ),
      135,
      a,
    );
    canvas.drawCircle(
      Offset(
        size.width * .12 + math.cos(phase * .7) * 24,
        size.height * .72 + math.sin(phase * .7) * 20,
      ),
      120,
      b,
    );
  }

  @override
  bool shouldRepaint(covariant _LoginBackdrop oldDelegate) =>
      oldDelegate.t != t ||
      oldDelegate.background != background ||
      oldDelegate.ink != ink ||
      oldDelegate.accent != accent;
}