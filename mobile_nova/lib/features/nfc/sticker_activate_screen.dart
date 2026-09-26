import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/errors/app_error.dart';
import '../../core/utils/result.dart';
import '../../data/repositories/nfc_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_icon.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import 'nfc_misc_screens.dart' show nfcDevicesProvider;
import 'nfc_service.dart';

/// SOTIB OLINGAN STIKERNI FAOLLASHTIRISH (egasi, 2026-09-26: "sotib olingan
/// stikerni ilovada ulab bo'lmaydi — faqat saytda").
///
/// Server oqimi sayt bilan AYNAN bir xil (`hosting/api/marketplace.js`,
/// sayt: `src/pages/ActivatePage.jsx`) — ilovada alohida mantiq yo'q:
///
///   1. konvertdagi kod (`POST /api/activate/check`);
///   2. profil turi: shaxsiy yoki biznes;
///   3. qaysi ID yoki kompaniya (`GET /api/activate/options`);
///   4. faollashtirish (`POST /api/activate`).
///
/// Odam hali ULANMAGAN stikerga tekkizib kelgan bo'lsa ([deviceToken]),
/// stiker shu amalning o'zida bog'lanadi. Aks holda oxirida "stikerni
/// tekkizish" tugmasi chiqadi — ilova NFC ni o'qiydi va stikerni
/// `attach-sticker` orqali ulaydi (7 kun ichida).
class StickerActivateScreen extends ConsumerStatefulWidget {
  const StickerActivateScreen({super.key, this.deviceToken = ''});

  /// Tekkizilgan, hali ulanmagan stikerning tokeni (`/t/<token>`).
  final String deviceToken;

  @override
  ConsumerState<StickerActivateScreen> createState() =>
      _StickerActivateScreenState();
}

enum _Step { code, kind, pick, done }

class _StickerActivateScreenState extends ConsumerState<StickerActivateScreen> {
  final _code = TextEditingController();
  _Step _step = _Step.code;
  bool _busy = false;
  String? _error;
  String _productName = '';
  bool _business = false;
  ActivationOptions? _options;
  // Tanlangan shaxsiy ID ('' — yangi ID) yoki kompaniya.
  String _pickedCode = '';
  String _pickedCompany = '';
  ActivationResult? _result;
  bool _attached = false;
  // Faqat odam "tekkizish" tugmasini bosganda olinadi — dispose'da
  // `ref` ishlatilmaydi.
  NfcService? _nfc;

  @override
  void dispose() {
    _nfc?.stop();
    _code.dispose();
    super.dispose();
  }

  String _errorText(L l, AppError e) => switch (e.code) {
        'bad_code' => l.activateErrBadCode,
        'code_expired' => l.activateErrExpired,
        'already_activated' => l.activateErrUsed,
        'code_blocked' => l.activateErrBlocked,
        'activation_in_progress' => l.activateErrBusy,
        'device_taken' => l.activateErrTaken,
        'no_pending_activation' => l.activateErrNoPending,
        _ => describeError(l, e),
      };

  Future<void> _checkCode() async {
    final l = L.of(context);
    // To'liq kod har doim `NF-XXXX-XXXX` (12 belgi) — formatlagich shunday
    // yozadi. Yarim kod serverga yuborilmaydi (tezlik chegarasini behuda
    // sarflamaslik uchun).
    final code = formatActivationCode(_code.text);
    if (code.length != 12) {
      setState(() => _error = l.activateErrBadCode);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(nfcRepositoryProvider).activationCheck(code);
    if (!mounted) return;
    switch (res) {
      case Ok(:final value):
        // Kodni SHU odam avval faollashtirgan — natijaga o'tamiz.
        if (value.already != null) {
          setState(() {
            _busy = false;
            _result = value.already;
            _step = _Step.done;
          });
          return;
        }
        setState(() {
          _busy = false;
          _productName = value.productName;
          _step = _Step.kind;
        });
      case Err(:final error):
        setState(() {
          _busy = false;
          _error = _errorText(l, error);
        });
    }
  }

  Future<void> _loadOptions() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(nfcRepositoryProvider).activationOptions();
    if (!mounted) return;
    switch (res) {
      case Ok(:final value):
        setState(() {
          _busy = false;
          _options = value;
          // Asosiy ID oldindan tanlanadi (saytdagidek).
          final primary = value.personal.where((e) => e.isPrimary);
          _pickedCode = primary.isNotEmpty
              ? primary.first.code
              : (value.personal.isNotEmpty ? value.personal.first.code : '');
          _pickedCompany =
              value.business.isNotEmpty ? value.business.first.companyId : '';
          _step = _Step.pick;
        });
      case Err(:final error):
        setState(() {
          _busy = false;
          _error = _errorText(L.of(context), error);
        });
    }
  }

