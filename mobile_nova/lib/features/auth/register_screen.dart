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
import 'signup_intent.dart';
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
  /// 0 — hisob turi, 1 — ism, 2 — email, 3 — telefon, 4 — parol.
  static const _steps = 5;

  final _page = PageController();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _password2 = TextEditingController();

  int _step = 0;

  /// Hisob turi — birinchi qadam. `null` bo'lsa oldinga o'tilmaydi:
  /// odam ongli tanlashi kerak, jimgina "shaxsiy" qo'yib yuborilmaydi.
  SignupAccountType? _type;
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
    if (_step == 0) {
      return _type == null ? L.of(context).registerTypeRequired : null;
    }
    final key = switch (_step) {
      1 => Validate.name(_name.text),
      2 => Validate.email(_email.text),
      3 => Validate.phone(_phone.text),
      _ => Validate.password(_password.text),
    };
    if (key != null) return _tr(key);
    if (_step == 4 && _password.text != _password2.text) {
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
      // KOD HECH QAYERGA YUBORILMAGAN — BOSHI BERK KO'CHA EDI.
      //
      // Server email xizmati o'chiq bo'lsa `channel: 'none'`
      // qaytaradi (`hosting/api/auth.js` -> `requestRegisterCode`).
      // Ilova esa baribir kod ekraniga olib borardi: odam hech
      // qachon kelmaydigan olti raqamni kutib o'tirardi va
      // ro'yxatdan o'ta olmasdi.
      //
      // Server QOIDASI YUMSHATILMAYDI. Aynan o'sha holatda
      // `POST /api/auth/register` ning O'ZI kod so'ramaydi
      // (`emailOn` false -> `email_code_required` tekshiruvi
      // umuman bajarilmaydi). Ya'ni bu yerda kodsiz davom etish —
      // serverning o'z qarorini bajarish, uni chetlab o'tish emas.
      ok: (channel) {
        if (channel == 'none' || channel.isEmpty) {
          _registerWithoutCode();
          return;
        }
        _goVerify(channel);
      },
      err: (e) {
        // BAND BO'LSA — O'SHA QADAMGA QAYTAMIZ (egasi, 2026-09 surat).
        //
        // Server endi email/telefon bandligini KOD YUBORISHDAN OLDIN
        // aytadi. Xato oxirgi (parol) qadamda emas, aynan tuzatish
        // kerak bo'lgan maydon ostida ko'rinadi.
        final back = switch (e.code) {
          'phone_taken' => 3,
          'email_taken' => 2,
          _ => null,
        };
        if (back == null) {
          setState(() => _error = describeError(l, e));
          return;
        }
        setState(() {
          _step = back;
          _fieldErrors[back] = describeError(l, e);
        });
        _page.animateToPage(back, duration: Motion.med, curve: Motion.smooth);
      },
    );
  }

  void _goVerify(String channel) {
    context.push(
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
    );
  }

  /// Email xizmati o'chiq bo'lgandagi yo'l: hisob DARHOL yaratiladi.
  ///
  /// Kod bo'sh yuboriladi. Agar ikki so'rov orasida email xizmati
  /// YOQILGAN bo'lsa, server `email_code_required` qaytaradi — o'shanda
  /// odatdagi kod ekraniga o'tamiz. Ya'ni tasdiqlash talabi hech
  /// qachon chetlab o'tilmaydi, qaror har doim serverniki.
  Future<void> _registerWithoutCode() async {
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(authRepositoryProvider).register(
          name: _name.text.trim(),
          email: _email.text.trim(),
          phone: Validate.normalizePhone(_phone.text),
          password: _password.text,
          code: '',
          tosAccepted: _tos,
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
        if (e.code == 'email_code_required' || e.code == 'bad_email_code') {
          _goVerify('email');
          return;
        }
        setState(() => _error = describeError(l, e));
      },
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
                  title: l.registerTypeTitle,
                  hint: l.registerTypeHint,
                  child: _TypePicker(
                    value: _type,
                    error: _fieldErrors[0],
                    onChanged: (v) {
                      setState(() {
                        _type = v;
                        _fieldErrors[0] = null;
                      });
                      ref.read(signupAccountTypeProvider.notifier).state = v;
                    },
                  ),
                ),
                _Step(
                  title: l.registerTitle,
                  hint: l.registerNameHint,
                  art: Icons.person_outline_rounded,
                  child: NovaField(
                    label: l.fieldName,
                    controller: _name,
                    error: _fieldErrors[1],
                    textCapitalization: TextCapitalization.words,
                    enabled: !_busy,
                  ),
                ),
                _Step(
                  title: l.fieldEmail,
                  hint: l.registerEmailHint,
                  art: Icons.mark_email_unread_outlined,
                  child: NovaField(
                    label: l.fieldEmail,
                    controller: _email,
                    error: _fieldErrors[2],
                    keyboardType: TextInputType.emailAddress,
                    hint: 'siz@example.com',
                    enabled: !_busy,
                  ),
                ),
                _Step(
                  title: l.fieldPhone,
                  hint: l.registerPhoneHint,
                  art: Icons.smartphone_rounded,
                  child: PhoneField(
                    label: l.fieldPhone,
                    controller: _phone,
                    error: _fieldErrors[3],
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
                        error: _fieldErrors[4],
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
  const _Step({
    required this.title,
    required this.hint,
    required this.child,
    this.art,
  });

  final String title;
  final String hint;
  final Widget child;

  /// Maydon ostidagi bo'sh joy uchun yengil bezak (egasi, 2026-09:
  /// "ekran o'rtasi bo'sh, biron rasm qo'ysa chiroyli tursa").
  final IconData? art;

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
            // Klaviatura ochiq bo'lsa bezak yashiriladi — joy maydonga.
            if (art != null && MediaQuery.viewInsetsOf(context).bottom == 0) ...[
              const SizedBox(height: 56),
              Center(child: _StepArt(icon: art!)),
            ],
          ],
        ),
      );
}

