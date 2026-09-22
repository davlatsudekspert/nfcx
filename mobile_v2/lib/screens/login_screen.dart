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

class _LoginScreenState extends State<LoginScreen> {
  final _login = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
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
          'timeout' => 'Server javobi kechikdi. Qayta urinib ko‘ring.',
          _ => 'Kirish amalga oshmadi: ' + e.key,
        };
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Kirish amalga oshmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 36),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Wordmark(),
                  const Spacer(),
                  RoundIcon(
                    icon: BrandThemeScope.of(context).mode == BrandThemeMode.editorial
                        ? Icons.dark_mode_outlined
                        : Icons.light_mode_outlined,
                    onTap: () => BrandThemeScope.of(context).toggle(),
                  ),
                ],
              ),
              const SizedBox(height: 72),
              Text(
                'Raqamli kimligingiz\nbir tegishda.',
                style: Theme.of(context).textTheme.displaySmall,
              ),
              const SizedBox(height: 14),
              Text(
                'Profil, NFC ID, biznes va ijtimoiy kontent — bitta premium platformada.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 38),
              SurfaceCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    TextField(
                      controller: _login,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        prefixIcon: Icon(Icons.alternate_email_rounded),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _password,
                      obscureText: _obscure,
                      onSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Parol',
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                          ),
                        ),
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          _error!,
                          style: const TextStyle(color: Color(0xFFD65D55), fontSize: 12.5),
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: FilledButton(
                        onPressed: _busy ? null : _submit,
                        style: FilledButton.styleFrom(
                          backgroundColor: p.hero,
                          foregroundColor: p.heroInk,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                        ),
                        child: _busy
                            ? SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: p.heroInk),
                              )
                            : const Text('Kirish'),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        TextButton(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const RegisterScreen()),
                          ),
                          child: const Text('Ro‘yxatdan o‘tish'),
                        ),
                        const Spacer(),
                        TextButton(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const ForgotPasswordScreen()),
                          ),
                          child: const Text('Parolni unutdingizmi?'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 64),
              Center(
                child: Text(
                  'NFCSTORE · Your Identity In One Touch',
                  style: TextStyle(color: p.ink2, fontSize: 10.5, letterSpacing: .4),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}