  Future<void> _activate() async {
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(nfcRepositoryProvider).activateSticker(
          code: _code.text.trim(),
          business: _business,
          profileCode: _business ? '' : _pickedCode,
          companyId: _business ? _pickedCompany : '',
          deviceToken: widget.deviceToken,
        );
    if (!mounted) return;
    switch (res) {
      case Ok(:final value):
        ref.invalidate(nfcDevicesProvider);
        // Yangi bepul ID berilgan bo'lishi mumkin — sessiyadagi ro'yxat.
        await ref.read(sessionProvider.notifier).refresh();
        if (!mounted) return;
        HapticFeedback.mediumImpact();
        setState(() {
          _busy = false;
          _result = value;
          _step = _Step.done;
        });
      case Err(:final error):
        setState(() {
          _busy = false;
          _error = _errorText(l, error);
        });
    }
  }

  /// Faollashtirilgandan KEYIN stikerni tekkizib ulash.
  Future<void> _tapToAttach() async {
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    // Odam stikerga tekkizib kelgan bo'lsa, token allaqachon qo'lda —
    // qayta o'qish shart emas.
    String? payload;
    if (widget.deviceToken.isEmpty) {
      try {
        final NfcService nfc = _nfc ?? ref.read(nfcServiceProvider);
        _nfc = nfc;
        payload = await nfc.readOnce();
      } catch (_) {
        payload = null;
      }
      if (!mounted) return;
    }
    final token = widget.deviceToken.isNotEmpty
        ? widget.deviceToken
        : stickerTokenFromPayload(payload);
    if (token == null) {
      setState(() {
        _busy = false;
        _error = payload == null ? l.nfcScanFailed : l.activateNotSticker;
      });
      return;
    }
    final res = await ref
        .read(nfcRepositoryProvider)
        .attachSticker(deviceToken: token, code: _code.text.trim());
    if (!mounted) return;
    switch (res) {
      case Ok():
        ref.invalidate(nfcDevicesProvider);
        HapticFeedback.mediumImpact();
        setState(() {
          _busy = false;
          _attached = true;
        });
      case Err(:final error):
        setState(() {
          _busy = false;
          _error = _errorText(l, error);
        });
    }
  }

