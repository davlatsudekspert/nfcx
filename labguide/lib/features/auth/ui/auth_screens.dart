import 'dart:async';

import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../app/app_scope.dart';
import '../../../app/widgets/lg_page.dart';
import '../../../design/tokens.dart';
import '../../../design/widgets/lg_widgets.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../otp_auth.dart';

/// Profil ichidan ochilganmi (aks holda onboarding oqimi).
bool _fromProfile(BuildContext context) =>
    GoRouterState.of(context).matchedLocation.startsWith('/profile');

class EmailScreen extends StatefulWidget {
  const EmailScreen({super.key});

  @override
  State<EmailScreen> createState() => _EmailScreenState();
}

class _EmailScreenState extends State<EmailScreen> {
  final _email = TextEditingController();
  bool _consent = false;
  bool _busy = false;
  bool _serviceUnavailable = false;
  String? _emailError;
  String? _consentError;
  String? _formError;

  @override
  void initState() {
    super.initState();
    final pending = context.services.auth.pendingEmail;
    if (pending != null) _email.text = pending;
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l = AppLocalizations.of(context);
    setState(() {
      _emailError = isValidEmail(_email.text) ? null : l.authEmailInvalid;
      _consentError = _consent ? null : l.authConsentRequired;
      _formError = null;
    });
    if (_emailError != null || _consentError != null) return;

    setState(() => _busy = true);
    final base = GoRouterState.of(context).matchedLocation;
    final result = await context.services.auth.requestCode(_email.text);
    if (!mounted) return;
    setState(() => _busy = false);
    switch (result.status) {
      case OtpRequestStatus.sent:
        await context.push('$base/otp');
      case OtpRequestStatus.invalidEmail:
        setState(() => _emailError = l.authEmailInvalid);
      case OtpRequestStatus.rateLimited:
        setState(
          () => _formError = l.authRateLimited(
            (result.retryAfter ?? Duration.zero).inSeconds.clamp(1, 3600),
          ),
        );
      case OtpRequestStatus.unavailable:
        setState(() => _serviceUnavailable = true);
      case OtpRequestStatus.failed:
        setState(() => _formError = l.authGenericError);
    }
  }

