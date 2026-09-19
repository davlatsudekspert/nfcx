import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/validators.dart';
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
    final res = await ref.read(authRepositoryProvider).requestEmailCode(
          email: _email.text.trim(),
          phone: Validate.normalizePhone(_phone.text),
        );
    if (!mounted) return;
    setState(() => _busy = false);

    res.when(
      ok: (_) => context.push(
        Routes.registerVerify,
        extra: VerifyArgs(
          email: _email.text.trim(),
          purpose: VerifyPurpose.register,
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
