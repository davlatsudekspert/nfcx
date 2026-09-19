import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/validators.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import 'session.dart';
import 'verify_screen.dart';

/// Kirish ekrani.
///
/// IKKI YO'L bor va ikkalasi ham ochiq ko'rsatiladi:
///
/// * **Parol bilan** — backend bugun QO'LLAB-QUVVATLAYDIGAN yo'l.
/// * **Kod bilan** — texnik topshiriqdagi email tasdiqlash oqimi.
///   Backend'da endpoint hali yo'q, shuning uchun bosilganda ilova
///   soxta muvaffaqiyat emas, ochiq "BACKEND ENDPOINT REQUIRED"
///   holatini ko'rsatadi.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();

  bool _codeMode = false;
  bool _busy = false;
  bool _obscure = true;
  String? _emailErr, _phoneErr, _passwordErr;
  String? _formError;

  @override
  void dispose() {
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  String? _tr(String? key) {
    if (key == null) return null;
    final l = L.of(context);
    return switch (key) {
      'errRequired' => l.errRequired,
      'errBadEmail' => l.errBadEmail,
      'errBadPhone' => l.errBadPhone,
      'errPasswordShort' => l.errPasswordShort,
      _ => l.errUnknown,
    };
  }

  Future<void> _submit() async {
    final l = L.of(context);
    setState(() {
      _emailErr = _tr(Validate.email(_email.text));
      _phoneErr = _codeMode ? _tr(Validate.phone(_phone.text)) : null;
      _passwordErr = _codeMode ? null : _tr(Validate.password(_password.text));
      _formError = null;
    });
    if (_emailErr != null || _phoneErr != null || _passwordErr != null) return;

    setState(() => _busy = true);
    final repo = ref.read(authRepositoryProvider);

    if (_codeMode) {
      final res = await repo.requestEmailCode(
        email: _email.text.trim(),
        phone: Validate.normalizePhone(_phone.text),
      );
      if (!mounted) return;
      setState(() => _busy = false);
      res.when(
        ok: (_) => context.push(
          Routes.loginVerify,
          extra: VerifyArgs(email: _email.text.trim(), purpose: VerifyPurpose.login),
        ),
        // Bu yerda "kod yuborildi" deb ko'rsatish ALDOV bo'lardi:
        // hech qanday kod yuborilmagan.
        err: (e) => setState(() => _formError = describeError(l, e)),
      );
      return;
    }

    final res = await repo.loginWithPassword(
      email: _email.text.trim(),
      password: _password.text,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    await res.when(
      ok: (user) async {
        await ref.read(sessionProvider.notifier).adopt(user);
        if (mounted) context.go(Routes.home);
      },
      err: (e) async => setState(() => _formError = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return NovaScaffold(
      showBack: true,
      body: NovaScroll(
        padding: const EdgeInsets.fromLTRB(Gap.xxl, Gap.sm, Gap.xxl, Gap.section),
        children: [
          Center(child: BrandLogo(size: 76)),
          const SizedBox(height: Gap.xxl),
          Text(l.loginTitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.displayMedium),
          const SizedBox(height: Gap.sm),
          Text(
            _codeMode ? l.loginSubtitle : l.loginSubtitlePassword,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: Gap.section),
          NovaField(
            label: l.fieldEmail,
            controller: _email,
            error: _emailErr,
            keyboardType: TextInputType.emailAddress,
            hint: 'siz@example.com',
            enabled: !_busy,
          ),
          const SizedBox(height: Gap.lg),
          if (_codeMode)
            PhoneField(
              label: l.fieldPhone,
              controller: _phone,
              error: _phoneErr,
            )
          else
            NovaField(
              label: l.fieldPassword,
              controller: _password,
              error: _passwordErr,
              obscure: _obscure,
              enabled: !_busy,
              onSubmitted: (_) => _submit(),
              suffix: IconButton(
                onPressed: () => setState(() => _obscure = !_obscure),
                icon: Icon(
                  _obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                  size: 19,
                  color: t.text3,
                ),
              ),
            ),
          if (_formError != null) ...[
            const SizedBox(height: Gap.lg),
            _ErrorBanner(message: _formError!),
          ],
          const SizedBox(height: Gap.xxl),
          NovaButton(
            label: _codeMode ? l.loginSendCode : l.welcomeLogin,
            busy: _busy,
            onPressed: _submit,
          ),
          const SizedBox(height: Gap.md),
          NovaButton(
            label: _codeMode ? l.loginWithPassword : l.loginUseCode,
            tone: ButtonTone.outline,
            onPressed: _busy
                ? null
                : () => setState(() {
                      _codeMode = !_codeMode;
                      _formError = null;
                      _passwordErr = null;
                      _phoneErr = null;
                    }),
          ),
          const SizedBox(height: Gap.section),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(l.loginNoAccount,
                  style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(width: 6),
              PressableScale(
                onTap: () => context.push(Routes.register),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                  child: Text(
                    l.welcomeRegister,
                    style: TextStyle(
                      fontFamily: 'Manrope',
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: t.accent2,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Forma ustidagi xato yo'lakchasi — maydon xatosidan farqli o'laroq
/// butun so'rovga tegishli xatolar shu yerda ko'rinadi.
class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.md),
      decoration: BoxDecoration(
        color: t.error.withValues(alpha: .12),
        borderRadius: R.gentle,
        border: Border.all(color: t.error.withValues(alpha: .35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline_rounded, size: 17, color: t.error),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: t.error,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