  void _back() {
    setState(() {
      _error = null;
      _step = switch (_step) {
        _Step.pick => _Step.kind,
        _Step.kind => _Step.code,
        _ => _step,
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return NovaScaffold(
      title: l.stickerActivate,
      showBack: true,
      body: NovaScroll(
        children: [
          const SizedBox(height: Gap.lg),
          if (_step != _Step.done) _Progress(step: _step.index),
          const SizedBox(height: Gap.xl),
          ...switch (_step) {
            _Step.code => _codeStep(l),
            _Step.kind => _kindStep(l),
            _Step.pick => _pickStep(l),
            _Step.done => _doneStep(l),
          },
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            _ErrorLine(text: _error!),
          ],
          const SizedBox(height: Gap.section),
        ],
      ),
    );
  }

  List<Widget> _codeStep(L l) {
    final t = context.tokens;
    return [
      Text(l.activateCodeTitle, style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: Gap.sm),
      Text(l.activateCodeHint,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: t.text2)),
      if (widget.deviceToken.isNotEmpty) ...[
        const SizedBox(height: Gap.md),
        _Note(icon: Icons.nfc_rounded, text: l.activateStickerTapped),
      ],
      const SizedBox(height: Gap.xl),
      NovaField(
        key: const ValueKey('activate-code'),
        label: l.activateCodeLabel,
        controller: _code,
        hint: 'NF-XXXX-XXXX',
        technical: true,
        autofocus: true,
        textCapitalization: TextCapitalization.characters,
        inputFormatters: [ActivationCodeFormatter()],
        onSubmitted: (_) => _busy ? null : _checkCode(),
      ),
      const SizedBox(height: Gap.xl),
      NovaButton(
        label: l.actionContinue,
        busy: _busy,
        onPressed: _busy ? null : _checkCode,
      ),
    ];
  }

  List<Widget> _kindStep(L l) {
    final t = context.tokens;
    return [
      if (_productName.isNotEmpty) ...[
        Text(_productName.toUpperCase(),
            style: AppType.eyebrow(color: t.text3)),
        const SizedBox(height: Gap.sm),
      ],
      Text(l.activateKindTitle, style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: Gap.xl),
      _Choice(
        key: const ValueKey('activate-personal'),
        icon: Icons.person_rounded,
        title: l.activateKindPersonal,
        subtitle: l.activateKindPersonalHint,
        selected: !_business,
        onTap: () => setState(() => _business = false),
      ),
      const SizedBox(height: Gap.md),
      _Choice(
        key: const ValueKey('activate-business'),
        icon: Icons.storefront_rounded,
        title: l.activateKindBusiness,
        subtitle: l.activateKindBusinessHint,
        selected: _business,
        onTap: () => setState(() => _business = true),
      ),
      const SizedBox(height: Gap.md),
      Text(l.activateKindNote,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.text3)),
      const SizedBox(height: Gap.xl),
      NovaButton(
        label: l.actionContinue,
        busy: _busy,
        onPressed: _busy ? null : _loadOptions,
      ),
      const SizedBox(height: Gap.sm),
      NovaButton(label: l.actionBack, tone: ButtonTone.quiet, onPressed: _back),
    ];
  }

  List<Widget> _pickStep(L l) {
    final o = _options ?? const ActivationOptions();
    final noCompany = _business && o.business.isEmpty;
    return [
      Text(_business ? l.activatePickBusiness : l.activatePickPersonal,
          style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: Gap.xl),
      if (_business)
        for (final c in o.business) ...[
          _Choice(
            icon: Icons.storefront_rounded,
            title: c.name.isNotEmpty ? c.name : c.companyId,
            subtitle: c.companyId,
            mono: true,
            selected: _pickedCompany == c.companyId,
            onTap: () => setState(() => _pickedCompany = c.companyId),
          ),
          const SizedBox(height: Gap.md),
        ]
      else ...[
        for (final p in o.personal) ...[
          _Choice(
            icon: Icons.badge_rounded,
            title: p.code,
            subtitle: p.name,
            mono: true,
            titleMono: true,
            selected: _pickedCode == p.code,
            onTap: () => setState(() => _pickedCode = p.code),
          ),
          const SizedBox(height: Gap.md),
        ],
        // Saytdagidek: shaxsiy ID bo'lmasa — yangi bepul ID.
        if (o.personal.isEmpty) ...[
          _Choice(
            icon: Icons.add_rounded,
            title: l.activateNewId,
            subtitle: l.activateNewIdHint,
            selected: true,
            // '' — server yangi bepul ID ajratadi.
            onTap: () => setState(() => _pickedCode = ''),
          ),
          const SizedBox(height: Gap.md),
        ],
      ],
      if (noCompany) ...[
        _Note(icon: Icons.info_outline_rounded, text: l.activateNoCompany),
        const SizedBox(height: Gap.xl),
        NovaButton(
          label: l.activateCreateCompany,
          icon: Icons.add_business_rounded,
          onPressed: () async {
            await context.push(Routes.businessOnboard);
            if (mounted) await _loadOptions();
          },
        ),
      ] else ...[
        const SizedBox(height: Gap.md),
        NovaButton(
          key: const ValueKey('activate-submit'),
          label: l.activateSubmit,
          icon: Icons.check_circle_rounded,
          busy: _busy,
          onPressed: _busy ? null : _activate,
        ),
      ],
      const SizedBox(height: Gap.sm),
      NovaButton(label: l.actionBack, tone: ButtonTone.quiet, onPressed: _back),
    ];
  }

