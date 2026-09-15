import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../../design/components/sheet.dart';
import '../../design/nav.dart';
import '../business/create_company.dart';

/// HISOB TASDIQLASH — EMAIL.
///
/// Bu PROFIL tasdiqlash EMAS. Ikkisi butunlay boshqa narsa va UI da
/// hech qachon birlashtirilmaydi:
///   hisob  — email, ro'yxatdan o'tishda bir marta (shu ekran);
///   profil — mavjud Telegram bot, Sozlamalar → Tasdiqlash.
///
/// Barcha holatlar shu yerda: yuklanish, kod xato, muddati tugagan,
/// offline, muvaffaqiyat.
///
/// ASOSIY TUGMA YOPISHGAN PANELDA: kod maydoni raqamli klaviaturani
/// ochadi va tugma uning ostida qolib ketmasligi kerak.
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

      // SHAXSIY YOKI BIZNES — DARHOL SO'RALADI.
      //
      // Egasi: "biznes profilmi yo shaxsiy profil ochishini
      // boshidan bilishi kerak". Ilgari bunday savol umuman yo'q
      // edi: hamma shaxsiy profil bilan boshlanardi va biznes
      // profil ochish yo'li faqat shaxs almashtirgich ichida
      // yashiringan edi — yangi odam uni topmasdi.
      //
      // Hisob turi O'ZGARMAYDI va o'zgartirib ham bo'lmaydi:
      // serverda biznes profil hisobga BIRIKTIRILADI, ya'ni avval
      // hisob, keyin kompaniya. Shuning uchun bu savol hisob
      // turini emas, KEYINGI QADAMNI hal qiladi — soxta tanlov
      // ko'rsatmaymiz.
      if (!mounted) return;
      final wantsBusiness = await showSheet<bool>(
        context,
        title: tr('Qanday profil ochasiz?'),
        subtitle: tr('Keyin ikkalasini ham qo‘shishingiz mumkin.'),
        child: Column(
          children: [
            SheetAction(
              label: tr('Shaxsiy profil'),
              icon: Ico.user,
              subtitle: tr('Ism, kontaktlar, havolalar'),
              onTap: () => Navigator.of(context).pop(false),
            ),
            SheetAction(
              label: tr('Biznes profil'),
              icon: Ico.building,
              subtitle: tr('Katalog, ish vaqti, galereya, buyurtmalar'),
              onTap: () => Navigator.of(context).pop(true),
            ),
          ],
        ),
      );
      if (wantsBusiness == true && mounted) {
        await push<void>(context, (_) => const CreateCompanyScreen());
      }
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
    // "0:42" — daqiqa nol bilan to'ldirilmaydi, mono shriftda
    // raqamlar baribir tekis turadi.
    final clock = '${_left ~/ 60}:${(_left % 60).toString().padLeft(2, '0')}';

    return ScreenBackdrop(
      aura: Aura.none,
      // Pastki xavfsiz maydonni `StickyBar` ning o'zi hisobga oladi.
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: Column(
            children: [
              const TopBar(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x12,
                    S.gutter,
                    S.x24,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        _expired
                            ? tr('Kod muddati\ntugadi')
                            : tr('Emailni\ntasdiqlang'),
                        style: T.display,
                      ),
                      const SizedBox(height: S.x12),
                      Text(
                        _expired
                            ? '${tr('Kod 10 daqiqa amal qiladi. Yangi kod so‘rang:')} $masked'
                            : '${tr('6 xonali kod yubordik:')} $masked',
                        style: T.body,
                      ),
                      const SizedBox(height: S.x32),
                      CodeField(
                        controller: _code,
                        hasError: (_error != null) && !_expired,
                        onCompleted: (_) => _verify(),
                        onChanged: (_) => setState(() {}),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: S.x16),
                        _ErrorNote(message: _error!, expired: _expired),
                      ],
                      const SizedBox(height: S.x24),
                      // QAYTA YUBORISH — kutish vaqti MONO yozuvda
                      // ko'rinadi, ya'ni raqam sanashda sakramaydi.
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(tr('Kod kelmadimi?'), style: T.caption),
                          const SizedBox(height: S.x4),
                          if (_resending)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: S.x12),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Spinner(size: 16),
                              ),
                            )
                          else if (_left > 0)
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: S.x12,
                              ),
                              child: Text(
                                '${tr('QAYTA YUBORISH')} · $clock',
                                style: T.statusLabel.copyWith(color: C.ink3),
                              ),
                            )
                          else
                            Align(
                              alignment: Alignment.centerLeft,
                              child: GhostButton(
                                tr('Qayta yuborish'),
                                size: BtnSize.s,
                                onTap: _resend,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              StickyBar(
                child: PrimaryButton(
                  tr('Tasdiqlash'),
                  loading: _busy,
                  onTap: _busy || _code.text.length != 6 ? null : _verify,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// XATO
// ─────────────────────────────────────────────────────────────

/// Xato — BELGI, matn va keyingi qadam.
///
/// Faqat qizil chegara yetmaydi: odam nima qilishini bilishi kerak,
/// shuning uchun spam papkasi haqidagi maslahat xatoning ichida
/// turadi.
class _ErrorNote extends StatelessWidget {
  const _ErrorNote({required this.message, required this.expired});

  final String message;
  final bool expired;

  @override
  Widget build(BuildContext context) => Surface(
        color: C.fail.withValues(alpha: .10),
        border: Border.all(color: C.fail.withValues(alpha: .38)),
        padding: const EdgeInsets.all(S.x12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NIcon(Ico.warning, size: 16, color: C.fail),
            const SizedBox(width: S.x8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message,
                    style: T.caption.copyWith(color: C.fail, fontSize: 13),
                  ),
                  if (!expired) ...[
                    const SizedBox(height: 3),
                    Text(
                      tr('Spam papkasini ham tekshiring.'),
                      style: T.caption.copyWith(fontSize: 12.5),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// MUVAFFAQIYAT
// ─────────────────────────────────────────────────────────────

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
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.center,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Spacer(),
                Text(tr('Email\ntasdiqlandi'), style: T.display),
                const SizedBox(height: S.x12),
                Text(
                  tr('Akkauntingiz tayyor. Endi NFC ID tanlab, profilingizni '
                      'to‘ldirishingiz mumkin.'),
                  style: T.body,
                ),
                const SizedBox(height: S.x24),
                Surface(
                  child: Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: C.ok.withValues(alpha: .16),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: C.ok.withValues(alpha: .5),
                          ),
                        ),
                        child: Center(
                          child: NIcon(Ico.check, size: 15, color: C.ok),
                        ),
                      ),
                      const SizedBox(width: S.x12),
                      Expanded(
                        child: Text(
                          AppUser.mask(email),
                          style: T.meta.copyWith(color: C.ink),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: S.x12),
                Surface(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              tr('Profilni tasdiqlash — keyinroq'),
                              style: T.cardTitle,
                            ),
                          ),
                          const SizedBox(width: S.x8),
                          StatusChip(
                            tr('Telegram bot'),
                            tone: StatusTone.neutral,
                          ),
                        ],
                      ),
                      const SizedBox(height: 5),
                      Text(
                        tr('Telegram bot orqali profilingizni tasdiqlab, tasdiqlangan '
                            'nishonga ega bo‘lasiz.'),
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
                  _ErrorNote(message: error!, expired: true),
                  const SizedBox(height: S.x16),
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
