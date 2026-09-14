import 'dart:async';

import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
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

/// PAROLNI TIKLASH — ikki qadam: kod so'rash, keyin yangi parol.
///
/// SERVER HISOB BOR-YO'QLIGINI OSHKOR QILMAYDI: `request-password-reset`
/// har doim `{ok:true}` qaytaradi. Shuning uchun ilova ham "kod
/// yuborildi" deb yozadi va boshqa hech narsa aytmaydi — aks holda
/// begona odam shu ekran orqali qaysi email ro'yxatda borligini
/// tekshirib chiqishi mumkin bo'lardi.
///
/// IKKINCHI YO'L — TELEFON. Endpoint bitta va u login satrini
/// oladi: email o'rniga telefon raqami yozilsa, kod Telegram bot
/// orqali keladi. Shuning uchun "telefon orqali" alohida ekran emas,
/// SHU maydonning boshqa rejimi.
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

  /// Telefon rejimi — maydonning yorlig'i va klaviaturasi almashadi.
  /// Serverga baribir o'sha bitta satr ketadi.
  bool _byPhone = false;

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
      setState(() => _error = tr('Email yoki telefon raqamini kiriting.'));
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
            ? tr('Juda ko‘p urinish. Birozdan so‘ng qayta urining.')
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
      setState(() => _error = tr('Kodni to‘liq kiriting.'));
      return;
    }
    if (_password.text.length < 6) {
      setState(() => _error = tr('Parol kamida 6 belgi bo‘lsin.'));
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
            ? tr('Kod xato yoki muddati tugagan.')
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
    if (_done) return _Done(onTap: () => Navigator.of(context).pop());

    return ScreenBackdrop(
      aura: Aura.none,
      child: SafeArea(
        child: Padding(
          // Asosiy tugma klaviatura ostida qolmaydi.
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: Column(
            children: [
              const TopBar(),
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ScreenTitle(
                        tr('Parolni tiklash'),
                        subtitle: tr('Tiklash kodi email manzilingizga '
                            'yuboriladi. Email ochilmasa — telefon raqamingiz '
                            'orqali Telegram botdan kod olasiz.'),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          S.gutter,
                          S.x8,
                          S.gutter,
                          S.x32,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: _sent ? _codeStep() : _requestStep(),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── 1-QADAM: kod so'rash ───────────────────────────────────

  List<Widget> _requestStep() => [
        Field(
          label: _byPhone ? tr('Telefon') : tr('Email'),
          controller: _login,
          hint: _byPhone ? '+998 90 123 45 67' : 'ism@gmail.com',
          keyboardType:
              _byPhone ? TextInputType.phone : TextInputType.emailAddress,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _request(),
          error: _error,
        ),
        const SizedBox(height: S.x24),
        PrimaryButton(
          _byPhone ? tr('Kod olish') : tr('Kodni yuborish'),
          loading: _busy,
          onTap: _busy ? null : _request,
        ),
        const SizedBox(height: S.x32),
        // IKKINCHI YO'L — alohida karta. Email ochilmasa odam
        // boshi berk ko'chada qolmaydi.
        if (!_byPhone)
          _PhonePath(
            onTap: () => setState(() {
              _byPhone = true;
              _error = null;
            }),
          ),
      ];

  // ── 2-QADAM: kod va yangi parol ────────────────────────────

  List<Widget> _codeStep() => [
        // YUBORILDI — yashil belgi bilan.
        Surface(
          color: C.ok.withValues(alpha: .09),
          border: Border.all(color: C.ok.withValues(alpha: .34)),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: C.ok.withValues(alpha: .16),
                  shape: BoxShape.circle,
                  border: Border.all(color: C.ok.withValues(alpha: .5)),
                ),
                child: Center(
                  child: NIcon(Ico.check, size: 16, color: C.ok),
                ),
              ),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tr('Kod yuborildi'), style: T.cardTitle),
                    const SizedBox(height: 4),
                    Text(
                      tr('Pochtangizni tekshiring. Kod bir marta ishlaydi.'),
                      style: T.caption,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: S.x20),
        Field(
          label: _byPhone ? tr('Telefon') : tr('Email'),
          controller: _login,
          hint: _byPhone ? '+998 90 123 45 67' : 'ism@gmail.com',
          keyboardType:
              _byPhone ? TextInputType.phone : TextInputType.emailAddress,
          enabled: false,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: S.x20),
        Eyebrow(tr('Kod')),
        const SizedBox(height: 7),
        Text(
          tr('Agar bu hisob mavjud bo‘lsa, unga 6 xonali kod ') +
              tr('yuborildi. Kod 10 daqiqa amal qiladi.'),
          style: T.caption,
        ),
        const SizedBox(height: S.x12),
        CodeField(controller: _code, hasError: _error != null),
        const SizedBox(height: S.x16),
        Field(
          label: tr('Yangi parol'),
          controller: _password,
          hint: '••••••••',
          obscure: true,
          helper: tr('Kamida 6 belgi'),
          error: _error,
          keyboardType: TextInputType.visiblePassword,
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => _reset(),
        ),
        const SizedBox(height: S.x24),
        PrimaryButton(
          tr('Parolni yangilash'),
          loading: _busy,
          onTap: _busy ? null : _reset,
        ),
        const SizedBox(height: S.x8),
        Center(
          // Kutish vaqti MONO yozuvda — raqam sanashda sakramaydi.
          child: _left > 0
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: S.x12),
                  child: Text(
                    '${tr('QAYTA YUBORISH')} · 0:${_left.toString().padLeft(2, '0')}',
                    style: T.statusLabel.copyWith(color: C.ink3),
                  ),
                )
              : GhostButton(
                  tr('Qayta yuborish'),
                  size: BtnSize.s,
                  onTap: _busy ? null : _request,
                ),
        ),
      ];
}

// ─────────────────────────────────────────────────────────────
// TELEFON YO'LI
// ─────────────────────────────────────────────────────────────

/// Ikkinchi yo'l kartasi — Telegram bot orqali.
class _PhonePath extends StatelessWidget {
  const _PhonePath({required this.onTap});

  /// Maydonni telefon rejimiga o'tkazadi.
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Surface(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(tr('Telefon orqali tiklash'), style: T.cardTitle),
                ),
                const SizedBox(width: S.x8),
                StatusChip(tr('Telegram bot'), tone: StatusTone.neutral),
              ],
            ),
            const SizedBox(height: S.x8),
            Text(
              tr('Email ochilmasa, profilingizga ulangan telefon raqamini '
                  'kiriting — kod Telegram botga keladi. Bot Sozlamalarda bir '
                  'marta ulanadi.'),
              style: T.caption,
            ),
            const SizedBox(height: S.x16),
            SecondaryButton(
              tr('Telefon orqali davom etish'),
              icon: Ico.telegram,
              size: BtnSize.m,
              onTap: onTap,
            ),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// PAROL YANGILANDI
// ─────────────────────────────────────────────────────────────

class _Done extends StatelessWidget {
  const _Done({required this.onTap});

  final VoidCallback onTap;

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
                Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: C.ok.withValues(alpha: .14),
                      shape: BoxShape.circle,
                      border: Border.all(color: C.ok.withValues(alpha: .5)),
                    ),
                    child: Center(
                      child: NIcon(Ico.check, size: 26, color: C.ok),
                    ),
                  ),
                ),
                const SizedBox(height: S.x24),
                Text(tr('Parol\nyangilandi'), style: T.display),
                const SizedBox(height: S.x12),
                Text(
                  tr('Endi yangi parol bilan kirishingiz mumkin. Boshqa ') +
                      tr('qurilmalardagi ochiq sessiyalar yopildi.'),
                  style: T.body,
                ),
                const Spacer(),
                PrimaryButton(tr('Kirish'), onTap: onTap),
                const SizedBox(height: S.x32),
              ],
            ),
          ),
        ),
      );
}
