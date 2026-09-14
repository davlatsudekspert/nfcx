import 'dart:async';
import 'package:flutter/widgets.dart';
import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../../l10n/strings.dart';

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

  /// Hisob YARATILDI, lekin sessiyani ochishda xato bo'ldi.
  /// Qayta urinish mumkin — ro'yxatdan o'tishni takrorlash shart
  /// emas, token qo'lda.
  String? _finishError;
  String? _token;

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
        setState(() => _error = tr('Hisob yaratildi. Endi kirish sahifasidan kiring.'));
        return;
      }
      setState(() {
        _done = true;
        _token = token;
      });
      await Future<void>.delayed(const Duration(milliseconds: 900));
      if (!mounted) return;
      await _finish(token);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _expired = e.key == 'code_expired' || e.key == 'expired';
        _error = _expired
            ? tr('Kod muddati tugadi. Yangi kod so‘rang.')
            : humanError(e);
      });
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// SESSIYANI OCHISH VA EKRANLARNI YOPISH.
  ///
  /// ILGARI SHU YERDA OSILIB QOLARDI. Sabab: kirish va ro'yxatdan
  /// o'tish ekranlari ildiz `Navigator` iga PUSH qilinadi, ya'ni
  /// ular `_Root` ning USTIDA turadi. `completeRegistration` holatni
  /// "kirilgan" ga o'tkazgach `_Root` o'z ichida `Shell` ga
  /// almashadi — lekin u STEKNING TAGIDA. Ustidagi ikki ekran
  /// (ro'yxatdan o'tish va tasdiqlash) joyida qolaverardi va odam
  /// aylanuvchi belgiga qarab o'tirardi.
  ///
  /// Kirish ekrani bu muammoni ko'rsatmagan, chunki u PUSH
  /// qilinmaydi — uni `_Root` ning o'zi chizadi.
  ///
  /// Shuning uchun: sessiya ochilgach stek ildizgacha tozalanadi.
  Future<void> _finish(String token) async {
    final state = AppScope.read(context);
    final nav = Navigator.of(context);
    try {
      await state.completeRegistration(token);
      if (!mounted) return;
      // Ildizgacha: tagda `_Root` turibdi va u endi `Shell` ni
      // chizadi.
      nav.popUntil((r) => r.isFirst);
    } catch (e) {
      // XATO KO'RINISHI SHART. Ilgari u `_error` ga yozilardi,
      // lekin muvaffaqiyat ekrani uni umuman ko'rsatmasdi — natijada
      // aylanuvchi belgi abadiy qolardi.
      if (mounted) setState(() => _finishError = humanError(e));
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
        setState(() => _error = tr('Hozir kod yuborib bo‘lmayapti. Birozdan so‘ng urining.'));
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
    if (_done) {
      return _Success(
        email: widget.email,
        error: _finishError,
        onRetry: _finishError == null || _token == null
            ? null
            : () {
                setState(() => _finishError = null);
                _finish(_token!);
              },
      );
    }

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
                _expired ? tr('Kod muddati\ntugadi') : tr('Emailingizni\ntasdiqlang'),
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
                      tr('Qayta yuborish'),
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
                tr('Tasdiqlash'),
                loading: _busy,
                onTap: _busy || _code.text.length != 6 ? null : _verify,
              ),
              const SizedBox(height: S.x12),
              GhostButton(tr('Emailni o‘zgartirish'), onTap: () => Navigator.of(context).maybePop()),
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
  const _Success({required this.email, this.error, this.onRetry});
  final String email;

  /// Hisob yaratildi, lekin sessiya ochilmadi. `null` — hammasi
  /// joyida, kutish davom etmoqda.
  final String? error;
  final VoidCallback? onRetry;

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
                Text(tr('Email\ntasdiqlandi'), style: T.display),
                const SizedBox(height: S.x12),
                Text(
                  tr('Akkauntingiz tayyor. Endi NFC ID tanlab, profilingizni ') +
                  tr('to‘ldirishingiz mumkin.'),
                  style: T.body,
                ),
                const SizedBox(height: S.x24),
                Surface(
                  child: Row(
                    children: [
                      Container(
                        width: 26, height: 26,
                        decoration: const BoxDecoration(color: C.verdant, shape: BoxShape.circle),
                        child: Center(
                          child: NIcon(Ico.check, size: 15, color: C.obsidian),
                        ),
                      ),
                      const SizedBox(width: S.x12),
                      Expanded(child: Text(AppUser.mask(email), style: T.meta.copyWith(color: C.offWhite))),
                    ],
                  ),
                ),
                SizedBox(height: S.x12),
                Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tr('Profilni tasdiqlash — keyinroq'), style: T.cardTitle),
                      SizedBox(height: 5),
                      Text(
                        tr('Telegram bot orqali profilingizni tasdiqlab, tasdiqlangan ') +
                        tr('nishonga ega bo‘lasiz.'),
                        style: T.caption,
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                // KUTISH YOKI XATO — HECH QACHON IKKALASI HAM EMAS.
                //
                // Ilgari bu yerda faqat aylanuvchi belgi turardi va
                // sessiya ochilmasa u abadiy aylanardi: odam nima
                // bo'lganini bilmasdi, ortga ham qaytolmasdi.
                if (error == null)
                  const Center(child: Spinner())
                else ...[
                  Text(error!,
                      textAlign: TextAlign.center,
                      style: T.caption.copyWith(color: C.signal)),
                  const SizedBox(height: S.x12),
                  PrimaryButton(tr('Davom etish'), onTap: onRetry),
                  const SizedBox(height: S.x8),
                  Text(
                    tr('Hisobingiz yaratildi. Agar davom etmasa, '
                        'kirish sahifasidan kiring.'),
                    textAlign: TextAlign.center,
                    style: T.caption.copyWith(fontSize: 12.5),
                  ),
                ],
                const SizedBox(height: S.x32),
              ],
            ),
          ),
        ),
      );
}
