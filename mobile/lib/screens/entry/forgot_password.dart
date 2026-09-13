import 'dart:async';
import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';
import '../../data/api_client.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// PAROLNI TIKLASH — ikki qadam: kod so'rash, keyin yangi parol.
///
/// SERVER HISOB BOR-YO'QLIGINI OSHKOR QILMAYDI: `request-password-reset`
/// har doim `{ok:true}` qaytaradi. Shuning uchun ilova ham "kod
/// yuborildi" deb yozadi va boshqa hech narsa aytmaydi — aks holda
/// begona odam shu ekran orqali qaysi email ro'yxatda borligini
/// tekshirib chiqishi mumkin bo'lardi.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, this.login = ''});

  /// Kirish ekranida yozilgan login — qayta terish shart emas.
  final String login;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  late final _login = TextEditingController(text: widget.login);
  final _code = TextEditingController();
  final _password = TextEditingController();

  bool _sent = false;
  bool _busy = false;
  bool _done = false;
  String? _error;
  Timer? _timer;
  int _left = 0;

  @override
  void dispose() {
    _timer?.cancel();
    _login.dispose();
    _code.dispose();
    _password.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    _left = 60;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() {
        _left--;
        if (_left <= 0) t.cancel();
      });
    });
  }

  Future<void> _request() async {
    final login = _login.text.trim();
    if (login.isEmpty) {
      setState(() => _error = 'Email yoki telefon raqamini kiriting.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repo.requestPasswordReset(login);
      if (!mounted) return;
      setState(() => _sent = true);
      _startTimer();
    } on ApiError catch (e) {
      if (mounted) {
        setState(() => _error = e.key == 'rate_limited'
            ? 'Juda ko‘p urinish. Birozdan so‘ng qayta urining.'
            : humanError(e));
      }
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reset() async {
    if (_code.text.length != 6) {
      setState(() => _error = 'Kodni to‘liq kiriting.');
      return;
    }
    if (_password.text.length < 6) {
      setState(() => _error = 'Parol kamida 6 belgi bo‘lsin.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repo.resetPassword(
            login: _login.text.trim(),
            code: _code.text,
            password: _password.text,
          );
      if (mounted) setState(() => _done = true);
    } on ApiError catch (e) {
      if (mounted) {
        setState(() => _error = e.key == 'bad_code'
            ? 'Kod xato yoki muddati tugagan.'
            : humanError(e));
      }
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_done) {
      return Scaffold(
        backgroundColor: C.obsidian,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                const Text('Parol\nyangilandi', style: T.display),
                const SizedBox(height: S.x12),
                const Text(
                  'Endi yangi parol bilan kirishingiz mumkin. Boshqa '
                  'qurilmalardagi ochiq sessiyalar yopildi.',
                  style: T.body,
                ),
                const Spacer(),
                PrimaryButton('Kirish', onTap: () => Navigator.of(context).pop()),
                const SizedBox(height: S.x32),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        child: Column(
          children: [
            const TopBar(title: 'Parolni tiklash'),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, S.x32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_sent ? 'Kodni\nkiriting' : 'Parolni\nunutdingizmi', style: T.display),
                    const SizedBox(height: S.x12),
                    Text(
                      _sent
                          ? 'Agar bu hisob mavjud bo‘lsa, unga 6 xonali kod '
                              'yuborildi. Kod 10 daqiqa amal qiladi.'
                          : 'Email yoki telefon raqamingizni kiriting — tiklash '
                              'kodini yuboramiz.',
                      style: T.body,
                    ),
                    const SizedBox(height: S.x24),
                    Field(
                      label: 'Email yoki telefon',
                      controller: _login,
                      hint: 'ism@gmail.com',
                      enabled: !_sent,
                      textInputAction: TextInputAction.next,
                      error: _sent ? null : _error,
                    ),
                    if (_sent) ...[
                      const SizedBox(height: S.x20),
                      const Eyebrow('Kod'),
                      const SizedBox(height: 7),
                      CodeField(controller: _code, hasError: _error != null),
                      const SizedBox(height: S.x16),
                      Field(
                        label: 'Yangi parol',
                        controller: _password,
                        hint: '••••••••',
                        obscure: true,
                        helper: 'Kamida 6 belgi',
                        error: _error,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _reset(),
                      ),
                      const SizedBox(height: S.x20),
                      PrimaryButton('Parolni yangilash', loading: _busy, onTap: _busy ? null : _reset),
                      const SizedBox(height: S.x12),
                      Center(
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: _left > 0 || _busy ? null : _request,
                          child: Padding(
                            padding: const EdgeInsets.all(S.x8),
                            child: Text(
                              _left > 0 ? 'Qayta yuborish · $_left' : 'Qayta yuborish',
                              style: T.caption.copyWith(
                                color: _left > 0 ? C.muted : C.champagne,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ] else ...[
                      const SizedBox(height: S.x24),
                      PrimaryButton('Kod yuborish', loading: _busy, onTap: _busy ? null : _request),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