  List<Widget> _doneStep(L l) {
    final t = context.tokens;
    final r = _result ?? const ActivationResult();
    final bound = r.deviceBound || _attached;
    final profileRoute = r.business
        ? Routes.storefront(r.profileCode)
        : Routes.user(r.profileCode);
    return [
      Center(
        child: Container(
          width: 76,
          height: 76,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: t.success.withValues(alpha: .12),
            border: Border.all(color: t.success.withValues(alpha: .45)),
          ),
          child: Icon(Icons.check_rounded, size: 38, color: t.success),
        ),
      ),
      const SizedBox(height: Gap.xl),
      Text(l.activateDoneTitle,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: Gap.lg),
      FloatingSurface(
        solid: true,
        padding: const EdgeInsets.all(Gap.lg),
        child: Row(
          children: [
            Icon(r.business ? Icons.storefront_rounded : Icons.badge_rounded,
                color: t.accent2),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                      r.business
                          ? l.activateKindBusiness
                          : l.activateKindPersonal,
                      style: Theme.of(context).textTheme.bodySmall
                          ?.copyWith(color: t.text3)),
                  Text(r.profileCode,
                      style: AppType.monoStyle(
                          color: t.text1, size: 17, letterSpacing: 1.6)),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: Gap.lg),
      _Note(
        icon: bound ? Icons.check_circle_outline_rounded : Icons.nfc_rounded,
        text: _attached
            ? l.activateAttached
            : (bound ? l.activateDoneBound : l.activateDoneTapNow),
        strong: !bound,
      ),
      const SizedBox(height: Gap.xl),
      if (!bound) ...[
        NovaButton(
          key: const ValueKey('activate-tap'),
          label: _busy ? l.nfcScanning : l.activateTapSticker,
          icon: Icons.touch_app_rounded,
          busy: _busy,
          onPressed: _busy ? null : _tapToAttach,
        ),
        const SizedBox(height: Gap.sm),
      ],
      NovaButton(
        label: l.activateOpenProfile,
        tone: bound ? ButtonTone.accent : ButtonTone.quiet,
        icon: Icons.open_in_new_rounded,
        onPressed: r.profileCode.isEmpty ? null : () => context.push(profileRoute),
      ),
    ];
  }
}

/// Kartadan o'qilgan havoladan stiker tokenini ajratadi.
///
/// NFCSTORE stikeri `https://nfcstore.uz/t/<token>` saqlaydi (eski
/// partiyalarda `/tap/<token>`). Boshqa narsa — `null`.
String? stickerTokenFromPayload(String? payload) {
  if (payload == null || payload.isEmpty) return null;
  final uri = Uri.tryParse(payload.trim());
  if (uri == null) return null;
  final host = uri.host.toLowerCase();
  if (host.isNotEmpty && host != 'nfcstore.uz' && host != 'www.nfcstore.uz') {
    return null;
  }
  final seg = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  if (seg.length < 2 || (seg.first != 't' && seg.first != 'tap')) return null;
  final token = seg[1];
  return RegExp(r'^[A-Za-z0-9_-]{1,64}$').hasMatch(token) ? token : null;
}

/// `NF-XXXX-XXXX` shaklida yozadi: katta harf, prefiks va chiziqchalar
/// o'zi qo'yiladi — odam faqat 8 belgini teradi.
///
/// "N" va "F" kodning O'ZIDA ham uchraydi, shuning uchun prefiks faqat
/// ikki holatda tashlanadi: matn "NF-" bilan boshlanganda (o'zimiz
/// qo'ygan) yoki butun kod prefiksi bilan joylanganda (10 belgi, "NF"
/// bilan) — server ham xuddi shunday qiladi (`normalizeActivationCode`).
class ActivationCodeFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final text = formatActivationCode(newValue.text);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}

