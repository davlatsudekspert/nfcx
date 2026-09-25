import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/external_link.dart';
import '../../core/utils/validators.dart';
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

/// PAROLNI UNUTGAN ODAM (egasi, 2026-09-25: "ilova bo'yicha parolni
/// unutsa nima qiladi, shuni hal qilaylik").
///
/// Server tayyor yo'lidan foydalanadi (`/api/auth/request-email-reset`):
/// emailga bir martalik havola boradi, odam uni ochib yangi parol
/// qo'yadi va shu yerga qaytib kiradi. Serverga yangi narsa kerak emas.
///
/// Email yo'q yoki pochtaga kira olmaydigan odam uchun pastda Telegram
/// yordami bor — u yerda raqam orqali tiklanadi.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key, this.initialEmail = ''});

  /// Kirish ekranida yozilgan email — qayta yozdirmaslik uchun.
  final String initialEmail;

  static const supportUrl = 'https://t.me/nfcstore_admin';

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  late final _email = TextEditingController(text: widget.initialEmail.trim());

  bool _busy = false;
  String? _emailErr;
  String? _formError;

  /// Havola so'ralgan manzil. `null` — hali yuborilmagan.
  String? _sentTo;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final l = L.of(context);
    final v = Validate.email(_email.text);
    setState(() {
      _emailErr = switch (v) {
        null => null,
        'errRequired' => l.errRequired,
        _ => l.errBadEmail,
      };
      _formError = null;
    });
    if (_emailErr != null) return;

    setState(() => _busy = true);
    final email = _email.text.trim();
    final res =
        await ref.read(authRepositoryProvider).requestPasswordResetEmail(email);
    if (!mounted) return;
    setState(() {
      _busy = false;
      res.when(
        ok: (_) => _sentTo = email,
        err: (e) => _formError = describeError(l, e),
      );
    });
  }

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(Routes.login);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    final sent = _sentTo;

    return NovaScaffold(
      showBack: true,
      body: NovaScroll(
        padding:
            const EdgeInsets.fromLTRB(Gap.xxl, Gap.sm, Gap.xxl, Gap.section),
        children: [
          const SizedBox(height: Gap.lg),
          Center(
            child: Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: t.surfaceSolid,
                border: Border.all(color: t.border1),
                boxShadow: t.shadowSoft,
              ),
              child: Icon(
                sent == null
                    ? Icons.lock_reset_rounded
                    : Icons.mark_email_read_rounded,
                size: 30,
                color: t.brand,
              ),
            ),
          ),
          const SizedBox(height: Gap.xl),
          Text(
            sent == null ? l.forgotTitle : l.forgotSentTitle,
            textAlign: TextAlign.center,
            style: text.displayMedium,
          ),
          const SizedBox(height: Gap.sm),
          Text(
            sent == null ? l.forgotSubtitle : l.forgotSentBody(sent),
            key: const ValueKey('forgot-message'),
            textAlign: TextAlign.center,
            style: text.bodyMedium,
          ),
          const SizedBox(height: Gap.xxl),
          if (sent == null)
            Container(
              padding:
                  const EdgeInsets.fromLTRB(Gap.lg, Gap.lg, Gap.lg, Gap.xl),
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
                    onSubmitted: (_) => _send(),
                  ),
                  if (_formError != null) ...[
                    const SizedBox(height: Gap.lg),
                    Text(
                      _formError!,
                      style: TextStyle(
                        fontFamily: 'Manrope',
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: t.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: Gap.xl),
                  NovaButton(
                    key: const ValueKey('forgot-send'),
                    label: l.forgotSend,
                    busy: _busy,
                    onPressed: _send,
                  ),
                ],
              ),
            )
          else ...[
            Text(
              l.forgotSpamHint,
              textAlign: TextAlign.center,
              style: text.bodySmall,
            ),
            const SizedBox(height: Gap.xl),
            NovaButton(
              key: const ValueKey('forgot-back'),
              label: l.forgotBackToLogin,
              onPressed: _back,
            ),
            const SizedBox(height: Gap.md),
            NovaButton(
              key: const ValueKey('forgot-resend'),
              label: l.forgotResend,
              tone: ButtonTone.quiet,
              onPressed: () => setState(() => _sentTo = null),
            ),
          ],
          const SizedBox(height: Gap.section),
          Text(l.forgotHelp, textAlign: TextAlign.center, style: text.bodySmall),
          Center(
            child: PressableScale(
              key: const ValueKey('forgot-support'),
              onTap: () => openLink(ForgotPasswordScreen.supportUrl),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                child: Text(
                  '@nfcstore_admin',
                  style: TextStyle(
                    fontFamily: 'Manrope',
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: t.text1,
                    decoration: TextDecoration.underline,
                    decorationColor: t.brand,
                    decorationThickness: 1.6,
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