/// Qadam bezagi: ichma-ich yupqa halqalar, markazda belgi.
///
/// Rasm fayli emas — vektor: ilova hajmi o'smaydi, har mavzuda o'z
/// ranglarida chiziladi. Champagne faqat bitta ingichka halqada.
class _StepArt extends StatelessWidget {
  const _StepArt({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    Widget ring(double size, Color color, {Color? fill}) => Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: fill,
            border: Border.all(color: color, width: 1),
          ),
        );
    return ExcludeSemantics(
      child: SizedBox(
        width: 208,
        height: 208,
        child: Stack(
          alignment: Alignment.center,
          children: [
            ring(208, t.border1),
            ring(160, t.brandSoft),
            ring(112, t.border2, fill: t.surface),
            Icon(icon, size: 40, color: t.text2),
          ],
        ),
      ),
    );
  }
}

/// OFERTA VA SHAXSGA DOIR MA'LUMOTLARGA ROZILIK QATORI.
///
/// Bitta katak — uchta tasdiq: oferta shartlari (`/shartlar`),
/// maxfiylik siyosati bo'yicha ma'lumotni qayta ishlash (`/privacy`,
/// O'RQ-547) va 18 yoshga to'lganlik (Google Play UGC talabi).
/// Ikkala havola saytdagi mavjud sahifalarga ochiladi — to'lov
/// havolasi emas.
class _TosRow extends StatelessWidget {
  const _TosRow({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final link = TextStyle(
      color: t.accent2,
      fontWeight: FontWeight.w600,
      decoration: TextDecoration.underline,
      decorationColor: t.accent2.withValues(alpha: .5),
    );
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
                      style: link,
                      recognizer: TapGestureRecognizer()
                        ..onTap = () => openLink('$kApiBase/shartlar'),
                    ),
                    TextSpan(text: l.registerTosSuffix),
                    // O'RQ-547 "Shaxsga doir ma'lumotlar to'g'risida":
                    // ma'lumotni qayta ishlashga ALOHIDA, aniq rozilik
                    // va u qaysi hujjat asosida ekani ko'rinishi kerak.
                    TextSpan(
                      text: l.registerPrivacyLink,
                      style: link,
                      recognizer: TapGestureRecognizer()
                        ..onTap = () => openLink('$kApiBase/privacy'),
                    ),
                    TextSpan(text: l.registerPrivacySuffix),
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

/// Hisob turi — ikki katta karta.
///
/// Tanlangani siyoh chegara va belgi bilan ajraladi, rang bilan emas:
/// ivory mavzusida oltin faqat brend tafsilotlarida.
class _TypePicker extends StatelessWidget {
  const _TypePicker({
    required this.value,
    required this.onChanged,
    this.error,
  });

  final SignupAccountType? value;
  final ValueChanged<SignupAccountType> onChanged;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TypeCard(
          key: const ValueKey('signup-type-personal'),
          icon: Icons.person_outline_rounded,
          title: l.modePersonal,
          hint: l.accountPersonalHint,
          selected: value == SignupAccountType.personal,
          onTap: () => onChanged(SignupAccountType.personal),
        ),
        const SizedBox(height: Gap.md),
        _TypeCard(
          key: const ValueKey('signup-type-business'),
          icon: Icons.storefront_outlined,
          title: l.modeBusiness,
          hint: l.accountBusinessHint,
          selected: value == SignupAccountType.business,
          onTap: () => onChanged(SignupAccountType.business),
        ),
        if (error != null) ...[
          const SizedBox(height: Gap.md),
          Text(
            error!,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: t.error,
            ),
          ),
        ],
      ],
    );
  }
}

class _TypeCard extends StatelessWidget {
  const _TypeCard({
    super.key,
    required this.icon,
    required this.title,
    required this.hint,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String hint;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      selected: selected,
      label: title,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.all(Gap.lg),
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: R.gentle,
            border: Border.all(
              color: selected ? t.accent2 : t.border2,
              width: selected ? 1.6 : 1,
            ),
            boxShadow: selected ? t.shadowSoft : t.shadowTiny,
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: t.surface2,
                  borderRadius: R.tile,
                ),
                child: Icon(icon, size: 21, color: t.text1),
              ),
              const SizedBox(width: Gap.md + 2),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: AppType.displayStyle(
                            color: t.text1, size: 22, height: 1.1)),
                    const SizedBox(height: 3),
                    Text(hint, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              const SizedBox(width: Gap.sm),
              AnimatedOpacity(
                opacity: selected ? 1 : 0,
                duration: const Duration(milliseconds: 200),
                child: Icon(Icons.check_circle_rounded,
                    size: 22, color: t.accent2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