/// [ActivationCodeFormatter] ning o'zagi — test uchun alohida.
String formatActivationCode(String input) {
  final up = input.toUpperCase();
  var raw = (up.startsWith('NF-') ? up.substring(3) : up)
      .replaceAll(RegExp(r'[^A-Z0-9]'), '');
  if (raw.length > 8 && raw.startsWith('NF')) raw = raw.substring(2);
  if (raw.length > 8) raw = raw.substring(0, 8);
  if (raw.isEmpty) return '';
  return raw.length <= 4
      ? 'NF-$raw'
      : 'NF-${raw.substring(0, 4)}-${raw.substring(4)}';
}

class _Progress extends StatelessWidget {
  const _Progress({required this.step});
  final int step;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Row(
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              height: 4,
              decoration: BoxDecoration(
                borderRadius: R.pill,
                color: i <= step ? t.accent2 : t.border2,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
    this.mono = false,
    this.titleMono = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;
  final bool mono;
  final bool titleMono;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      selected: selected,
      child: PressableScale(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(Gap.lg),
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: R.soft,
            border: Border.all(
                color: selected ? t.accent2 : t.border2,
                width: selected ? 1.6 : 1),
            boxShadow: t.shadowTiny,
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: t.surface2,
                  borderRadius: R.tile,
                  border: Border.all(color: t.border2),
                ),
                child: BrandAwareIcon(icon, size: 20, color: t.accent2),
              ),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: titleMono
                            ? AppType.monoStyle(
                                color: t.text1, size: 15, letterSpacing: 1.4)
                            : Theme.of(context).textTheme.titleSmall),
                    if (subtitle.isNotEmpty)
                      Text(subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: mono && !titleMono
                              ? AppType.monoStyle(color: t.text3, size: 11)
                              : Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: t.text2)),
                  ],
                ),
              ),
              const SizedBox(width: Gap.sm),
              Icon(
                selected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_unchecked_rounded,
                size: 20,
                color: selected ? t.accent2 : t.text3,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.text, this.strong = false});
  final IconData icon;
  final String text;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.all(Gap.md),
      decoration: BoxDecoration(
        color: strong ? t.accent2.withValues(alpha: .08) : t.surface2,
        borderRadius: R.tile,
        border: Border.all(
            color: strong ? t.accent2.withValues(alpha: .35) : t.border2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          BrandAwareIcon(icon, size: 18, color: strong ? t.accent2 : t.text2),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Text(text,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: t.text1,
                    fontWeight: strong ? FontWeight.w600 : FontWeight.w400)),
          ),
        ],
      ),
    );
  }
}

class _ErrorLine extends StatelessWidget {
  const _ErrorLine({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.error_outline_rounded, size: 18, color: t.error),
        const SizedBox(width: Gap.sm),
        Expanded(
          child: Text(text,
              key: const ValueKey('activate-error'),
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: t.error)),
        ),
      ],
    );
  }
}

/// Stiker holati: egasi o'chirib qo'ygan yoki bazada yo'q.
///
/// Ilgari ilova bu holatlarni ajratmasdi: o'chirilgan stiker profilni
/// ochaverardi, noma'lumi esa jim bosh sahifaga tashlardi.
class StickerStatusScreen extends StatelessWidget {
  const StickerStatusScreen({super.key, required this.off});

  final bool off;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return NovaScaffold(
      title: 'NFC',
      showBack: true,
      body: StatePanel(
        icon: off ? Icons.block_rounded : Icons.help_outline_rounded,
        title: off ? l.stickerOffTitle : l.stickerUnknownTitle,
        message: off ? l.stickerOffBody : l.stickerUnknownBody,
        tone: off ? t.warn : null,
        actionLabel: l.actionClose,
        onAction: () =>
            context.canPop() ? context.pop() : context.go(Routes.home),
      ),
    );
  }
}
