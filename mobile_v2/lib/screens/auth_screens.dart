import 'package:flutter/material.dart';

import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final email = _email.text.trim();
    if (email.isEmpty || _busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await SessionScope.read(context).repo.requestRegisterCode(email);
      if (!mounted) return;
      setState(() {
        _codeSent = true;
        _message = 'Tasdiqlash kodi emailingizga yuborildi.';
      });
    } catch (_) {
      if (mounted) setState(() => _message = 'Kod yuborilmadi. Qayta urinib ko‘ring.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _register() async {
    if (_busy) return;
    final email = _email.text.trim();
    final password = _password.text;
    final code = _code.text.trim();
    if (email.isEmpty || password.length < 6 || code.isEmpty) {
      setState(() => _message = 'Email, parol va tasdiqlash kodini to‘liq kiriting.');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await SessionScope.read(context).signUp(
        email: email,
        password: password,
        code: code,
      );
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (_) {
      if (mounted) setState(() => _message = 'Ro‘yxatdan o‘tish amalga oshmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 36),
          children: [
            const Wordmark(),
            const SizedBox(height: 42),
            Text('Yangi hisob', style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: 8),
            Text(
              'Tasdiqlash email orqali amalga oshiriladi. SMS OTP ishlatilmaydi.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 28),
            SurfaceCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Parol',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_codeSent)
                    TextField(
                      controller: _code,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Tasdiqlash kodi',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  if (_message != null) ...[
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(_message!, style: Theme.of(context).textTheme.bodyMedium),
                    ),
                  ],
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton(
                      onPressed: _busy ? null : (_codeSent ? _register : _sendCode),
                      style: FilledButton.styleFrom(
                        backgroundColor: p.hero,
                        foregroundColor: p.heroInk,
                      ),
                      child: Text(_codeSent ? 'Hisob yaratish' : 'Kod yuborish'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();
  bool _sent = false;
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_email.text.trim().isEmpty || _busy) return;
    setState(() => _busy = true);
    try {
      await SessionScope.read(context).repo.requestPasswordReset(_email.text.trim());
      if (!mounted) return;
      setState(() {
        _sent = true;
        _message = 'Agar hisob mavjud bo‘lsa, tiklash kodi yuborildi.';
      });
    } catch (_) {
      if (mounted) setState(() => _message = 'So‘rov yuborilmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await SessionScope.read(context).repo.resetPassword(
        email: _email.text.trim(),
        code: _code.text.trim(),
        password: _password.text,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (_) {
      if (mounted) setState(() => _message = 'Parol yangilanmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 36),
          children: [
            Text('Parolni tiklash', style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: 8),
            Text(
              'Kod email orqali keladi.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 28),
            SurfaceCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (_sent) ...[
                    const SizedBox(height: 12),
                    TextField(
                      controller: _code,
                      decoration: const InputDecoration(
                        labelText: 'Kod',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _password,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Yangi parol',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                  if (_message != null) ...[
                    const SizedBox(height: 12),
                    Text(_message!, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton(
                      onPressed: _busy ? null : (_sent ? _reset : _send),
                      style: FilledButton.styleFrom(
                        backgroundColor: p.hero,
                        foregroundColor: p.heroInk,
                      ),
                      child: Text(_sent ? 'Parolni yangilash' : 'Kod yuborish'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
