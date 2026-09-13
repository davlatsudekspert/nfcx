import 'dart:async';
import 'package:flutter/widgets.dart';
import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';

/// HISOB TASDIQLASH — EMAIL.
///
/// Bu PROFIL tasdiqlash EMAS. Ikkisi butunlay boshqa narsa va UI da
/// hech qachon birlashtirilmaydi:
///   hisob  — email, ro'yxatdan o'tishda bir marta (shu ekran);
///   profil — mavjud Telegram bot, Sozlamalar → Tasdiqlash.
///
/// Barcha holatlar shu yerda: yuklanish, kod xato, muddati tugagan,
/// offline, muvaffaqiyat.
class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({
    super.key,
    required this.email,
    required this.phone,
    required this.password,
    required this.name,
  });

  final String email;
  final String phone;
  final String password;
  final String name;

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final _code = TextEditingController();
  Timer? _timer;

  /// Qayta yuborish uchun kutish. Kod 10 daqiqa amal qiladi, lekin
  /// qayta yuborishga 60 soniyada bir marta ruxsat — aks holda odam
  /// tugmani ketma-ket bosib, server chegarasiga urilib qolardi.
  int _left = 60;
  bool _busy = false;
  bool _resending = false;
  String? _error;
  bool _expired = false;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
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

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_code.text.length != 6) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final state = AppScope.read(context);
    try {
      final token = await state.repo.register(
        email: widget.email,
        password: widget.password,
        phone: widget.phone,
        emailCode: _code.text,
        tosAccepted: true,
      );
      if (!mounted) return;
      if (token.isEmpty) {
        // Ro'yxatdan o'tish o'tdi, lekin token kelmadi — kirish
        // ekraniga qaytaramiz, "hammasi yaxshi" deb turmaymiz.
        setState(() => _error = 'Hisob yaratildi. Endi kirish sahifasidan kiring.');
        return;
      }
      setState(() => _done = true);
      await Future<void>.delayed(const Duration(milliseconds: 900));
      if (!mounted) return;
      await state.completeRegistration(token);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _expired = e.key == 'code_expired' || e.key == 'expired';
        _error = _expired
            ? 'Kod muddati tugadi. Yangi kod so‘rang.'
            : humanError(e);
      });
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    if (_left > 0 || _resending) return;
    setState(() {
      _resending = true;
      _error = null;
    });
    try {
      final channel = await AppScope.read(context)
          .repo
          .requestRegisterCode(email: widget.email, phone: widget.phone);
      if (!mounted) return;
      if (channel == 'none') {
        setState(() => _error = 'Hozir kod yuborib bo‘lmayapti. Birozdan so‘ng urining.');
      } else {
        setState(() {
          _expired = false;
          _code.clear();
        });
        _startTimer();
      }
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_done) return _Success(email: widget.email);

    final masked = AppUser.mask(widget.email);
    final mm = (_left ~/ 60).toString().padLeft(2, '0');
    final ss = (_left % 60).toString().padLeft(2, '0');

    return ColoredBox(
      color: C.obsidian,
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(S.gutter, S.x32, S.gutter, S.x32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _expired ? 'Kod muddati\ntugadi' : 'Emailingizni\ntasdiqlang',
                style: T.display,
              ),
              const SizedBox(height: S.x12),
              Text(
                _expired
                    ? 'Kod 10 daqiqa amal qiladi. $masked manziliga yangi kod so‘rang.'
                    : '6 xonali kod yubordik: $masked',
                style: T.body,
              ),
              const SizedBox(height: S.x32),
              CodeField(
                controller: _code,
                hasError: (_error != null) && !_expired,
                onCompleted: (_) => _verify(),
              ),
              if (_error != null) ...[
                const SizedBox(height: S.x12),
                Text(_error!, style: T.caption.copyWith(color: C.signal)),
              ],
              const SizedBox(height: S.x20),
              Row(
                children: [
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _left > 0 ? null : _resend,
                    child: Text(
                      'Qayta yuborish',
                      style: T.caption.copyWith(
                        color: _left > 0 ? C.muted : C.champagne,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: S.x8),
                  if (_resending)
                    const Spinner(size: 12)
                  else
                    Text('$mm:$ss', style: T.meta.copyWith(color: C.muted)),
                ],
              ),
              const SizedBox(height: S.x24),
              PrimaryButton(
                'Tasdiqlash',
                loading: _busy,
                onTap: _busy || _code.text.length != 6 ? null : _verify,
              ),
              const SizedBox(height: S.x12),
              GhostButton('Emailni o‘zgartirish', onTap: () => Navigator.of(context).maybePop()),
            ],
          ),
        ),
      ),
    );
  }
}

/// Muvaffaqiyat — va DARHOL keyingi qadam haqida eslatma.
///
/// Bu yerda PROFIL tasdiqlash (Telegram) alohida kartochka sifatida
/// ko'rsatiladi, lekin "keyinroq" deb — chunki u boshqa narsa va
/// hozir majburiy emas.
class _Success extends StatelessWidget {
  const _Success({required this.email});
  final String email;

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: C.obsidian,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                const Text('Email\ntasdiqlandi', style: T.display),
                const SizedBox(height: S.x12),
                const Text(
                  'Akkauntingiz tayyor. Endi NFC ID tanlab, profilingizni '
                  'to‘ldirishingiz mumkin.',
                  style: T.body,
                ),
                const SizedBox(height: S.x24),
                Surface(
                  child: Row(
                    children: [
                      Container(
                        width: 26, height: 26,
                        decoration: const BoxDecoration(color: C.verdant, shape: BoxShape.circle),
                        child: const Center(
                          child: Text('✓', style: TextStyle(color: C.obsidian, fontSize: 15, height: 1)),
                        ),
                      ),
                      const SizedBox(width: S.x12),
                      Expanded(child: Text(AppUser.mask(email), style: T.meta.copyWith(color: C.offWhite))),
                    ],
                  ),
                ),
                const SizedBox(height: S.x12),
                Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text('Profilni tasdiqlash — keyinroq', style: T.cardTitle),
                      SizedBox(height: 5),
                      Text(
                        'Telegram bot orqali profilingizni tasdiqlab, tasdiqlangan '
                        'nishonga ega bo‘lasiz.',
                        style: T.caption,
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                const Center(child: Spinner()),
                const SizedBox(height: S.x32),
              ],
            ),
          ),
        ),
      );
}
