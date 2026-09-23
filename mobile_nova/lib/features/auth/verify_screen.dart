import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/errors/app_error.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import 'session.dart';

class VerifyArgs {
  const VerifyArgs({
    required this.email,
    this.name = '',
    this.phone = '',
    this.password = '',
    this.channel = '',
    this.tosAccepted = false,
    this.promoCode = '',
  });

  final String email;

  /// Kod QAYSI KANAL orqali ketgani — serverdan kelgan `channel`.
  ///
  /// Ekran shunga qarab haqiqatni yozadi. Ilgari u har doim
  /// "emailingizga yuborildi" derdi, kod esa Telegram botiga
  /// ketgan yoki umuman yuborilmagan bo'lishi mumkin edi.
  final String channel;

  /// RO'YXATDAN O'TISHNI YAKUNLASH uchun.
  ///
  /// Backend hisobni BITTA so'rovda yaratadi:
  ///
  ///     POST /api/auth/register {email, code, password, phone, ...}
  ///
  /// Ya'ni kod tasdiqlangandan keyin yana parol so'rash shart emas —
  /// u shu yerga birinchi qadamdan olib kelinadi. Faqat xotirada
  /// turadi, hech qayerga saqlanmaydi.
  final String name;
  final String phone;
  final String password;

  /// Odam ofertaga rozilik berganmi — ro'yxatdan o'tish ekranidan
  /// shu yerga olib kelinadi. Server buni MAJBURIY tekshiradi.
  final bool tosAccepted;

  /// Do'stning promokodi (ixtiyoriy) — hisob shu yerda yaratiladi.
  final String promoCode;
}

/// Email tasdiqlash ekrani — kod kiritish, sanoq, qayta yuborish,
/// noto'g'ri kod, muddati tugagan kod va emailni almashtirish.
class VerifyScreen extends ConsumerStatefulWidget {
  const VerifyScreen({super.key, required this.args});

  final VerifyArgs args;

  /// Testlar uchun — qayta yuborish oralig'i (soniya).
  static const resendCooldownForTest = _VerifyScreenState.resendCooldown;

