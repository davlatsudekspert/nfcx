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

enum VerifyPurpose { login, register }

class VerifyArgs {
  const VerifyArgs({required this.email, required this.purpose});
  final String email;
  final VerifyPurpose purpose;
}

/// Email tasdiqlash ekrani — kod kiritish, sanoq, qayta yuborish,
/// noto'g'ri kod, muddati tugagan kod va emailni almashtirish.
class VerifyScreen extends ConsumerStatefulWidget {
  const VerifyScreen({super.key, required this.args});

  final VerifyArgs args;

  @override
  ConsumerState<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends ConsumerState<VerifyScreen> {
  /// Kod amal qilish muddati. Server ham shu chegarani qo'llaydi;
  /// bu yerdagisi faqat ko'rinish uchun.
  static const _ttl = 120;

  Timer? _timer;
  int _left = _ttl;
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
      _expired = false;
    });
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() {
        _left--;
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

    final res = await ref.read(authRepositoryProvider).verifyEmailCode(
          email: widget.args.email,
          code: code,
        );
    if (!mounted) return;
    setState(() => _busy = false);

    await res.when(
      ok: (user) async {
        await ref.read(sessionProvider.notifier).adopt(user);
        if (!mounted) return;
        context.go(widget.args.purpose == VerifyPurpose.register
            ? Routes.profileSetup
            : Routes.home);
      },
      err: (e) async {
        setState(() {
          // Noto'g'ri kod maydonni qizartiradi; boshqa xatolar esa
          // yo'lakcha bo'lib chiqadi — ular kodga aloqador emas.
          _wrong = e.code == 'bad_code' || e.code == 'bad_email_code';
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
    final res = await ref
        .read(authRepositoryProvider)
        .requestEmailCode(email: widget.args.email);
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
                : (_wrong ? l.verifyWrongCodeHint : l.verifySentTo(widget.args.email)),
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
          else if (_expired || _left <= 0)
            NovaButton(label: l.verifyResend, onPressed: _resend)
          else
            Center(
              child: Text(
                l.verifyResendIn(_left),
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
                    fontWeight: FontWeight.w700,
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
