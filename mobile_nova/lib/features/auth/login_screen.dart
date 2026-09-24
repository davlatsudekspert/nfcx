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
      _phoneErr = null;
      _passwordErr = _tr(Validate.password(_password.text));
      _formError = null;
    });
    if (_emailErr != null || _phoneErr != null || _passwordErr != null) return;

    setState(() => _busy = true);
    final repo = ref.read(authRepositoryProvider);

    final res = await repo.loginWithPassword(
      email: _email.text.trim(),
      password: _password.text,
    );
    if (!mounted) return;
    // `adopt()` tugaguncha tugma band — ikkinchi kirish so'rovi yo'q.
    try {
      await res.when(
        ok: (user) async {
          await ref.read(sessionProvider.notifier).adopt(user);
          if (mounted) context.go(Routes.home);
        },
        err: (e) async => setState(() => _formError = describeError(l, e)),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
          // Nav, Splash va NFC markazidagi bilan bir xil brend muhri.
          //
          // PREMIUM (egasi, 2026-09-24): muhr pastki panel markazidagi
          // kabi SIYOH diskda — oltin belgi qora ustida; ostida siyrak
          // NFCSTORE yozuvi.
          const Center(child: BrandSeal(size: 76, ink: true)),
          const SizedBox(height: Gap.md),
          Center(
            child: Text(
              'NFCSTORE',
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                letterSpacing: 4.2,
                color: t.text1,
              ),
            ),
          ),
          const SizedBox(height: Gap.xl),
          Text(l.loginTitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.displayMedium),
          const SizedBox(height: Gap.sm),
          Text(
            l.loginSubtitlePassword,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: Gap.xxl),
          // Forma — toza oq kartada: ingichka hoshiya va yumshoq soya.
          // Maydonlar karta ichida kulrang, ya'ni aniq ajralib turadi.
          Container(
            padding: const EdgeInsets.fromLTRB(
                Gap.lg, Gap.lg, Gap.lg, Gap.xl),
            decoration: BoxDecoration(
              color: t.surfaceSolid,
              borderRadius: R.soft,
              border: Border.all(color: t.border1),
              boxShadow: t.shadowSoft,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                NovaField(
                  label: l.fieldEmail,
                  controller: _email,
                  error: _emailErr,
                  keyboardType: TextInputType.emailAddress,
                  hint: 'siz@example.com',
                  enabled: !_busy,
                ),
                const SizedBox(height: Gap.lg),
                NovaField(
                  label: l.fieldPassword,
                  controller: _password,
                  error: _passwordErr,
                  obscure: _obscure,
                  enabled: !_busy,
                  onSubmitted: (_) => _submit(),
                  suffix: IconButton(
                    // Ekran o'quvchi uchun nom — ikonaning o'zi
                    // "ko'rsatish" yoki "yashirish" ekanini aytmaydi.
                    tooltip:
                        _obscure ? l.a11yShowPassword : l.a11yHidePassword,
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(
                      _obscure
                          ? Icons.visibility_off_rounded
                          : Icons.visibility_rounded,
                      size: 19,
                      color: t.text2,
                    ),
                  ),
                ),
                if (_formError != null) ...[
                  const SizedBox(height: Gap.lg),
                  _ErrorBanner(message: _formError!),
                ],
                const SizedBox(height: Gap.xl),
                NovaButton(
                  label: l.welcomeLogin,
                  busy: _busy,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
          // "KOD BILAN KIRISH" TUGMASI OLIB TASHLANDI.
          //
          // U `requestEmailCode` ni chaqirardi, ya'ni
          // `/api/auth/request-email-code` ga borardi. Serverda
          // BUNDAY YO'L YO'Q va hech qachon bo'lmagan
          // (`hosting/api/auth.js` dagi yo'llar: `tg-link/start`,
          // `request-register-code`, `register`,
          // `request-password-reset`, `request-email-reset`,
          // `reset-password`) — ya'ni tugma HAR SAFAR 404 bilan
          // tugardi.
          //
          // Ishlamaydigan imkoniyatni ko'rsatib turishdan ko'ra uni
          // olib qo'yish to'g'riroq: parol bilan kirish ishlaydi.
          // Backend kod bilan kirishni qo'shsa, bu blok va
          // `requestEmailCode`/`verifyEmailCode` qaytariladi —
          // FINAL_GAPS.md ga yozib qo'yildi.
          const SizedBox(height: Gap.section),
          // `Wrap`, `Row` EMAS. Tor ekranda (320 px) o'zbekcha
          // "Hisobingiz yo‘qmi?" + "Ro‘yxatdan o‘tish" bitta
          // qatorga sig'masdi va RenderFlex overflow berardi.
          // `Wrap` sig'masa ikkinchi qatorga o'tkazadi.
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
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
                      color: t.text1,
                      decoration: TextDecoration.underline,
                      decorationColor: t.brand,
                      decorationThickness: 1.6,
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