  Future<void> _continueAsGuest() async {
    if (_fromProfile(context)) {
      context.pop();
      return;
    }
    await context.services.auth.continueAsGuest();
    if (mounted) await context.push('/welcome/role');
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final adapter = context.services.auth.adapter;
    final unavailable = !adapter.isAvailable || _serviceUnavailable;

    return LgPage(
      title: l.authTitle,
      subtitle: l.authSubtitle,
      showProfile: false,
      children: [
        if (unavailable)
          LgStateView(
            kind: StateKind.unavailable,
            title: l.authUnavailableTitle,
            message: l.authUnavailableBody,
            actionLabel: l.authContinueGuest,
            onAction: _continueAsGuest,
          )
        else ...[
          if (adapter.isDemo) LgNotice(l.authDemoNotice),
          AutofillGroup(
            child: LgField(
              label: l.authEmailLabel,
              controller: _email,
              hint: l.authEmailHint,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.email],
              errorText: _emailError,
              onSubmitted: (_) => _submit(),
            ),
          ),
          const SizedBox(height: 12),
          MergeSemantics(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => setState(() {
                _consent = !_consent;
                if (_consent) _consentError = null;
              }),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      value: _consent,
                      onChanged: (v) => setState(() {
                        _consent = v ?? false;
                        if (_consent) _consentError = null;
                      }),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(l.authConsent, style: text.bodyMedium),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_consentError != null)
            Padding(
              padding: const EdgeInsets.only(left: 12, bottom: 4),
              child: Text(
                _consentError!,
                style: text.bodySmall!.copyWith(color: p.danger),
              ),
            ),
          if (_formError != null) LgNotice(_formError!, kind: NoticeKind.error),
          const SizedBox(height: 10),
          LgButton(label: l.authGetCode, busy: _busy, onPressed: _submit),
          LgButton.link(
            label: l.authViewTerms,
            onPressed: () => context.push('/terms'),
          ),
        ],
      ],
    );
  }
}

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;
  Timer? _ticker;
  DateTime? _resendAt;

  @override
  void initState() {
    super.initState();
    _armResend(context.services.auth.lastRequest?.retryAfter);
  }

  void _armResend(Duration? after) {
    _ticker?.cancel();
    if (after == null || after <= Duration.zero) {
      _resendAt = null;
      return;
    }
    _resendAt = DateTime.now().add(after);
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {});
      if (_secondsLeft == 0) _ticker?.cancel();
    });
  }

  int get _secondsLeft {
    final at = _resendAt;
    if (at == null) return 0;
    final left = at.difference(DateTime.now()).inMilliseconds;
    return left <= 0 ? 0 : (left / 1000).ceil();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _code.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final l = AppLocalizations.of(context);
    final code = _code.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = l.otpFormat);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final fromProfile = _fromProfile(context);
    final result = await context.services.auth.verifyCode(code);
    if (!mounted) return;
    setState(() => _busy = false);
    switch (result.status) {
      case OtpVerifyStatus.verified:
        context.go(fromProfile ? '/profile' : '/welcome/role');
      case OtpVerifyStatus.invalidCode:
        setState(() => _error = l.otpInvalid(result.attemptsLeft ?? 0));
      case OtpVerifyStatus.expired:
        setState(() => _error = l.otpExpired);
      case OtpVerifyStatus.tooManyAttempts:
        setState(() => _error = l.otpTooManyAttempts);
      case OtpVerifyStatus.noActiveCode:
        setState(() => _error = l.otpNoActiveCode);
      case OtpVerifyStatus.unavailable:
        setState(() => _error = l.authUnavailableTitle);
      case OtpVerifyStatus.failed:
        setState(() => _error = l.authGenericError);
    }
  }

  Future<void> _resend() async {
    final l = AppLocalizations.of(context);
    final auth = context.services.auth;
    final email = auth.pendingEmail;
    if (email == null) return;
    final result = await auth.requestCode(email);
    if (!mounted) return;
    switch (result.status) {
      case OtpRequestStatus.sent:
        _code.clear();
        setState(() => _error = null);
        _armResend(result.retryAfter);
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(l.otpResent)));
      case OtpRequestStatus.rateLimited:
        _armResend(result.retryAfter);
        setState(() {});
      case OtpRequestStatus.unavailable:
        setState(() => _error = l.authUnavailableTitle);
      case OtpRequestStatus.invalidEmail:
      case OtpRequestStatus.failed:
        setState(() => _error = l.authGenericError);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final auth = context.services.auth;
    final email = auth.pendingEmail;
    final request = auth.lastRequest;

    if (email == null) {
      return LgPage(
        title: l.otpTitle,
        showProfile: false,
        children: [
          LgStateView(
            kind: StateKind.empty,
            title: l.otpNoActiveCode,
            actionLabel: l.actionBack,
            onAction: () => context.pop(),
          ),
        ],
      );
    }

    final seconds = _secondsLeft;
    return LgPage(
      title: l.otpTitle,
      subtitle: email,
      showProfile: false,
      children: [
        if (auth.adapter.isDemo && request?.debugCode != null)
          LgNotice(l.otpDemoCode(request!.debugCode!)),
        if (request?.validFor != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              l.otpValidFor(request!.validFor!.inMinutes),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        LgField(
          label: l.otpCodeLabel,
          controller: _code,
          hint: '••••••',
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.oneTimeCode],
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          errorText: _error,
          onSubmitted: (_) => _verify(),
        ),
        const SizedBox(height: 18),
        LgButton(label: l.otpVerify, busy: _busy, onPressed: _verify),
        LgButton.link(
          label: seconds > 0 ? l.otpResendIn(seconds) : l.otpResend,
          onPressed: seconds > 0 ? null : _resend,
        ),
      ],
    );
  }
}

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return LgPage(
      title: l.termsTitle,
      showProfile: false,
      children: [
        Text(l.termsBody, style: Theme.of(context).textTheme.bodyLarge),
        const SizedBox(height: LgSpace.lg),
        LgNotice(l.analyteNoInterpretation, kind: NoticeKind.info),
      ],
    );
  }
}
