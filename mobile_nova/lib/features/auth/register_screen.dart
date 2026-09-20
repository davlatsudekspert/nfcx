import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/utils/external_link.dart';
import '../../core/utils/validators.dart';
import '../../design/theme/typography.dart';
import '../../design/motion/motion.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import 'session.dart';
import 'verify_screen.dart';

/// Ro'yxatdan o'tish — Ism → Email → Telefon → Parol → Tasdiqlash.
///
/// Bitta uzun formadan ko'ra to'rt qadam tanlandi: har qadamda bitta
/// savol bo'lgani uchun klaviatura ochilganda ham maydon ko'rinib
/// turadi va xato aynan qaysi maydonga tegishli ekani aniq.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  static const _steps = 4;

  final _page = PageController();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _password2 = TextEditingController();

  int _step = 0;
  bool _busy = false;

  /// OMMAVIY OFERTAGA ROZILIK.
  ///
  /// Server buni MAJBURIY deb tekshiradi (`tosAccepted !== true` ->
  /// 422). Ilova esa uni repozitoriyda QOTIRIB `true` yuborardi,
  /// ya'ni odam ko'rmagan shartga uning nomidan rozilik yozilardi.
  /// Bu huquqiy jihatdan ham, Google Play talablari bo'yicha ham
  /// noto'g'ri. Endi qiymat shu yerdan, odamning o'zidan keladi.
  bool _tos = false;
  bool _obscure = true;
  String? _error;
  final _fieldErrors = <int, String?>{};

  @override
  void dispose() {
    _page.dispose();
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    _password2.dispose();
    super.dispose();
  }

  String _tr(String key) {
    final l = L.of(context);
    return switch (key) {
      'errRequired' => l.errRequired,
      'errBadEmail' => l.errBadEmail,
      'errBadPhone' => l.errBadPhone,
      'errPasswordShort' => l.errPasswordShort,
      'errNameShort' => l.errNameShort,
      _ => l.errUnknown,
    };
  }

  String? _validateStep() {
    final key = switch (_step) {
      0 => Validate.name(_name.text),
      1 => Validate.email(_email.text),
      2 => Validate.phone(_phone.text),
      _ => Validate.password(_password.text),
    };
    if (key != null) return _tr(key);
    if (_step == 3 && _password.text != _password2.text) {
      return L.of(context).errPasswordMismatch;
    }
    // Rozilik belgilanmagan bo'lsa serverning o'zi 422 qaytaradi.
    // Uni shu yerda ushlash aniqroq: odam qaysi qadamda nima
    // qilishi kerakligini darhol ko'radi.
    if (_step == _steps - 1 && !_tos) {
      return L.of(context).registerTosRequired;
    }
    return null;
  }

  Future<void> _next() async {
    final err = _validateStep();
    setState(() {
      _fieldErrors[_step] = err;
      _error = null;
    });
    if (err != null) return;

    if (_step < _steps - 1) {
      setState(() => _step++);
      _page.animateToPage(_step, duration: Motion.med, curve: Motion.smooth);
      return;
    }
    await _submit();
  }

  void _back() {
    if (_step == 0) return context.pop();
    setState(() => _step--);
    _page.animateToPage(_step, duration: Motion.med, curve: Motion.smooth);
  }

  Future<void> _submit() async {
    final l = L.of(context);
    setState(() => _busy = true);

    // Texnik topshiriq: email tasdiqlanmaguncha ro'yxatdan o'tish
    // YAKUNLANMAYDI. Shuning uchun avval kod so'raladi, hisob esa
    // faqat kod tasdiqlangach yaratiladi.
    // SERVERDAGI HAQIQIY YO'L.
    //
    // Ilgari `requestEmailCode` chaqirilardi va u
    // `/api/auth/request-email-code` ga borardi — bunday yo'l
    // serverda YO'Q. Ya'ni ro'yxatdan o'tish birinchi qadamdayoq
    // 404 bilan to'xtardi va yangi foydalanuvchi ilovaga kira
    // olmasdi.
    final res = await ref.read(authRepositoryProvider).requestRegisterCode(
          email: _email.text.trim(),
          phone: Validate.normalizePhone(_phone.text),
        );
    if (!mounted) return;
    setState(() => _busy = false);

    res.when(
      ok: (channel) => context.push(
        Routes.registerVerify,
        // Hisob BITTA so'rovda yaratiladi (`POST /api/auth/register`),
        // shuning uchun parol va telefon kod ekraniga olib boriladi.
        // Faqat xotirada — hech qayerga saqlanmaydi.
        extra: VerifyArgs(
          email: _email.text.trim(),
          name: _name.text.trim(),
          phone: Validate.normalizePhone(_phone.text),
          password: _password.text,
          // Kod qaysi kanal orqali ketgani — kod ekrani shunga
          // qarab HAQIQATNI yozadi. Ilgari u har doim
          // "emailingizga yuborildi" derdi.
          channel: channel,
          // Rozilik kod ekraniga olib boriladi: hisob AYNAN
          // o'sha yerda yaratiladi va server `tosAccepted` ni
          // shu so'rovda kutadi.
          tosAccepted: _tos,
        ),
      ),
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return NovaScaffold(
      showBack: true,
      onBack: _back,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.xxl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.registerStep(_step + 1, _steps),
                    style: Theme.of(context).textTheme.labelSmall),
                const SizedBox(height: Gap.sm),
                // Qadam ko'rsatkichi — to'rtta segment.
                Row(
                  children: List.generate(_steps, (i) {
                    final done = i <= _step;
                    return Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(right: i == _steps - 1 ? 0 : 5),
                        child: AnimatedContainer(
                          duration: Motion.med,
                          curve: Motion.smooth,
                          height: 3.5,
                          decoration: BoxDecoration(
                            color: done ? t.accent2 : t.border2,
                            borderRadius: R.pill,
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ],
            ),
          ),
          Expanded(
            child: PageView(
              controller: _page,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                _Step(
                  title: l.registerTitle,
                  hint: l.registerNameHint,
                  child: NovaField(
                    label: l.fieldName,
                    controller: _name,
                    error: _fieldErrors[0],
                    textCapitalization: TextCapitalization.words,
                    enabled: !_busy,
                  ),
                ),
                _Step(
                  title: l.fieldEmail,
                  hint: l.registerEmailHint,
                  child: NovaField(
                    label: l.fieldEmail,
                    controller: _email,
                    error: _fieldErrors[1],
                    keyboardType: TextInputType.emailAddress,
                    hint: 'siz@example.com',
                    enabled: !_busy,
                  ),
                ),
                _Step(
                  title: l.fieldPhone,
                  hint: l.registerPhoneHint,
                  child: PhoneField(
                    label: l.fieldPhone,
                    controller: _phone,
                    error: _fieldErrors[2],
                  ),
                ),
                _Step(
                  title: l.fieldPassword,
                  hint: l.registerPasswordHint,
                  child: Column(
                    children: [
                      NovaField(
                        label: l.fieldPassword,
                        controller: _password,
                        error: _fieldErrors[3],
                        obscure: _obscure,
                        enabled: !_busy,
                        suffix: IconButton(
                          tooltip: _obscure ? l.a11yShowPassword : l.a11yHidePassword,
                          onPressed: () => setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_off_rounded
                                : Icons.visibility_rounded,
                            size: 19,
                            color: t.text3,
                          ),
                        ),
                      ),
                      const SizedBox(height: Gap.lg),
                      NovaField(
                        label: l.fieldPasswordRepeat,
                        controller: _password2,
                        obscure: _obscure,
                        enabled: !_busy,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Gap.xxl, 0, Gap.xxl, Gap.xxl),
            child: Column(
              children: [
                if (_error != null) ...[
                  Container(
                    width: double.infinity,
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
                  const SizedBox(height: Gap.lg),
                ],
                if (_step == _steps - 1) ...[
                  _TosRow(
                    value: _tos,
                    onChanged: (v) => setState(() {
                      _tos = v;
                      _fieldErrors[_step] = null;
                    }),
                  ),
                  const SizedBox(height: Gap.md),
                ],
                NovaButton(
                  label: _step == _steps - 1 ? l.actionContinue : l.actionNext,
                  busy: _busy,
                  onPressed: _next,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.title, required this.hint, required this.child});

  final String title;
  final String hint;
  final Widget child;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Gap.xxl, Gap.section, Gap.xxl, Gap.xl),
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.displayMedium),
            const SizedBox(height: Gap.sm),
            Text(hint, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: Gap.section),
            child,
          ],
        ),
      );
}

/// OFERTAGA ROZILIK QATORI.
///
/// Matnning "ommaviy oferta" qismi bosilsa sayt ochiladi. Havola
/// sayt BOSH sahifasiga boradi: alohida oferta sahifasining aniq
/// yo'li tekshirib tasdiqlanmagan va mavjud bo'lmagan manzilga
/// yuborish roziliksiz qoldirishdan ham yomon bo'lardi.
class _TosRow extends StatelessWidget {
  const _TosRow({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 26,
          height: 26,
          child: Checkbox(
            value: value,
            onChanged: (v) => onChanged(v ?? false),
            activeColor: t.accent2,
            checkColor: t.onAccent,
            side: BorderSide(color: t.border2, width: 1.4),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(7),
            ),
          ),
        ),
        const SizedBox(width: Gap.md),
        Expanded(
          child: GestureDetector(
            onTap: () => onChanged(!value),
            child: Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text.rich(
                TextSpan(
                  text: l.registerTosPrefix,
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    height: 1.45,
                    color: t.text2,
                  ),
                  children: [
                    TextSpan(
                      text: l.registerTosLink,
                      style: TextStyle(
                        color: t.accent2,
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.underline,
                        decorationColor: t.accent2.withValues(alpha: .5),
                      ),
                      recognizer: TapGestureRecognizer()
                        ..onTap = () => openLink(kApiBase),
                    ),
                    TextSpan(text: l.registerTosSuffix),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