  @override
  ConsumerState<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends ConsumerState<VerifyScreen> {
  /// Kod amal qilish muddati, soniyada.
  ///
  /// QIYMAT SERVERDAN OLINGAN: `hosting/api/auth.js` dagi
  /// `REGISTER_OTP_TTL_MS = 5 * 60 * 1000`. Emailda ham odamga
  /// aynan "Kod 5 daqiqa ichida amal qiladi" deb yoziladi.
  ///
  /// ILGARI BU YERDA 120 TURARDI va bu haqiqiy nosozlik edi:
  /// odam kodni ko'rish uchun pochtaga o'tib, ikki daqiqadan
  /// keyin qaytsa, sanoq allaqachon tugagan bo'lardi. Sanoq
  /// tugaganda maydon o'chadi (`enabled: !_busy && !_expired`),
  /// ya'ni SERVER HALI QABUL QILADIGAN kodni yozib bo'lmasdi —
  /// ekran qotib qolganday ko'rinardi. Ikki qiymat bir xil
  /// turishini `verify_ttl_test.dart` qo'riqlaydi.
  static const _ttl = 300;

  /// Qayta yuborish oralig'i — KOD MUDDATIDAN ALOHIDA.
  ///
  /// Ilgari "Qayta yuborish" tugmasi faqat 5 daqiqalik muddat TUGAGACH
  /// chiqardi. Email kechiksa yoki spam papkaga tushsa, odam besh
  /// daqiqa hech narsa qila olmay o'tirardi. Endi 60 soniyadan keyin
  /// yangi kod so'rash mumkin; eski kod esa o'z muddatigacha ishlaydi.
  static const resendCooldown = 60;

  Timer? _timer;
  int _left = _ttl;
  int _resendLeft = resendCooldown;
  bool _busy = false;
  bool _wrong = false;
  bool _expired = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  void _startCountdown() {
    _timer?.cancel();
    setState(() {
      _left = _ttl;
      _resendLeft = resendCooldown;
      _expired = false;
    });
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() {
        _left--;
        if (_resendLeft > 0) _resendLeft--;
        if (_left <= 0) {
          _expired = true;
          t.cancel();
        }
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _verify(String code) async {
    if (_expired) return;
    final l = L.of(context);
    setState(() {
      _busy = true;
      _wrong = false;
      _error = null;
    });

    // RO'YXATDAN O'TISH va KIRISH ikki xil yo'l.
    //
    // Ilgari ikkalasi ham `verifyEmailCode` ni chaqirardi va u
    // `/api/auth/verify-email-code` ga borardi — SERVERDA BUNDAY
    // YO'L YO'Q. Ya'ni yangi foydalanuvchi ro'yxatdan o'ta olmasdi:
    // kod so'rash ham, tasdiqlash ham 404 qaytarardi.
    //
    // Serverdagi haqiqiy shartnoma (`hosting/api/auth.js`):
    //
    //     POST /api/auth/request-register-code {email}|{phone}
    //     POST /api/auth/register {email, code, password, phone, ...}
    //
    // Repozitoriyada bu ikkisi ALLAQACHON to'g'ri yozilgan edi
    // (`requestRegisterCode`, `register`), lekin ekran ularni
    // chaqirmasdi.
    final res = await ref.read(authRepositoryProvider).register(
          name: widget.args.name,
          email: widget.args.email,
          phone: widget.args.phone,
          password: widget.args.password,
          code: code,
          tosAccepted: widget.args.tosAccepted,
          promoCode: widget.args.promoCode,
        );
    if (!mounted) return;
    setState(() => _busy = false);

    await res.when(
      ok: (user) async {
        await ref.read(sessionProvider.notifier).adopt(user);
        if (!mounted) return;
        context.go(Routes.profileSetup);
      },
      err: (e) async {
        setState(() {
          // Noto'g'ri kod maydonni qizartiradi; boshqa xatolar esa
          // yo'lakcha bo'lib chiqadi — ular kodga aloqador emas.
          // `email_code_required` ham AYNAN shu maydonga tegishli:
          // server kodni umuman ololmaganini aytadi. Ilgari u
          // ro'yxatda yo'q edi va xato yo'lakcha bo'lib chiqardi —
          // odam qaysi maydon aybdor ekanini bilmasdi.
          _wrong = e.code == 'bad_code' ||
              e.code == 'bad_email_code' ||
              e.code == 'email_code_required';
          _error = _wrong ? null : describeError(l, e);
        });
      },
    );
  }

  Future<void> _resend() async {
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
      _wrong = false;
    });
    // Qayta yuborish ham maqsadga qarab: ro'yxatdan o'tishda
    // `request-register-code`, kirishda esa email kodi.
    final res = await ref.read(authRepositoryProvider).requestRegisterCode(
          email: widget.args.email,
          phone: widget.args.phone,
        );
    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (_) => _startCountdown(),
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return NovaScaffold(
      showBack: true,
      body: NovaScroll(
        padding: const EdgeInsets.fromLTRB(Gap.xxl, Gap.lg, Gap.xxl, Gap.section),
        children: [
          Center(
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: (_expired ? t.warn : t.accent2).withValues(alpha: .13),
                shape: BoxShape.circle,
                border: Border.all(
                    color: (_expired ? t.warn : t.accent2).withValues(alpha: .32)),
              ),
              child: Icon(
                _expired ? Icons.timer_off_rounded : Icons.mark_email_unread_rounded,
                size: 29,
                color: _expired ? t.warn : t.accent2,
              ),
            ),
          ),
          const SizedBox(height: Gap.xl),
          Text(
            _expired ? l.verifyExpired : (_wrong ? l.verifyWrongCode : l.verifyTitle),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  color: _wrong ? t.error : t.text1,
                ),
          ),
          const SizedBox(height: Gap.sm),
          Text(
            _expired
                ? l.verifyExpiredHint
                : (_wrong
                    ? l.verifyWrongCodeHint
                    : switch (widget.args.channel) {
                        'telegram' => l.verifySentTelegram,
                        'email' => l.verifySentTo(widget.args.email),
                        // Bo'sh yoki `none` — server kodni HECH
                        // QAYERGA yubormagan. Soxta va'da berilmaydi.
                        _ => l.verifyNoChannel,
                      }),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: Gap.section),
          CodeField(
            onCompleted: _verify,
            hasError: _wrong,
            enabled: !_busy && !_expired,
          ),
          if (_error != null) ...[
            const SizedBox(height: Gap.xl),
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: Gap.lg, vertical: Gap.md),
              decoration: BoxDecoration(
                color: t.error.withValues(alpha: .12),
                borderRadius: R.gentle,
                border: Border.all(color: t.error.withValues(alpha: .35)),
              ),
              child: Text(
                _error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Manrope',
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: t.error,
                ),
              ),
            ),
          ],
          const SizedBox(height: Gap.xxl),
          if (_busy)
            Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: t.accent2),
              ),
            )
          else if (_expired || _left <= 0 || _resendLeft <= 0)
            NovaButton(
              key: const ValueKey('verify-resend'),
              label: l.verifyResend,
              tone: _expired ? ButtonTone.accent : ButtonTone.outline,
              onPressed: _resend,
            )
          else
            Center(
              child: Text(
                l.verifyResendIn(_resendLeft),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          const SizedBox(height: Gap.xl),
          Center(
            child: PressableScale(
              onTap: () => context.pop(),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                child: Text(
                  l.verifyChangeEmail,
                  style: TextStyle(
                    fontFamily: 'Manrope',
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: t.accent2,
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

/// `AppError` dan "backend hali tayyor emas" ekanini aniqlash — UI
/// shunga qarab boshqa matn ko'rsatadi.
bool isEndpointMissing(AppError e) => e.kind == AppErrorKind.endpointMissing;
